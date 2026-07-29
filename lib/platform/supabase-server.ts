import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './env';
import { FEATURE_KEYS } from './modules';
import { isFinchEnabled } from '@/lib/ai/finch/config';
import type { FeatureKey, Organisation, OrgFeature, Profile } from './types';

/**
 * Server Supabase client bound to the request cookies (Next 16 — `cookies()` is async).
 * `setAll` is wrapped in try/catch because Server Components cannot write cookies.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — refresh handled on the next request.
        }
      },
    },
  });
}

export interface PlatformSession {
  userId: string;
  email: string;
  profile: Profile | null;
  org: Organisation | null;
  features: Record<FeatureKey, boolean>;
  /** Module feature-keys this org may NOT open (locked in the sidebar + guarded). */
  lockedModules: FeatureKey[];
  /** Whether Finch is enabled platform-wide (env kill switch). Client reads this
   *  to decide whether to render the launcher; the API enforces it server-side. */
  finchEnabled: boolean;
  /** 14-day trial countdown, derived from `org.trial_started_at`/`trial_ends_at`.
   *  Null when either column is absent — existing (pre-onboarding) orgs never see
   *  a pill or a gate. `daysLeft` is ceil'd and floored at 0; `expired` is true
   *  once `trial_ends_at` has passed. */
  trial: { endsAt: string | null; daysLeft: number | null; expired: boolean } | null;
}

/** Computes the PlatformSession.trial shape from an org's trial columns. See
 *  .ai/plan_finch-onboarding.md §3/§4 Phase E — null when either column is
 *  absent so existing orgs (backfilled with no trial dates) are unaffected. */
function computeTrial(org: Organisation | null): PlatformSession['trial'] {
  if (!org?.trial_started_at || !org?.trial_ends_at) return null;
  const endsAt = org.trial_ends_at;
  const msLeft = new Date(endsAt).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  return { endsAt, daysLeft, expired: msLeft <= 0 };
}

const emptyFeatures = (): Record<FeatureKey, boolean> =>
  Object.fromEntries(FEATURE_KEYS.map((k) => [k, false])) as Record<FeatureKey, boolean>;

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Row shape of the collapsed `profiles → organisations → org_features` read.
 *  PostgREST embeds the many-to-one parent as an object and the one-to-many
 *  child as an array; both are typed loosely and normalised defensively below
 *  so a schema surprise degrades to `null`/`[]` rather than throwing. */
type OrgWithFeatures = Organisation & { org_features?: OrgFeature[] | null };
type ProfileWithOrg = Profile & { organisations?: OrgWithFeatures | OrgWithFeatures[] | null };

/** Latched once per server process when this database cannot serve the nested
 *  embed — PostgREST answers PGRST200 when the FK it needs isn't in the schema
 *  cache. `organisations`/`profiles`/`org_features` have no checked-in DDL (see
 *  AUDIT_FINDINGS.md), so the FKs can't be verified from supabase/*.sql; the
 *  split fallback below keeps the old behaviour exactly if they're absent. */
let nestedEmbedUnavailable = false;

/**
 * Fetch profile + org + org features in ONE round-trip via a nested select.
 * Falls back to the original profile-then-(org ‖ features) pair only when the
 * embed is unavailable, which is then remembered so it's probed once, not once
 * per request. Both paths return identical data.
 */
async function loadProfileGraph(
  supabase: ServerSupabase,
  userId: string,
): Promise<{ profile: Profile | null; org: Organisation | null; featureRows: OrgFeature[] }> {
  if (!nestedEmbedUnavailable) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, organisations(*, org_features(*))')
      .eq('id', userId)
      .maybeSingle<ProfileWithOrg>();

    if (!error) {
      if (!data) return { profile: null, org: null, featureRows: [] };
      const { organisations, ...profile } = data;
      const orgRow = Array.isArray(organisations) ? (organisations[0] ?? null) : (organisations ?? null);
      if (!orgRow) return { profile, org: null, featureRows: [] };
      const { org_features, ...org } = orgRow;
      return { profile, org, featureRows: org_features ?? [] };
    }
    // Missing/unresolvable relationship — stop paying for the embed attempt.
    if (error.code === 'PGRST200') nestedEmbedUnavailable = true;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle<Profile>();

  if (!profile?.org_id) return { profile: profile ?? null, org: null, featureRows: [] };

  const [{ data: orgRow }, { data: featureRows }] = await Promise.all([
    supabase.from('organisations').select('*').eq('id', profile.org_id).maybeSingle<Organisation>(),
    supabase.from('org_features').select('*').eq('org_id', profile.org_id).returns<OrgFeature[]>(),
  ]);

  return { profile, org: orgRow ?? null, featureRows: featureRows ?? [] };
}

/**
 * Resolve the authenticated platform session (user + profile + org + features),
 * or null when unauthenticated/unconfigured. The /app layout uses this to guard.
 *
 * Wrapped in React `cache()` so the layout + page (+ nested layout) all share a
 * SINGLE execution per request instead of each re-running the auth → profile →
 * org/features round-trips. This deduped ~8 redundant queries per ProcurePulse
 * navigation down to one set.
 *
 * That one set is now TWO sequential hops, not three: `auth.getUser()` (kept as
 * hop 1 — it revalidates the JWT with the auth server, which getSession/getClaims
 * do not) then a single nested read for profile + org + features.
 */
export const getPlatformSession = cache(async (): Promise<PlatformSession | null> => {
  if (!supabaseConfigured) return null;
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { profile, org, featureRows } = await loadProfileGraph(supabase, user.id);

  const features = emptyFeatures();
  for (const row of featureRows) {
    if ((FEATURE_KEYS as readonly string[]).includes(row.feature_key)) {
      features[row.feature_key as FeatureKey] = row.enabled;
    }
  }

  // TEMPORARY (testing): activate every module for all users, regardless of the
  // org's org_features rows. Remove this loop to restore per-org gating.
  for (const k of FEATURE_KEYS) features[k] = true;

  // Locked modules are a per-org override on top of the above: the sidebar shows
  // them with a lock/Unlock CTA and direct navigation is blocked.
  const lockedModules = ((org?.locked_modules ?? []) as string[]).filter((k): k is FeatureKey =>
    (FEATURE_KEYS as readonly string[]).includes(k),
  );

  return {
    userId: user.id,
    email: user.email ?? '',
    profile: profile ?? null,
    org,
    features,
    lockedModules,
    finchEnabled: isFinchEnabled(),
    trial: computeTrial(org),
  };
});

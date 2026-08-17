import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { parseEnvList } from '@/lib/platform/price-watch/run';
import { agentOrgIds, NO_ORGS_MESSAGE } from '@/lib/platform/agents/org-allowlist';

export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY);

/** Findings still wanting attention — mirrors OPEN_STATUSES in
 *  lib/platform/agent-findings.ts (the Brief's read path). */
const OPEN_STATUSES = ['new', 'in_progress'];

/** Five, per acceptance criterion 9. A weekly email that lists everything is an
 *  email nobody opens; the five biggest rand figures are the week's decisions. */
const MAX_FINDINGS = 5;

/** Where a recipient goes to act on a finding. The Brief IS /app (see
 *  app/app/page.tsx); the base is hardcoded exactly as in app/robots.ts and
 *  app/sitemap.ts rather than derived from VERCEL_URL, which on a preview
 *  deployment would send Josh to a preview build's data. */
const APP_URL = 'https://vyso.co.za/app';

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "R 12,480" — whole rand. A digest is a prompt to look, not a ledger. */
function formatRand(n: number): string {
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

interface DigestFinding {
  observation: string;
  recommended_action: string | null;
  rand_impact: number | string | null;
  evidence_refs: string[] | null;
}

/**
 * The weekly Price Watch brief (plan step 9, acceptance criterion 9).
 *
 * Monday 04:00 UTC (06:00 SAST) via Vercel Cron — the findings themselves are
 * written by /api/agents/price-watch overnight, so this route only READS and
 * emails. Nothing about the agent's state changes here: re-running it re-sends
 * the same email rather than corrupting anything, which is why it is safe to
 * curl by hand when a send is missed.
 *
 * Env:
 *   AGENTS_ORG_IDS        — comma-separated org uuids (the shared allowlist every
 *                           agent route reads, falling back to
 *                           PRICE_WATCH_ORG_IDS; unset ⇒ nothing to report)
 *   PRICE_WATCH_DIGEST_TO — comma-separated recipients (D2: Josh + Roberto).
 *                           Unset ⇒ 503 and NOT A SINGLE EMAIL SENT. There is no
 *                           default recipient on purpose: a business's supplier
 *                           prices must never be mailed to an address that was
 *                           hardcoded rather than chosen.
 *
 * Authenticated with CRON_SECRET — Vercel Cron sends it as a bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const recipients = parseEnvList(process.env.PRICE_WATCH_DIGEST_TO);
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: 'PRICE_WATCH_DIGEST_TO is not set — no digest was sent to anyone.' },
      { status: 503 },
    );
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 503 });
  }

  const orgIds = agentOrgIds();
  if (orgIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: NO_ORGS_MESSAGE });
  }

  const results: { orgId: string; findings: number; sent: boolean; error?: string }[] = [];

  for (const orgId of orgIds) {
    // Service-role client: RLS is bypassed, so org_id is filtered by hand on
    // every read (lib/platform/supabase-service.ts's contract).
    const { data: org } = await supabase
      .from('organisations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle<{ name: string | null }>();
    const orgName = org?.name ?? 'your business';

    const { data: rows, error } = await supabase
      .from('agent_findings')
      .select('observation, recommended_action, rand_impact, evidence_refs')
      .eq('org_id', orgId)
      .eq('agent', 'price_watch')
      .in('status', OPEN_STATUSES)
      // Nulls last: a finding with no rand figure must never outrank one that
      // carries a number the owner can act on.
      .order('rand_impact', { ascending: false, nullsFirst: false })
      .limit(MAX_FINDINGS)
      .returns<DigestFinding[]>();

    if (error) {
      console.error('digest: findings read failed', orgId, error.message);
      results.push({ orgId, findings: 0, sent: false, error: error.message });
      continue;
    }

    const findings = rows ?? [];
    if (findings.length === 0) {
      // No email at all. A weekly "nothing to report" trains the recipient to
      // archive the digest unread, which is exactly how a real finding gets
      // missed three weeks later.
      results.push({ orgId, findings: 0, sent: false });
      continue;
    }

    const html = renderDigest(orgName, findings);
    try {
      await resend.emails.send({
        from: 'Vyso Price Watch <noreply@vyso.co.za>',
        to: recipients,
        subject: `Vyso weekly brief — ${orgName} — ${findings.length} finding${
          findings.length === 1 ? '' : 's'
        }`,
        html,
      });
      results.push({ orgId, findings: findings.length, sent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('digest: send failed', orgId, message);
      results.push({ orgId, findings: findings.length, sent: false, error: message });
    }
  }

  return NextResponse.json({ ok: true, sent: results.filter((r) => r.sent).length, results });
}

/**
 * Plain HTML — inline styles only, no images, no tracking. It has to survive
 * Gmail, Outlook and a phone, and its whole job is to get the reader to /app.
 *
 * Everything printed here comes from a row Price Watch wrote after validating
 * its own numbers (observe.ts); this function adds no arithmetic of its own, so
 * the email cannot state a figure the finding does not.
 */
function renderDigest(orgName: string, findings: DigestFinding[]): string {
  const items = findings
    .map((f, i) => {
      const impact = f.rand_impact == null ? null : Number(f.rand_impact);
      const evidence = f.evidence_refs?.length ?? 0;
      return `
        <div style="margin: 0 0 20px; padding: 16px; border: 1px solid #E3E8EF; border-radius: 8px;">
          <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.5; color: #111;">
            ${i + 1}. ${escapeHtml(f.observation)}
          </p>
          ${
            impact != null && Number.isFinite(impact)
              ? `<p style="margin: 0 0 8px; font-size: 14px; color: #0C447C;"><strong>Estimated annual impact:</strong> ${formatRand(impact)}</p>`
              : ''
          }
          ${
            f.recommended_action
              ? `<p style="margin: 0 0 8px; font-size: 14px; color: #374151;"><strong>Suggested next step:</strong> ${escapeHtml(f.recommended_action)}</p>`
              : ''
          }
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            Based on ${evidence} source document${evidence === 1 ? '' : 's'}.
          </p>
        </div>`;
    })
    .join('');

  return `
    <div style="font-family: sans-serif; max-width: 640px; color: #111;">
      <h2 style="margin: 0 0 4px;">Price Watch — weekly brief</h2>
      <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">${escapeHtml(orgName)}</p>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5;">
        ${findings.length} open finding${findings.length === 1 ? '' : 's'} from your supplier documents,
        biggest rand impact first.
      </p>
      ${items}
      <p style="margin: 24px 0 0;">
        <a href="${APP_URL}" style="background: #1F5FA8; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 15px;">
          Open the Brief
        </a>
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px;">
        Price Watch observes and recommends — nothing has been actioned on your behalf.
      </p>
    </div>`;
}

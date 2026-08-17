import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { parseEnvList } from '@/lib/platform/price-watch/run';
import { agentOrgIds, NO_ORGS_MESSAGE } from '@/lib/platform/agents/org-allowlist';
import { isInformationalFinding } from '@/lib/platform/agents/finding-kinds';

export const maxDuration = 300;

const resend = new Resend(process.env.RESEND_API_KEY);

/** Findings still wanting attention — mirrors OPEN_STATUSES in
 *  lib/platform/agent-findings.ts (the Brief's read path). */
const OPEN_STATUSES = ['new', 'in_progress'];

/** Five, per acceptance criterion 9. A weekly email that lists everything is an
 *  email nobody opens; the five biggest rand figures are the week's decisions. */
const MAX_FINDINGS = 5;

/**
 * How many rows to READ before the five are chosen.
 *
 * The cap used to be applied by the query, because only one agent wrote here.
 * Four do now, and one of them (Doc Watch) writes a receipt per document — up to
 * dozens a day — which must never appear in a weekly digest of things to decide.
 * Those rows are dropped in memory (`isInformationalFinding`), so the read has
 * to be wider than the five it will end up sending or a busy week of scanning
 * would push every real finding out of the email.
 */
const FINDING_PROBE_LIMIT = 60;

/**
 * Human labels for the agent slugs, for the one-word attribution on each item.
 * Deliberately a local map rather than an import from
 * components/platform/brief/brief-display.ts: those labels are sized for a chip
 * in a 220px column ("Debtors", "Stock"), and an email has room to name the
 * agent properly. An unknown slug is simply not attributed.
 */
const AGENT_LABELS: Record<string, string> = {
  price_watch: 'Price Watch',
  debtors_watch: 'Debtors Watch',
  stock_cover: 'Stock Cover',
};

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
  agent: string;
  observation: string;
  recommended_action: string | null;
  rand_impact: number | string | null;
  evidence_refs: string[] | null;
}

/**
 * The weekly Vyso brief (plan step 9, acceptance criterion 9; broadened to every
 * agent by `.ai/plan_agents_phase_c.md`).
 *
 * Monday 04:00 UTC (06:00 SAST) via Vercel Cron — the findings themselves are
 * written by /api/agents/* overnight, so this route only READS and emails.
 * Nothing about any agent's state changes here: re-running it re-sends the same
 * email rather than corrupting anything, which is why it is safe to curl by hand
 * when a send is missed.
 *
 * IT IS NO LONGER A PRICE WATCH EMAIL. Four agents write to `agent_findings`
 * now, so the subject line, the heading and the sign-off say "Vyso" — an email
 * headed "Price Watch" listing a customer who is 40 days past terms would be
 * wrong about its own contents. Each item is attributed instead.
 *
 * DOC WATCH IS EXCLUDED. Its findings are receipts — one per document read — and
 * a weekly email of "we read 84 invoices" is the definition of a digest nobody
 * opens. An org whose only open findings are receipts gets NO EMAIL, which is
 * the same behaviour an org with no findings at all has always had.
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
      .select('agent, observation, recommended_action, rand_impact, evidence_refs')
      .eq('org_id', orgId)
      // Every agent, not just Price Watch — but see the informational filter
      // below, which is what keeps Doc Watch's receipts out.
      .in('status', OPEN_STATUSES)
      // Nulls last: a finding with no rand figure must never outrank one that
      // carries a number the owner can act on.
      .order('rand_impact', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(FINDING_PROBE_LIMIT)
      .returns<DigestFinding[]>();

    if (error) {
      console.error('digest: findings read failed', orgId, error.message);
      results.push({ orgId, findings: 0, sent: false, error: error.message });
      continue;
    }

    const findings = (rows ?? [])
      .filter(
        (f) =>
          !isInformationalFinding({
            agent: f.agent,
            rand_impact: f.rand_impact == null ? null : Number(f.rand_impact),
            recommended_action: f.recommended_action,
          }),
      )
      .slice(0, MAX_FINDINGS);
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
        from: 'Vyso <noreply@vyso.co.za>',
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
 * Everything printed here comes from a row an agent wrote after validating its
 * own numbers; this function adds no arithmetic of its own, so the email cannot
 * state a figure the finding does not.
 *
 * NOTE ON "annual". Price Watch's `rand_impact` is an annualised estimate; a
 * Debtors Watch figure is money already owed today, and a Stock Cover write-off
 * is a loss already taken. Calling all three "estimated annual impact" would
 * have been false for two of them, so the label is now simply "Worth" — the one
 * word that is true of every kind of finding in the table.
 */
function renderDigest(orgName: string, findings: DigestFinding[]): string {
  const items = findings
    .map((f, i) => {
      const impact = f.rand_impact == null ? null : Number(f.rand_impact);
      const evidence = f.evidence_refs?.length ?? 0;
      const label = AGENT_LABELS[f.agent];
      return `
        <div style="margin: 0 0 20px; padding: 16px; border: 1px solid #E3E8EF; border-radius: 8px;">
          ${
            label
              ? `<p style="margin: 0 0 6px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280;">${escapeHtml(label)}</p>`
              : ''
          }
          <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.5; color: #111;">
            ${i + 1}. ${escapeHtml(f.observation)}
          </p>
          ${
            impact != null && Number.isFinite(impact)
              ? `<p style="margin: 0 0 8px; font-size: 14px; color: #0C447C;"><strong>Worth:</strong> ${formatRand(impact)}</p>`
              : ''
          }
          ${
            f.recommended_action
              ? `<p style="margin: 0 0 8px; font-size: 14px; color: #374151;"><strong>Suggested next step:</strong> ${escapeHtml(f.recommended_action)}</p>`
              : ''
          }
          ${
            // Dropped entirely at zero. Stock Cover cites no rows at all, and
            // "Based on 0 source records" is a sentence that says nothing.
            evidence > 0
              ? `<p style="margin: 0; font-size: 13px; color: #6b7280;">Based on ${evidence} source record${evidence === 1 ? '' : 's'}.</p>`
              : ''
          }
        </div>`;
    })
    .join('');

  return `
    <div style="font-family: sans-serif; max-width: 640px; color: #111;">
      <h2 style="margin: 0 0 4px;">Vyso — your week in one page</h2>
      <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">${escapeHtml(orgName)}</p>
      <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5;">
        ${findings.length} open finding${findings.length === 1 ? '' : 's'} from your supplier documents,
        your debtors book and your stock — biggest rand figure first.
      </p>
      ${items}
      <p style="margin: 24px 0 0;">
        <a href="${APP_URL}" style="background: #1F5FA8; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 15px;">
          Open the Brief
        </a>
      </p>
      <p style="margin: 24px 0 0; color: #6b7280; font-size: 13px;">
        Vyso's agents observe and recommend — nothing has been actioned on your behalf.
      </p>
    </div>`;
}

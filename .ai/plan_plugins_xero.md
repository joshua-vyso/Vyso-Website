# Plan: Plugins — Xero (rail section, plugin page, Xero sync, Xero Watch agent, Hubdoc cross-upload)

Status: **approved by Josh 2026-08-18** ("a separate section for integrations that has all integrations in one place
(call the section Plugins, just above the under the hood section) that highlights findings, cross uploads invoices to
HubDoc, and has an agent flag any issues. We'll do this just for Xero for now"). Architect: Fable. Implementers: Opus,
two waves on `main` (X1 then X2).

## Verified starting point (survey 2026-08-18)
- Xero: `lib/platform/xero.ts` (OAuth connect/callback, `getXeroAccessToken` refresh w/ CAS, `disconnectXero`),
  `lib/platform/xero-core.ts` (crypto/URL/JWT helpers, tested), routes `app/api/integrations/xero/{connect,callback,
  status,disconnect}`, UI `components/platform/settings/XeroIntegrationCard.tsx` on `/app/settings`, schema
  `supabase/xero-integration.sql` (`xero_authorisations`, `xero_connections` (org_id unique, status), `xero_credentials`
  (AES-GCM), `xero_oauth_states`, and UNUSED `xero_entity_mappings`, `xero_sync_cursors`, `xero_sync_events`).
  Scopes: `offline_access accounting.invoices accounting.contacts accounting.settings.read accounting.payments.read`.
  **No Xero data endpoint is called anywhere; no sync; no webhook; no cron.** Connected = `xero_connections` row with
  `status in ('connected','syncing')` (`error`/`reauth_required` = linked but degraded).
- Hubdoc: zero references. Hubdoc's supported intake is **email** (each Hubdoc org has an upload address). Xero Files API
  is not used and would need the `files`/`accounting.attachments` scope (re-consent). → v1 cross-upload = email the
  document to the org's Hubdoc address via Resend (attachments supported by Resend; none used in repo yet). Doc-U files
  are downloadable server-side (`app/api/ai/extract/route.ts:50` pattern).
- Rail: `AppRail.tsx` bottom cluster = `<UnderTheHood/> <UserChipMenu/>`; `UnderTheHood.tsx` is the collapsible
  eyebrow+rows idiom to copy. Agents skeleton: `lib/platform/debtors-watch/*`, `app/api/agents/debtors-watch/route.ts`,
  `lib/platform/agents/{org-allowlist,finding-kinds,dedupe-keys}.ts`, `brief-display.ts` chips, `agent-findings.ts`
  evidence resolvers (stock = "Subject from dedupe key" pattern). Access: `lib/platform/access.ts` (`canSeeMoney`).

## Product rules
- **Plugins is finance-grade**: visible to owner/admin only (`canSeeMoney`); members never see the section or routes.
- **Nothing sends itself by default.** "Send to Hubdoc" is a per-document button. An org-level "auto-forward new
  supplier invoices to Hubdoc" toggle exists, **default off**, labelled as a standing instruction the owner is giving;
  every forward is logged and visible.
- Findings say only what Xero rows prove; Xero deep-links are allowed (`https://go.xero.com/...`).
- Meridian (demo) has no Xero → the plugin page shows the connect state; never demo TnS data to a prospect.

## X1 — Plugin section + page, Xero sync, Xero Watch agent, Finch snapshot tool

### Rail + routes
- `components/platform/shell/Plugins.tsx`: eyebrow **"Plugins"** with the same collapsible idiom as Under the hood,
  rendered ABOVE `<UnderTheHood/>` in `AppRail.tsx` (and `MobileDrawer`), only when `canSeeMoney`. Rows = plugin
  registry `lib/platform/plugins.ts` (`PLUGINS = [{key:'xero', label:'Xero', href:'/app/plugins/xero', icon}]`), each
  with a status dot: connected (green), needs attention (`reauth_required|error` amber), not connected (grey) — the
  layout fetches `xero_connections.status` (RLS member-select policy exists) once and passes it down. Collapsed by
  default? **No — expanded** (one row; keep the chevron for parity).
- `app/app/plugins/page.tsx` (index: the same list as cards) and `app/app/plugins/xero/page.tsx` (server, admin-gated →
  `redirect` to first module for others, same helper as v2b). Page sections: **Connection** (move the connect/disconnect
  UI out of `XeroIntegrationCard` into `components/platform/plugins/XeroConnection.tsx`; `/app/settings` keeps a one-line
  link "Manage in Plugins → Xero" instead of the card), **Snapshot** (from the mirror: receivables outstanding/overdue,
  payables due 7d/overdue, last synced, "Sync now" button → POST sync route, admin, rate-limited 6/hour), **Findings from
  Xero** (open `agent_findings` where `agent='xero_watch'`, same `FindingCard`; empty state), **Hubdoc** placeholder card
  "Cross-upload to Hubdoc — coming in the next update" (X2 replaces it).

### Sync + mirror
- `supabase/xero-sync.sql`: `xero_invoices` mirror `(id uuid pk, org_id, xero_invoice_id text unique per org, type
  'ACCREC'|'ACCPAY', contact_id, contact_name, invoice_number, reference, date, due_date, currency, total, amount_due,
  amount_paid, status, updated_date_utc, xero_url, synced_at)`, `xero_contacts` `(org_id, xero_contact_id, name,
  email, is_supplier, is_customer, updated_date_utc)`; use the existing `xero_sync_cursors` for `If-Modified-Since`
  per resource; RLS: admin-select via the org policy + `canSeeMoney` enforced in routes (mirror rows are money);
  service-role writes only.
- `lib/platform/xero-sync.ts`: `syncXeroOrg(supabase(service), orgId)` → token via `getXeroAccessToken` → GET
  `https://api.xero.com/api.xro/2.0/Invoices` (paged, `If-Modified-Since`, both types; `Statuses` all except DELETED),
  `Contacts` (paged) → upsert mirror, advance cursor, set `xero_connections.last_synced_at/status/last_error`. Respect
  rate limits (60/min): page sequentially, back off on 429 (`Retry-After`). Pure mappers exported + tested (`tests/
  xero-sync.test.ts` with fixture payloads). Route `app/api/integrations/xero/sync/route.ts`: GET (cron, `Bearer
  CRON_SECRET`, all connected orgs) and POST (signed-in admin, own org, rate-limited). Cron `20 3 * * *`.

### Xero Watch agent (`xero_watch`)
`lib/platform/xero-watch/{detect,run}.ts`, route `/api/agents/xero-watch` cron `30 3 * * *`, chip "Xero" (info tone),
`evidenceKindOf → 'xero'` (new kind: resolver rebuilds subject from dedupe key + `xero_invoices` rows; heading "Subject",
link to `xero_url` and, when a Doc-U doc is cited, `/app/docu/[id]`). Rules (pure, table-tested):
1. **Connection health**: `status in ('reauth_required','error')` or last sync > 48 h → "Xero needs re-authorising —
   nothing has synced since {date}" (rand null; action "Reconnect in Plugins → Xero"); dedupe `xero_watch:health:{org}:
   {iso-week}`.
2. **Not in Xero yet**: Doc-U supplier invoices (`documents` type invoice, status extracted/reviewed/approved, dated in
   the last 45 d, with supplier + invoice number) that have no `xero_invoices` ACCPAY row matching normalised invoice
   number (+ supplier name similarity ≥ 0.6 via `procurepulse/matching.ts` dice) → ONE finding per day-batch: "{N}
   supplier invoices Doc-U has read aren't in Xero yet (R{sum})" listing up to 5 (supplier, number, total); action
   "Send them to Hubdoc from Plugins → Xero"; evidence_refs = the document ids; dedupe `xero_watch:missing:{org}:{iso-week}`.
3. **Overdue receivables per Xero**: ACCREC AUTHORISED with `amount_due>0` and due > 30 d → per contact ≥ R5,000 →
   "{Contact} owes R{x} on {n} Xero invoices, oldest {d} days" (rand = amount); dedupe `xero_watch:ar:{contact_id}:
   {oldest_invoice_id}`. **Suppress when a `debtors_watch` finding for a same-named customer is open** (avoid two cards
   for one debtor; note in code).
4. **Payables due this week**: ACCPAY AUTHORISED due within 7 d → one card "R{sum} of supplier bills fall due by
   {date} ({n} bills; biggest {supplier} R{x})"; rand null; dedupe `xero_watch:ap:{org}:{iso-week}`.
5. **Duplicates**: two ACCPAY with same normalised number + contact → "Possible duplicate bill {number} from {supplier}
   (R{x} twice)"; rand = amount; dedupe per pair.
Findings render on the Brief like any other; the plugin page filters them.

### Finch
`xero_get_snapshot` (admin; brief + orderflow modules): receivables/payables totals + overdue by contact from the
mirror + `not_in_xero` count; knowledge paragraph. Cheap.

### Files (X1)
Create: `lib/platform/plugins.ts`, `components/platform/shell/Plugins.tsx`, `app/app/plugins/{page,xero/page}.tsx`,
`components/platform/plugins/{XeroConnection,XeroSnapshot,XeroFindings,PluginCard}.tsx`, `supabase/xero-sync.sql`,
`lib/platform/xero-sync.ts` (+ `-shared.ts` pure), `app/api/integrations/xero/sync/route.ts`,
`lib/platform/xero-watch/{detect,run}.ts`, `app/api/agents/xero-watch/route.ts`, `lib/ai/finch/xero-data.ts`, tests
`tests/xero-sync.test.ts`, `tests/xero-watch-detect.test.ts`. Modify: `AppRail.tsx`, `MobileDrawer.tsx`, `app/app/
layout.tsx` (fetch plugin status), `app/app/settings/page.tsx` (link instead of card), `agents/{finding-kinds,
dedupe-keys}.ts`, `agent-findings.ts` (xero evidence), `brief-display.ts`, `vercel.json` (2 crons), `lib/ai/finch/
{tools,knowledge}.ts`, `.env.example` (nothing new — `XERO_CLIENT_ID/SECRET/REDIRECT` already exist? verify names),
`docs/demo-runbook.md` (a Plugins paragraph), `.ai/implementation.md`.
Do not touch: `lib/platform/xero-core.ts` semantics, other agents, chat components beyond tool registration.

## X2 — Hubdoc cross-upload
- `supabase/hubdoc.sql`: `org_integrations_hubdoc (org_id pk, intake_email text, auto_forward boolean default false,
  updated_by, updated_at)`; `hubdoc_forwards (id, org_id, document_id, sent_at, resend_message_id, status
  'sent'|'failed', error, triggered_by 'user'|'auto')` unique `(document_id)` (a document is forwarded once; "Send
  again" is an explicit override that inserts a new row with `resend:true` — decide: allow, log both).
- Settings on the plugin page (Hubdoc card): intake email (validated `@upload.hubdoc.com` or any email with a warning),
  auto-forward toggle (default off; copy: "Forward every new supplier invoice Doc-U reads to Hubdoc automatically. You
  are giving Vyso a standing instruction; every forward is logged below."), forwards log (last 50, status, link to doc).
- `lib/platform/hubdoc.ts`: `forwardDocumentToHubdoc(supabase(service or RLS+service for storage), orgId, documentId,
  triggeredBy)` → download from Storage (15 MB cap; reject bigger with a clear error) → Resend `attachments:[{filename,
  content}]`, subject = supplier + invoice number, from the platform sender, reply-to none → log row. Never sends for
  documents that aren't supplier invoices/statements/bills (`document_type in ('invoice','statement')` and not
  customer-side).
- Surfaces: "Send to Hubdoc" button on `/app/docu/[id]` (admin, when Xero plugin connected + intake email set), bulk
  from the plugin page's "Not in Xero yet" list (one click per doc, or "Send all N"), and the Xero Watch "not in Xero"
  finding's recommended action links to that list. Auto mode: `app/api/ai/extract/route.ts` `after()` → if org toggle
  on and doc qualifies → forward.
- Chat: `hubdoc_forward_document` tool? **No** — outbound; keep it a button (drafts-only spirit).
- Tests: pure eligibility + subject builder; Resend call mocked. Runbook section.

## Edge cases
Xero rate limit 429 → back off, partial sync recorded; multi-currency → show currency, no FX; a Vyso org that
disconnects → mirror kept but page shows disconnected, agent's health rule fires once; invoice numbers with prefixes
("INV-9268" vs "9268") → normalise digits+letters; contact name variants → dice ≥ 0.6, else "not matched" (no
false "missing"); Hubdoc address unset → buttons disabled with hint; attachment > 15 MB → error surfaced, logged failed.

## Verification
Unit tests for mappers/detectors/eligibility; tsc/test/build/lint gates; `.ai/implementation.md` sections "Plugins X1"
/"X2"; report the SQL files Josh must paste (`xero-sync.sql`, then `hubdoc.sql`) and the curls to run one sync + one
Xero Watch tick against TnS's org id (Josh supplies it — do not print TnS data).

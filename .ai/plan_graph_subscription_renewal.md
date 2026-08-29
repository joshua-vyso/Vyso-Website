# Plan: Automatic Microsoft Graph subscription renewal

Author: Fable (architect). Implementer: subagent. Date: 2026-08-29. USER-APPROVED (implementation pre-approved; NO deploy).

## Goal

Daily Vercel cron renews the existing orders@turnnslice.com Inbox subscription when it is within 48h of expiry; otherwise no-op. Subscription lifecycle operation ONLY: no mailbox reads/writes, no recreation, no ImmutableId switch, MICROSOFT_GRAPH_ID_TYPE stays rest_id, notification URL/resource/changeType untouched (renewal already PATCHes expirationDateTime only — keep it that way).

## Audit facts (verified; cite before reuse)

- Reuse surface: `getMicrosoftGraphAppToken()`, `inspectMicrosoftOrderInboxSubscription(accessToken)`, `renewMicrosoftOrderInboxSubscription(accessToken)` (lib/platform/microsoft-graph.ts:55-93); core `getMicrosoftGraphSubscription`/`renewMicrosoftGraphSubscription` take positional `fetchImpl` for tests; `SUBSCRIPTION_LIFETIME_MS` = 6 days (Graph max 7 for this resource); `redact()` protects secrets in every thrown Graph error.
- Cron auth convention (copy verbatim from app/api/email/process/route.ts:27-33): CRON_SECRET bearer; 503 when unset, 401 on mismatch. maxDuration 60 for cheap ticks. Response `NextResponse.json({ ok: true, ... })` / `{ error }` + 4xx/503. Logging: `console.error('<name>: ...', message)`.
- Empty MICROSOFT_GRAPH_SUBSCRIPTION_ID → wrappers throw a clear error (fail closed). No cron-outcome table exists; docs (docs/microsoft-graph-notifications.md:199-214) defer persistence to a future integration-config record — do NOT build a table now.
- The admin CLI's NODE_ENV==='production' refusal is CLI-specific — do not copy it into the route.

## Build

1. **Pure decision helper** in `lib/platform/microsoft-graph-core.ts` (framework-free, beside the other subscription helpers):
   `microsoftGraphRenewalDecision({ expirationDateTime, now, thresholdMs = 48 * 60 * 60_000 })` → `'skip' | 'renew' | 'expired' | 'invalid'`:
   - unparseable/missing expirationDateTime → 'invalid'
   - expiration <= now → 'expired' (renewal of a dead subscription fails on Graph's side; we surface it, we never recreate)
   - expiration - now <= thresholdMs → 'renew'
   - else → 'skip'
   House-style comment: why 48h (daily cron + 6-day lifetime → renews ~every 4 days, tolerates two missed ticks before risk), why 'expired' is surfaced not repaired (recreation is a deliberate manual/documented cutover, never a cron side effect).
2. **Orchestration helper** (same file, testable with fetchImpl): `runMicrosoftGraphSubscriptionRenewal({ accessToken, subscriptionId, now?, thresholdMs?, fetchImpl? })` → `{ action: 'skipped' | 'renewed', expiresAt: string }`, throwing `MicrosoftGraphHttpError`/Error for: GET failure (incl. 404 missing), 'expired', 'invalid', PATCH failure. GET first (Graph is the source of truth — this is what makes repeated ticks idempotent), decide, PATCH only on 'renew' with the default 6-day expiration. Never issues any request other than GET/PATCH `/subscriptions/{id}` — state that in a comment.
3. **Route** `app/api/integrations/microsoft/renew-subscription/route.ts`:
   - `export const maxDuration = 60;`
   - CRON_SECRET auth copied verbatim (503 unset / 401 mismatch).
   - Guards: `!microsoftGraphConfigured` → 503 `{ error: 'Microsoft Graph is not configured.' }`; empty subscription id (wrapper throws) → 503 with the wrapper's message. Both make misconfiguration VISIBLE as a failed cron run.
   - Happy path: token → `runMicrosoftGraphSubscriptionRenewal` via the server wrappers/config → `NextResponse.json({ ok: true, action, expiresAt })`.
   - Failure path: try/catch → `console.error('microsoft-renew: run failed', message)` (message already redact()ed by core; never log tokens/clientState/secret — do not add any logging of config values) → `NextResponse.json({ error: message }, { status: 502 })` so Vercel marks the run failed and it shows in cron logs.
4. **Cron**: add to vercel.json `{ "path": "/api/integrations/microsoft/renew-subscription", "schedule": "10 3 * * *" }` (fits the hour-3 convention, unused offset).
5. **Docs**: update docs/microsoft-graph-notifications.md "Expiration and renewal" section — automated renewal now exists; manual renew CLI remains for emergencies; recreation still manual by design.

## Tests (tests/microsoft-graph.test.ts additions or a focused new file; node --test, fetchImpl stubs, fixed `now` — no network)

- decision: 5 days out → 'skip'; 47h → 'renew'; exactly threshold boundary behavior pinned; past expiry → 'expired'; malformed/missing date → 'invalid'.
- orchestration far-from-expiry: GET returns +5d → action 'skipped', ZERO PATCH requests issued (assert recorded requests).
- near-expiry: GET +40h → exactly one PATCH to `/subscriptions/{id}` with body `{ expirationDateTime }` only; action 'renewed'.
- expired: GET returns past date → throws, no PATCH.
- missing subscription: GET 404 → throws MicrosoftGraphHttpError, no PATCH, no POST.
- Graph renewal failure: PATCH 503 → throws with redacted message (assert no accessToken substring in message).
- malformed subscription response: GET 200 with no expirationDateTime → throws, no PATCH.
- no duplicate creation / no mailbox ops: across ALL of the above, assert every recorded request URL is `/subscriptions/{id}` and method ∈ {GET, PATCH} — no POST /subscriptions, no /messages, no /mailFolders.

## Constraints

- Do not touch: webhook route, ingest paths, ImmutableId plumbing, the admin CLI, MICROSOFT_GRAPH_ID_TYPE semantics.
- No new env vars (CRON_SECRET and MICROSOFT_GRAPH_SUBSCRIPTION_ID already exist in Vercel; note in the report that both being present in prod is the only manual prerequisite).
- No DB writes, no new tables, no deploy, no commits/push.

## Verification

npx tsc --noEmit (0), npm run lint (0 new), npm test (green), npm run build (succeeds). Write `.ai/implementation_graph_subscription_renewal.md` answering the user's 8 completion points.

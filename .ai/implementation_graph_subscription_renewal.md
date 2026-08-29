# Implementation: Automatic Microsoft Graph subscription renewal

Plan: `.ai/plan_graph_subscription_renewal.md`. Implementer: subagent. Date: 2026-08-29.

## 1. Existing renewal architecture reused

- `getMicrosoftGraphAppToken()` (`lib/platform/microsoft-graph.ts:57`) — app-only token, unchanged.
- `getMicrosoftGraphSubscription` / `renewMicrosoftGraphSubscription` (`lib/platform/microsoft-graph-core.ts:704`, `:721`) — the GET/PATCH transport, unchanged; both take a positional `fetchImpl` for tests.
- `MicrosoftGraphHttpError` (`:165`) and `redact()` (`:239`) — every thrown Graph error is already redacted before it reaches a log or an HTTP response; no new redaction logic was written.
- `SUBSCRIPTION_LIFETIME_MS` (`:23`, 6 days) — read via `microsoftGraphSubscriptionExpiration()`, which the reused `renewMicrosoftGraphSubscription` already calls by default; the new code never hardcodes the lifetime.
- `microsoftGraphConfigured` and the `requireMicrosoftGraphConfig()` fail-closed pattern (`lib/platform/microsoft-graph.ts`) — reused as-is; one new sibling boolean (`microsoftGraphSubscriptionConfigured`) was added following the exact same shape, see §2.
- CRON_SECRET bearer-auth + `maxDuration` + response-shape convention, copied verbatim from `app/api/email/process/route.ts:23-33` (503 unset / 401 mismatch / `{ok:true,...}` / `{error}`).

No existing function's signature, behavior, or call sites were changed — only additive exports.

## 2. Files changed

- `lib/platform/microsoft-graph-core.ts` — added `microsoftGraphRenewalDecision()` (pure decision helper) and `runMicrosoftGraphSubscriptionRenewal()` (GET-then-decide-then-PATCH orchestrator), plus the `MicrosoftGraphRenewalDecision` / `MicrosoftGraphRenewalResult` types. Framework-free, beside the other subscription helpers, no new imports.
- `lib/platform/microsoft-graph.ts` — added `microsoftGraphSubscriptionConfigured` (boolean guard, mirrors `microsoftGraphConfigured`'s shape) and `runMicrosoftOrderInboxSubscriptionRenewal()` (thin wrapper binding the core orchestrator to the configured mailbox's subscription id, same pattern as `renewMicrosoftOrderInboxSubscription`).
- `app/api/integrations/microsoft/renew-subscription/route.ts` (new) — the cron-facing `GET` handler.
- `vercel.json` — added cron entry `{ "path": "/api/integrations/microsoft/renew-subscription", "schedule": "10 3 * * *" }`.
- `docs/microsoft-graph-notifications.md` — rewrote "Expiration and renewal" to describe the automated cron path; manual `npm run microsoft:subscription:renew` kept as the documented emergency/verification path.
- `tests/microsoft-graph.test.ts` — 12 new tests appended (decision: 5; orchestration: 7), described in §6.

Nothing else was touched: webhook route, ingest paths, ImmutableId plumbing, the admin CLI (`scripts/manage-microsoft-graph-subscription.ts`), and `MICROSOFT_GRAPH_ID_TYPE` semantics are all untouched.

## 3. Cron schedule

Daily at `10 3 * * *` (03:10 UTC) — an unused offset in the existing hour-3 block of crons in `vercel.json` (email process at :00, Xero sync :20, xero-watch :30, doc-watch :40, price-watch :45, debtors-watch :50, stock-cover :55).

## 4. Renewal threshold

48 hours, default parameter on `microsoftGraphRenewalDecision`. Rationale (also in the code comment): the subscription's max lifetime here is 6 days (`SUBSCRIPTION_LIFETIME_MS`), and the cron runs daily, so a healthy subscription is renewed roughly every 4 days. A 48h trigger window therefore tolerates two consecutive missed cron ticks before the subscription is at real risk of lapsing.

Decision states: `'skip'` (> threshold remaining), `'renew'` (≤ threshold, > 0 remaining), `'expired'` (≤ 0 remaining — Graph will reject a PATCH against a dead subscription, so this is surfaced as a thrown error rather than silently recreated), `'invalid'` (missing/unparseable `expirationDateTime` from Graph — also thrown, never guessed at).

## 5. Auth/safety behavior

- CRON_SECRET bearer auth copied verbatim: unset secret → 503; header mismatch → 401.
- `!microsoftGraphConfigured` → 503 `{ error: 'Microsoft Graph is not configured.' }`.
- `!microsoftGraphSubscriptionConfigured` (empty `MICROSOFT_GRAPH_SUBSCRIPTION_ID`) → 503 with the same message the existing wrappers throw, but via a boolean guard (mirroring `microsoftGraphConfigured`'s own style) rather than a caught exception — avoids brittle string-matching in the route's catch block while producing the same outcome the plan specified.
- Every other failure (Graph HTTP error, `'expired'`, `'invalid'`) is caught, logged via `console.error('microsoft-renew: run failed', message)`, and returned as `{ error: message }` with **502** — so Vercel marks the cron run failed and it is visible in cron logs. `message` is always the already-`redact()`ed string from `MicrosoftGraphHttpError`/core; the route adds no logging of tokens, the client secret, or `clientState`.
- Request surface: `runMicrosoftGraphSubscriptionRenewal` issues only `GET /subscriptions/{id}`, and — only on the `'renew'` decision — exactly one `PATCH /subscriptions/{id}` with body `{ expirationDateTime }`. No `POST /subscriptions`, no `/messages`, no `/mailFolders`, no ImmutableId header change. GET-first means every tick re-derives its decision from Graph's actual current state, which is what makes repeated ticks (e.g. a retried cron invocation) idempotent — a tick run right after a successful renewal just observes the new expiration and skips.

## 6. Tests / results

`tests/microsoft-graph.test.ts`, `node --test`, fetchImpl stubs + fixed `now` (`2026-08-29T00:00:00.000Z`), zero network calls. 12 new tests, all passing (full suite: 1209/1209 pass, 0 fail):

Decision (5):
1. far from expiry (5 days) → `'skip'`
2. inside the 48h window (47h) → `'renew'`
3. boundary pinned: exactly 48h remaining → `'renew'`; 48h + 1ms → `'skip'`
4. past expiry → `'expired'`
5. malformed/missing `expirationDateTime` (`'not-a-date'`, `null`, `undefined`) → `'invalid'`

Orchestration (7):
6. far-from-expiry: GET only, `action: 'skipped'`, zero PATCH requests
7. near-expiry (GET +40h): exactly one PATCH to `/subscriptions/{id}` with body `{ expirationDateTime }` (single key, valid ISO string), `action: 'renewed'`
8. expired: GET returns a past date → throws, zero PATCH
9. missing subscription: GET 404 → throws `MicrosoftGraphHttpError` (httpStatus 404), zero PATCH
10. Graph renewal failure: GET ok, PATCH 503 → throws, message asserted to exclude the raw access-token substring
11. malformed subscription response: GET 200 with no `expirationDateTime` → throws (via `parseSubscription`'s own required-field check), zero PATCH
12. cross-cutting: every recorded request in tests 6–11 is asserted (`assertOnlySubscriptionRequests`) to be `GET`/`PATCH` against `https://graph.microsoft.com/v1.0/subscriptions/subscription-id` only — no POST, no `/messages`, no `/mailFolders`

## 7. Manual env/config required

None new. `CRON_SECRET` and `MICROSOFT_GRAPH_SUBSCRIPTION_ID` already exist in Vercel (per the plan's audit) — their presence in prod is the only manual prerequisite for this route to run successfully. No new environment variables were introduced.

## 8. Safe-to-deploy assessment

Code is ready to deploy (not deployed, per instructions — no commit/push/deploy performed):

- All four verifications pass: `npx tsc --noEmit` → 0 errors; `npm run lint` → 0 errors/warnings in any file this change touched (the 50 errors / 40 warnings `npm run lint` reports are 100% pre-existing, in unrelated files — `components/platform/vyso-ai/*`, `components/platform/wastewatch/*`, `lib/platform/price-watch/run.ts`, `lib/platform/wastewatch-data.ts`, `lib/posthog-server.ts`, `instrumentation-client.ts` — none touched by this change); `npm test` → 1209/1209 pass; `npm run build` → succeeds, and the new route appears in the build's route table as `ƒ /api/integrations/microsoft/renew-subscription`.
- Mailbox stays read-only: the only Graph calls this code path can ever issue are `GET`/`PATCH` on `/subscriptions/{id}`, enforced structurally (the orchestrator calls exactly those two reused functions and nothing else) and pinned by test 12 above.
- Fail-closed on misconfiguration (both guards return 503, visible as a failed/skipped cron run rather than a silent no-op) and fail-loud on a genuine Graph error (502, visible in Vercel cron logs) — no failure mode is silent.
- No secrets are logged or returned: `redact()` already strips the access token, and the route logs only the already-redacted `message`.
- No deviations from the plan. One implementation-level judgment call not spelled out verbatim in the plan: the "empty subscription id → 503" guard is implemented as a new boolean (`microsoftGraphSubscriptionConfigured`, mirroring `microsoftGraphConfigured`) rather than a string-matched catch of the wrapper's thrown message — same observable behavior (503, same message text), more robust than matching on error text.

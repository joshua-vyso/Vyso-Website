# Plan: "The Brief" — new /app landing page

Approved by Josh 2026-08-13: build now (empty until Price Watch runs), lives at /app
as the landing, chat wired to Finch. Design source: `.ai/design/vyso-brief/Vyso - The
Brief.dc.html` screen 1a + design-system readme. Branch: `feat/ui-brief-reskin`.
Commit per wave (usage-limit safety).

## Architecture ruling

Additive only. `/app` (`app/app/page.tsx`) is currently a redirect to the first
enabled module — it becomes a rendered server component. No existing module, route,
or layout changes EXCEPT: `POST_LOGIN_ROUTE` in `app/login/page.tsx` now points to
`/app`. The page renders INSIDE the existing TopBar+wash shell (`app/app/layout.tsx`
untouched); the design's 216px rail is part of the page's own two-column layout —
deliberate deviation from the mock (which has no top bar) to avoid restructuring the
shell. Findings read through the caller's RLS-scoped client (agent_findings has the
org policy) — no service role in UI paths.

## Wave A — data layer + page (Opus)

Create `lib/platform/agent-findings.ts`:
- Types mirroring the `agent_findings` schema (see `supabase/agents-price-watch.sql`).
- `fetchFindings(...)`: open findings (new/in_progress) newest-impact-first
  (rand_impact desc nulls last, created_at desc), plus resolved/dismissed for History.
  MUST tolerate the table not existing yet (migration may not be pasted): catch
  42P01/relation-missing via the `db-errors.ts` house helpers and return an
  empty+flagged result — never crash the landing page.
- Dismiss/restore mutation following the house pattern for module mutations (inspect
  one existing module write path and copy its shape exactly — server action vs route).

Replace `app/app/page.tsx` (redirect → rendered Brief):
- Left rail (216px): VysoMark; "Today's brief" with open-count chip; "History"
  toggle; "UNDER THE HOOD" label + module list (same source TopBar uses — MODULES
  filtered by `session.features`, linking to `screens.desktop`); user chip (initials,
  first name, org name) at the bottom.
- Header: uppercase eyebrow — weekday/date (SAST) · org name; greeting
  "Morning|Afternoon|Evening {firstName}." + when open findings exist: "N things need
  your attention — one is worth R{maxImpact} a year." with the rand figure in the
  orange→blue gradient text (the sanctioned AI-voice gradient). The ✦ line derives
  ONLY from real data (e.g. "N open findings across M suppliers") — never fabricate
  activity claims.
- Finding cards per the design: gradient left accent bar on status=new; agent chip
  (tone-colored, e.g. PRICE WATCH = warning pair); relative time; observation text;
  large `≈ R{rand_impact}/yr` in Space Grotesk; evidence link "{n} invoices ↗" →
  Doc-U (link to the document route with the evidence_refs ids — inspect Doc-U's URL
  shape and use its real pattern); `recommended_action` as a quiet supporting line
  (the mock's per-finding action BUTTONS like "Draft supplier email" are deferred —
  they are features, not styling); Dismiss (wired). Resolved/dismissed cards render
  collapsed/struck-through per the mock, under History.
- Empty state (no rows) and table-missing state: designed card, "No findings yet —
  Price Watch reads your invoices nightly", never an error screen.
- Chat bar: render the design's gradient-border pill (✦ placeholder "Ask Vyso
  anything about your operation…", hint line below) but DISABLED in this wave.
- Verify ModuleLockGuard/TrialGate let `/app` itself render for all orgs.
- Update `POST_LOGIN_ROUTE` to `/app`.
- Next 16: read `node_modules/next/dist/docs/` before route/page work (AGENTS.md).

## Wave B — chat wired to Finch (after A commits)

- Reuse `components/platform/finch/useFinchStream.ts` + the existing `app/api/ai/agent`
  route. If the runtime requires a module key, extend Finch's own extension point
  (new AgentModule entry + knowledge doc per `lib/ai/finch/config.ts`'s documented
  pattern) — 'brief' module scoped to answering questions about open findings.
- Tap a finding → prefills the chat input referencing it ("Tap any finding to bring
  it into the conversation").
- v1 answers are text-only (the mock's inline charts/tool-status lines are later).

## Out of scope

Mobile companion (1e), chat charts (1b), finding-detail screen (1c), suppliers table
(1d), per-finding action buttons (draft email etc.), realtime refresh, removing the
top bar. No new dependencies.

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run test`; dev-server screenshot of /app
with the table-missing state (pre-migration) — and with seeded rows if the migration
is applied by then. Marketing + module screens untouched.

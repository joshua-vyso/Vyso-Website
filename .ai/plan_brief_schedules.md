# Plan: Brief notification schedules — per-user times of day, morning/evening briefs by email

Status: **approved by Josh 2026-08-18** ("have a setting that lets users choose how often to receive brief
notifications, what time of day they want them at… one to view overnight changes in the morning, and one after
work to view how the day went"). Architect: Fable. Implementer: one Opus agent on `main`.

Repo facts: digest today = `app/api/agents/digest/route.ts`, Vercel cron `0 4 * * 1`, sends ONE email to env
`PRICE_WATCH_DIGEST_TO` per allowlisted org (Resend, HTML), reads all `agent_findings` (Phase C: mixed agents,
informational filtered, cap 5). Brief ranking lives in `lib/platform/brief-feed.ts` (`rankFindings`,
`splitForToday`); access rule `lib/platform/access.ts` (`canSeeBrief`); SAST helpers `lib/platform/sast.ts`;
settings page `app/app/settings/*` (`pp_settings`, profile); RLS pattern org+owner from `supabase/finch-chats.sql`;
Resend patterns in `app/api/contact/route.ts` / digest; `profiles` (id, org_id, role, name…), user email from
`auth.users` (service role) or `profiles.email` if present — implementer verifies which exists.

## 1. Goal & acceptance
1. **Setting** at `/app/settings` → section "Brief notifications" (visible only to users with `canSeeBrief`;
   members see nothing here — the Brief is admin-only): a list of up to **4** slots, each `{time HH:MM (SAST),
   days: Mon–Sun toggles, kind: 'morning' | 'evening' | 'custom', enabled}`; defaults offered on first visit:
   **07:00 Mon–Sat "Overnight brief"** and **17:30 Mon–Fri "End-of-day brief"** (unsaved until the user clicks
   Save). Channel: email to the signed-in user's address (shown read-only). "Send me a test now" button.
   Timezone fixed to Africa/Johannesburg for v1 (label says so; column exists for later).
2. **Delivery**: a cron `/api/agents/brief-notify` runs **every 15 minutes** (`*/15 * * * *`); for each enabled
   slot whose SAST wall-clock time falls in the just-elapsed 15-minute window on an enabled day, and no
   `brief_deliveries` row exists for `(schedule_id, local_date)`, it composes and sends the email, then inserts
   the delivery row (idempotent; a second run in the same window sends nothing). Service-role client, `.eq('org_id')`
   everywhere, org allowlist via `lib/platform/agents/org-allowlist.ts`, `Bearer CRON_SECRET`, `maxDuration ≤ 60`.
3. **Content** = the Brief, not a dump: subject "{Org} — your {morning|evening} brief, {Tue 18 Aug}"; body:
   greeting line with the true open count; the top **4** open findings by `rankFindings` (headline, rand line,
   evidence noun, deep link to `/app/finding/[id]`); "{N} other items → full briefing" link to `/app?view=all`;
   a **"since your last brief"** block (findings created / resolved / dismissed since the previous delivery for
   this user, and doc_watch cards read since then — for the evening one this is "how the day went"); footer with
   "Manage brief notifications" → `/app/settings#brief-notifications`. Only what rows prove; empty sections omitted;
   drafts-only rule irrelevant (this is Vyso mailing its own user). Plain, monochrome HTML matching the existing
   digest template; reuse its helpers rather than a second renderer.
4. **Legacy digest**: keep `/api/agents/digest` (Monday cron) working ONLY as a fallback when the org has **no
   enabled schedules** and `PRICE_WATCH_DIGEST_TO` is set; document that schedules supersede it.
5. Gates green; tests for the pure parts (slot-window matching incl. DST-free SAST, dedupe by local date, "since
   last brief" diffing, ranking reuse).

## 2. Data
`supabase/brief-schedules.sql` (idempotent, house style, RLS org+owner like `finch_chats`):
```sql
create table if not exists brief_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'custom' check (kind in ('morning','evening','custom')),
  local_time time not null,                       -- wall clock in `timezone`
  timezone text not null default 'Africa/Johannesburg',
  days int[] not null default '{1,2,3,4,5}',      -- ISO weekday 1=Mon..7=Sun
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists brief_deliveries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references brief_schedules(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null,
  local_date date not null,
  sent_at timestamptz not null default now(),
  finding_ids uuid[] not null default '{}',       -- what was in the email (for "since your last brief")
  unique (schedule_id, local_date)
);
```
Indexes: `brief_schedules (org_id, enabled)`, `brief_deliveries (user_id, sent_at desc)`. Max 4 schedules per user
enforced in the data module (and a check via trigger is NOT required — comment why).

## 3. Code
- `lib/platform/brief-schedules.ts` (RLS, caller's client): `listSchedules(userId)`, `upsertSchedules(userId,
  slots[])` (replace-all semantics, ≤4, validate time/days), `defaultSlots()`; pure `-shared.ts`: `slotIsDue(slot,
  nowUtc, windowMinutes=15)`, `localDateFor(slot, nowUtc)`, `sinceLastBrief(prevDelivery, findings)`.
- `lib/platform/brief-notify.ts` (service role): `runBriefNotify(supabase, orgId, nowUtc)` → for each due slot →
  `composeBriefEmail(...)` → Resend → `brief_deliveries` insert; returns a summary like the other agents.
- `app/api/agents/brief-notify/route.ts` (copy price-watch route shape) + `vercel.json` `*/15 * * * *`.
- `app/api/settings/brief-schedules/route.ts` (GET/PUT for the signed-in user; POST `?test=1` sends one now to the
  caller — rate-limit 3/hour/user via `lib/platform/rate-limit.ts`).
- `components/platform/settings/BriefNotifications.tsx` (client; time inputs, day toggles, kind pill, add/remove,
  Save, "Send me a test now"; empty state offers the two defaults) mounted in the settings page for admins only.
- Recipient email: read from `auth.users` via the service client in the cron (`auth.admin.getUserById`) — never
  stored in `brief_schedules`; the settings UI shows `session.email`.
- `app/api/agents/digest/route.ts`: skip orgs that have ≥1 enabled schedule; comment.
- `.env.example`: no new vars (RESEND_API_KEY, CRON_SECRET, AGENTS_ORG_IDS already documented).
- `docs/demo-runbook.md`: short section (how to set the two demo slots for the prospect user; the cron cadence).

## 4. Files not to touch
`lib/platform/*-watch/*`, `stock-cover`, `doc-watch`, price-watch, chat/shell components, marketing, RLS of other
tables.

## 5. Edge cases
User loses admin role → cron checks `canSeeBrief(role)` at send time and skips; user removed → cascade; two slots at
the same time → one email (dedupe by `(schedule_id, local_date)` per slot means two emails — collapse slots that
share `local_time` on the same day into one send, mark both delivered); cron missed a window (Vercel delay) → the
window is "since the last successful run for this org" capped at 60 min, so a 20-min-late run still sends; org not
in allowlist → nothing; Resend failure → no delivery row, retried next tick within the window, logged; test send
ignores days/time and does not write a delivery row.

## 6. Verification
Unit tests for `-shared.ts`; `npx tsc --noEmit`; `npm test`; `npm run build`; lint ≤ 50. Report the SQL file Josh
must paste and the curl to run one tick: `GET /api/agents/brief-notify` with `Bearer CRON_SECRET` (+ `?now=<iso>`
override accepted ONLY when `NODE_ENV!=='production'`… no — allow `?force=1` in prod to send the caller's due-or-not
slots for a named user? NO: keep prod deterministic; test sends go through the settings "Send me a test now").
Commit `brief: notification schedules — per-user morning/evening briefs by email`.

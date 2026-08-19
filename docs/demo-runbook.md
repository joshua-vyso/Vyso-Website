# Demo runbook — Meridian Food Co.

Everything needed to put the Finch demo in front of a prospect and take it away
again afterwards. Written for `.ai/plan_demo_mvp_finch.md` Phase E; kept here
rather than in `.ai/` because this is an operating document, not a plan.

Companions: `docs/demo-loom-script.md` (what to say), `docs/demo-case-study-note.md`
(what to send with it), `scripts/finch-rehearsal.md` (the four chat questions and
their expected numbers), `scripts/demo-invoice-pdfs.mjs` (the paper).

---

## 0. The two rules that override everything below

1. **Never show Turn 'n Slice data to a prospect.** TnS supplier prices,
   customers, invoices and stock are a real customer's commercially sensitive
   numbers. The demo org is **Meridian Food Co.** and nothing else. The agents now
   run for **every** organisation, so TnS findings certainly exist — they must
   never be on a screen a prospect can see, and no prospect login may ever be
   pointed at that org. (If you ever need TnS's agents off, that is what
   `AGENTS_ORG_EXCLUDE` is for — but the Brief being current is not the leak; the
   screen you share is.)
   Turn 'n Slice appears in a sale as a **story** only:
   `/case-studies/turn-n-slice` plus `docs/demo-case-study-note.md`.
2. **Drafts only. Nothing outbound sends itself.** No demo path may send an
   e-mail, a WhatsApp or an order to a supplier or a customer. The one thing that
   sends is the weekly digest, and it goes to `PRICE_WATCH_DIGEST_TO` — Josh's
   own inbox. Say the line out loud on every call: *"it drafts, you send."*

---

## 1. The facts you will keep needing

| Thing | Value |
|---|---|
| Demo organisation | **Meridian Food Co.**, Stellenbosch, Western Cape |
| Org id | `01000000-7e5d-4c1a-9b3f-000000000001` |
| Tier | `scale` (so `TrialGate` never locks the demo) |
| Where it runs | production — `https://vyso.co.za`, the live Supabase project |
| Seed | `supabase/demo-all-in-one.sql` (once, already applied) |
| August top-up | `supabase/demo-refresh-2026-08.sql` (re-runnable) |
| Storage bucket for documents | `documents`, folder `demo/docu/` |
| Original demo login | `demo@vyso.co.za` — **change its password, never hand it out** (§6.4) |

Agent routes, all **GET**, all bearer-authenticated with `CRON_SECRET`:

`/api/agents/doc-watch` · `/api/agents/price-watch` · `/api/agents/debtors-watch` ·
`/api/agents/stock-cover` · `/api/agents/xero-watch` · `/api/agents/digest`

Plus one route that is **not** an agent but runs on the same cron and the same
bearer token — `/api/integrations/xero/sync` (§3.4). It copies rows; it writes no
findings and forms no opinion.

---

## 2. Reseeding Meridian

### 2.1 The safe path

> **Do not re-run `supabase/demo-all-in-one.sql` against the live Meridian org.**

Two reasons, and the second is the one that bites:

- It is **destructive to the whole org**. Its delete preamble removes every
  `of_*`, `pp_*`, `cd_*`, `documents`, `document_folders`, `suppliers` and
  `ww_*` row for the org id above — including everything
  `demo-refresh-2026-08.sql` wrote, every document a prospect dragged in, and
  (by `on delete cascade` from `documents`) every `pw_price_points` row Price
  Watch has built. You are not "topping the demo up", you are starting the whole
  Phase B sequence again.
- **It derives integers out of uuid suffixes and will fail on rows it did not
  write itself.** Fourteen places take the last twelve characters of a row's id
  and cast them to a number —
  `demo-all-in-one.sql:2875, 2940, 2941, 2942, 2990, 3057, 3083, 3084, 3218 (×2),
  3284, 3288, 3984` (`::int`) and the `::bigint` variants at 3218/3284/3288.
  Example: `(substr(o.id::text, 25))::int as idx`. That is only true while every
  row in the table is seed-shaped (`…-9b3f-` followed by twelve digits). A row
  created by the app — a dragged-in document, an order built from one, anything
  Supabase gave a `gen_random_uuid()` — has a hex suffix, and the cast raises
  `invalid input syntax for type integer`, aborting the script part-way through a
  purge it has already done. **Future fix:** replace the fourteen casts with a
  `join` against the same generated-values list the inserts already use, or guard
  each with `where id::text ~ '-9b3f-[0-9]{12}$'`.

So: **`demo-refresh-2026-08.sql` is the only file that gets re-run.** It is
idempotent, Meridian-scoped, and its delete preamble is keyed to the id block it
owns (`…9%` counters only) — it cannot touch a seed row or an app-created one.

```
Supabase dashboard → SQL Editor → paste supabase/demo-refresh-2026-08.sql → Run
```

Re-running it restores: the August folder + 6 invoices (docs 901–906), 50 August
orders/invoices including the five late payers, the stock movements and the two
count adjustments, and the light ShiftBoard/WasteWatch August rows.

**Order matters.** Apply the refresh **before** the first Price Watch run of a
fresh cycle. The seed alone fires five findings (chicken portions +8.4 %, frying
medium +11.8 % on top of the three we want); the refresh adds the August points
that hold those two under the floor. `detect.ts` never retracts an open finding,
so if the cron ran first you must dismiss the two extras by hand.

### 2.2 If Meridian is genuinely broken

Rebuilding from `demo-all-in-one.sql` is a **last resort on a day with no demo
booked**, and the order is:

1. Delete the app-created rows first, so the casts have nothing foreign to read
   (documents dragged in during demos, and the orders built from them):
   ```sql
   delete from documents
    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
      and id::text !~ '-9b3f-[0-9]{12}$';
   ```
   Repeat the same predicate for `of_orders`, `of_order_items`, `of_invoices`
   before running it, checking each with a `select count(*)` first.
2. Run `demo-all-in-one.sql`, then `demo-refresh-2026-08.sql`.
3. Re-point the demo profile if the seed did not (it does this by e-mail lookup
   for `demo@vyso.co.za` only — every prospect profile you created in §6 must be
   re-pointed by hand).
4. Re-run all four agents (§3), then re-read every finding out loud against its
   source rows before showing anybody.

### 2.3 Price Watch state is NOT in the seed

`pw_items`, `pw_item_matches` and `pw_price_points` are written by the **run**,
never by a SQL file. With them empty, Finch correctly answers "price history
isn't switched on for this business yet" — honest, and a failed rehearsal. Check
before every demo:

```sql
select count(*) from pw_price_points
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
```

If the price points are wrong (rather than missing), the wipe-and-rerun rule is:
delete the org's `pw_price_points` and its `agent_findings where agent =
'price_watch'`, keep `pw_items` and `pw_item_matches`, then re-run the route.

### 2.4 08b refresh — the Review queue

`supabase/demo-refresh-2026-08b.sql` is a third, smaller file that runs **after**
`demo-refresh-2026-08.sql`. It exists for one shot in the Loom: the rail's
**Review** row, and the grouped chain at `/app/chat/review`.

**What it seeds** — six rows, and nothing else:

| Group on screen | Rows | ids |
|---|---|---|
| Doc-U · Invoices to approve | Helderberg Packaging **INV-9188**, 18 Aug, R195 454.00 incl VAT · Swartland Grain & Mill **INV-5241**, 19 Aug, R358 432.00 incl VAT | documents 911, 912 |
| Doc-U · Statements | Bergriver Growers — **Statement, July 2026**, closing R437 000.00 | document 913 |
| Doc-U · Flagged | Peninsula Beverage Supply **INV-3077**, 19 Aug, R86 721.50 incl VAT, **confidence 58** | document 914 |
| OrderFlow · Quote requests | **Elmarie van Wyk**, Boland Trading Co. (an existing customer, so "Add as new customer" reads *already a customer*) · **Thandi Mokoena**, Karoo Function Hire (a new prospect — 40 tubs prepared salad mix, 20 kg line fish, 29 Aug) | of_quote_requests 911, 912 |

Every one of them is priced **flat against that supplier's last seen invoice**,
or belongs to a supplier with no documents at all, so **no Price Watch series
moves** and none of the Loom's figures go stale. The file's header explains each
choice.

**It also quietens the seed's backlog (§3 of the file).** The Review queue is
computed, not stored, from `documents status in ('extracted','pending','error')`
and `of_quote_requests status='new' and flagged_spam=false` — and
`demo-all-in-one.sql` seeds 24 documents and 6 enquiries matching those
predicates, for KPI surfaces that predate Review. Left alone, the chain opens on
thirty rows. §3 moves the seed's `extracted` → `reviewed`, its `pending`/`error`
→ `archived`, and its six `new` enquiries → `dismissed`, scoped to seed counters
0-99 only. Nothing else in the demo moves: those statuses are outside Price
Watch's `EXCLUDED_STATUSES` either way, and the archived four carry no price
observations.

**Re-runnable**, with one ordering rule:

> `demo-refresh-2026-08.sql`'s delete preamble matches document counters
> **900-999**, which includes 08b's 911-914. **Re-running 08 deletes 08b's
> documents. Always re-run 08b after 08.** The reverse is safe — 08b's own
> preamble is pinned to 910-919.

**Verify** with the file's own §4 block. Expect `extracted 3` / `error 1`, two
`status='new'` enquiries with `already_a_customer` reading `Boland Trading Co.`
on exactly one of them, and §4.4 totalling **6**.

**PDFs.** The four new filenames follow the house rule
(`storage_path = 'demo/docu/' || filename`) and
`scripts/demo-invoice-pdfs.mjs` now lists 08b in its `SEED_FILES`, so §7's
generate-and-upload step covers them — 41 files instead of 37. Render just these
four with `--only 911,912,913,914`. The Review pane is a **preview beside the
fields**, so an un-uploaded object there is a visibly empty half-screen.

#### Resetting Review between prospects

Approving a document and adding a customer are real writes. Put them back:

```sql
-- The four Review documents, back to awaiting a decision.
update documents
   set status = case when id = '20000000-7e5d-4c1a-9b3f-000000000914'
                     then 'error' else 'extracted' end,
       approved_at = null,
       approved_by = null
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id in ('20000000-7e5d-4c1a-9b3f-000000000911',
              '20000000-7e5d-4c1a-9b3f-000000000912',
              '20000000-7e5d-4c1a-9b3f-000000000913',
              '20000000-7e5d-4c1a-9b3f-000000000914');

-- The two enquiries, back to un-actioned. customer_id is what
-- "Add as new customer" wrote; clearing it is what makes the button live again.
update of_quote_requests
   set status = 'new', customer_id = null, quote_id = null
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id in ('41000000-7e5d-4c1a-9b3f-000000000911',
              '41000000-7e5d-4c1a-9b3f-000000000912');
```

Then **delete the customer the demo created** — otherwise the next prospect's
"Add as new customer" answers *already a customer* and the beat is gone. It is
the only `of_customers` row in this org without a seed-shaped id:

```sql
select id, name, email, created_at from of_customers
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text !~ '-9b3f-[0-9]{12}$';
-- read that list, then delete by id. of_activity cascades.
```

Re-running the whole of 08b does the same job and more (it rewrites all six rows
from scratch) — use it if you would rather not hand-pick.

To undo §3 and put the seed's own backlog back, reverse the three updates: the
`reviewed` rows in counters 0-99 to `extracted`, the `archived` ones to their
original `pending`/`error` (docs 23 and 29 were `pending`; 16 and 34 were
`error`) with `archived_at = null`, and the six `dismissed` enquiries to `new`.

---

## 3. Running the agents by hand

All six are `GET` and take the cron secret as a bearer token. Set the secret in
your shell first — **never paste it into a document, a chat or a commit**:

```sh
read -rs CRON_SECRET && export CRON_SECRET   # paste, press enter, nothing echoes
```

```sh
for a in xero-watch doc-watch price-watch debtors-watch stock-cover; do
  echo "── $a"
  curl -s -H "Authorization: Bearer $CRON_SECRET" "https://vyso.co.za/api/agents/$a"
  echo
done
```

Run them **in that order** — Doc Watch reads the same paper Price Watch does, and
its "read overnight" receipt appearing after the finding raised from it reads
backwards.

The digest is separate (it only reads and e-mails):

```sh
curl -s -H "Authorization: Bearer $CRON_SECRET" https://vyso.co.za/api/agents/digest
```

### 3.1 Reading the responses

| Response | Meaning |
|---|---|
| `{"ok":true,"ran":1,…}` | worked, for one org |
| `{"ok":true,"ran":N,…}` | worked, for N orgs — **every organisation runs**, so N is the size of the `organisations` table |
| `{"ok":true,"ran":0,"message":…}` | nothing ran, and the `message` says why: no organisations in the database, `organisations` missing, or a restriction var set that matches nothing. A 200 by design — the cron fired |
| `orgsSkippedForTime: [uuid,…]` | the run stopped starting orgs 30s before its `maxDuration`. Those orgs are picked up by the next run. If this is routinely non-empty, fan the agent out — see the note in `app/api/agents/price-watch/route.ts` |
| `orgs.notFound: [uuid,…]` | `AGENTS_ORG_IDS`/`PRICE_WATCH_ORG_IDS` names an id that is not an organisation. It ran nothing |
| `orgs.excluded: [uuid,…]` | `AGENTS_ORG_EXCLUDE` deliberately skipped those |
| `503 CRON_SECRET is not set` | the env var is missing on the deployment |
| `401` | your bearer token does not match the deployment's `CRON_SECRET` |
| digest `{"ok":true,"sent":0}` | no open findings for that org, so no e-mail — correct, not a failure |
| digest `503` | `PRICE_WATCH_DIGEST_TO` is unset. There is deliberately no default recipient |

The digest sends at most **5** findings, biggest rand impact first, Doc Watch
receipts excluded. Subject: `Vyso weekly brief — Meridian Food Co. — N findings`.

### 3.2 The schedule (Vercel Cron, `vercel.json` — all times **UTC**)

| Path | UTC | SAST |
|---|---|---|
| `/api/email/process` | `0 3 * * *` | 05:00 daily |
| `/api/integrations/xero/sync` | `20 3 * * *` | 05:20 daily |
| `/api/agents/xero-watch` | `30 3 * * *` | 05:30 daily |
| `/api/agents/doc-watch` | `40 3 * * *` | 05:40 daily |
| `/api/agents/price-watch` | `45 3 * * *` | 05:45 daily |
| `/api/agents/debtors-watch` | `50 3 * * *` | 05:50 daily |
| `/api/agents/stock-cover` | `55 3 * * *` | 05:55 daily |
| `/api/agents/digest` | `0 4 * * 1` | **Monday** 06:00 |
| `/api/agents/brief-notify` | `*/15 * * * *` | every 15 min |

Every route is idempotent, so a manual run before a demo is safe and the ordering
above is a courtesy to the reader of the Brief, not a correctness requirement.

### 3.3 Brief notifications (per-user morning/evening briefs)

`/api/agents/brief-notify` is the tick that emails people their Brief at times
they chose themselves. It reads `brief_schedules`, and **it supersedes the Monday
digest**: an org with at least one enabled schedule gets `{"superseded":true}`
from `/api/agents/digest` and no weekly e-mail, so the demo org never sends both.

**Prerequisite (once):** paste `supabase/brief-schedules.sql` into the Supabase
SQL editor. Until you do, the settings card says so and the tick answers
`{"tableMissing":true}` — neither is an error.

Setting the two demo slots for the prospect user, in the product rather than in
SQL (this is the flow to show, not work around):

1. Sign in as the prospect (§6), open **`/app/settings`**.
2. **Brief notifications** is the first card — it only renders for an owner or
   admin, because the Brief itself is admin-only.
3. Press **Use 07:00 and 17:30** on the empty state, then **Save**.
4. Press **Send me a test now** to prove the address works. The test goes to the
   signed-in user only, ignores the schedule, and does **not** count as that
   day's brief — so the real 07:00 send still happens tomorrow.

Reading the tick's response:

| Response | Meaning |
|---|---|
| `{"ok":true,"sent":1,…}` | one brief e-mailed |
| `{"due":0,…}` | nothing fell due in the last hour — the normal answer 90+ times a day |
| `{"alreadySent":2,…}` | the slots fired earlier today; the delivery rows are doing their job |
| `{"skipped":n,…}` | the user is no longer an owner/admin, or has no address in `auth.users` |
| `{"tableMissing":true}` | `supabase/brief-schedules.sql` has not been pasted in yet |

A slot is due from its own minute for **one hour** (`DUE_LOOKBACK_MINUTES`), so a
late Vercel tick still sends; `unique (schedule_id, local_date)` on
`brief_deliveries` is what stops the other three ticks in that hour sending it
again. There is deliberately **no `?now=` or `?force=` override** — use the
settings card's test button.

---

### 3.4 Plugins → Xero (sync + Xero Watch)

**Meridian has no Xero connection, and must not get one.** The plugin page is
still worth showing on a demo: `/app/plugins/xero` renders the connect state,
which is exactly what a prospect's own workspace would look like on day one.
Never demo a real customer's Xero data.

Two routes, and they are NOT both agents:

```sh
# The sync — copies invoices and contacts from Xero into Vyso's mirror.
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://vyso.co.za/api/integrations/xero/sync
# The agent — reads that mirror and writes findings.
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  https://vyso.co.za/api/agents/xero-watch
```

Run them **in that order**: the agent reads whatever the sync last left, and its
first rule exists precisely to notice when that is stale.

**Prerequisite (once):** paste `supabase/xero-sync.sql` into the Supabase SQL
editor. Until you do, the sync answers `{"tablesMissing":true}` and the plugin
page says the mirror is not set up — neither is an error.

| Response | Meaning |
|---|---|
| sync `{"ok":true,"ran":0,"message":"No organisation has Xero connected."}` | nobody has connected Xero. A 200 by design |
| sync `summaries[].invoices.fullRead: true` | no usable cursor, so the whole ledger was read. Normal on a first run |
| sync `summaries[].invoices.partial: true` | the read stopped early (a rate limit, a bad page). The cursor was **not** advanced, so tomorrow re-reads that window |
| sync warning `Xero rate-limited the read…` | Xero's 60/min per-tenant ceiling. Harmless; a partial sync was recorded |
| xero-watch `{"ok":true,"ran":0,…}` | there are no organisations to run for at all — read the `message`. Both the sync and the agent now run for every org; the sync still only *does* anything where Xero is connected, and so does the agent |
| xero-watch `connectionStatus: null` | that org has no Xero connection row, so the agent did nothing |

The sync's `POST` twin is the plugin page's **Sync now** button: signed-in
owner/admin, their own org, six times an hour.

### 3.5 Plugins → Xero → Hubdoc (cross-upload)

**Nothing here runs on a cron, and nothing here sends without a person.** The
Hubdoc cross-upload emails a supplier invoice Doc-U has read to the org's Hubdoc
"upload by email" inbox — that is Hubdoc's only supported intake, there is no
write API — and it happens on a button press, or on the org-level auto-forward
toggle that ships **off**.

**Prerequisite (once):** paste `supabase/hubdoc.sql` into the Supabase SQL
editor. Until you do, the Hubdoc card says so and every send refuses.

**Never demo this with a real customer's documents, and never send to a real
Hubdoc inbox from a demo.** Meridian has no Xero connection, so the whole
section is hidden there anyway (the control needs a live connection and an
intake address). If you want to show it, show the card's copy and the log —
not a send.

**Finding an org's intake address:** Hubdoc → the organisation's settings →
**"Upload by email"**. It usually ends in `@upload.hubdoc.com`. Vyso accepts any
valid address but warns on anything else, because some businesses point it at
their own bookkeeper instead.

The end-to-end check, in order:

1. Plugins → Xero → **Hubdoc** → paste the intake address → **Save**.
2. Open a Doc-U supplier invoice (`/app/docu/<id>`) that has been read and has a
   supplier matched. **Send to Hubdoc** is in the top-right action row.
3. The row appears in the Hubdoc card's log within a refresh, and the email
   arrives in the Hubdoc inbox with the original file attached.

| What you see | Meaning |
|---|---|
| No "Send to Hubdoc" button at all | you are not an owner/admin, **or** Xero is not connected, **or** no intake address is set. The button only renders when it would work |
| A sentence instead of a button | the org is set up but this document cannot go — wrong type (only invoices and statements), no supplier matched, not read yet, or no stored file |
| "Sent to Hubdoc" + a quiet "Send again" | it has already gone. "Send again" is the deliberate override and logs its own row as *Sent again* |
| A row in the log marked **Failed** | the send was attempted and did not land; the error is on the row. Retrying is allowed — only a *successful* non-resend forward is one-per-document |
| **Sent automatically** in the log | the auto-forward toggle is on for that org. It is off by default and records who turned it on |

`RESEND_API_KEY` is what makes any of this work — the same key the briefs and
the digest use. Without it the card says email sending is not configured.

## 4. Rotating `CRON_SECRET`

Vercel marks it **sensitive**: once saved it cannot be read back in the
dashboard or by `vercel env pull`. If you have lost it, you rotate — there is no
"look it up".

1. Generate one: `openssl rand -hex 32`
2. Vercel → the project → **Settings → Environment Variables** → `CRON_SECRET` →
   Edit → paste → save for **Production** (and Preview, if you curl previews).
3. **Redeploy.** Env changes do not reach running functions until a new
   deployment: Deployments → the latest production deployment → ⋯ → **Redeploy**.
4. Verify with a cheap call — Doc Watch is the least destructive:
   `curl -s -H "Authorization: Bearer <new>" https://vyso.co.za/api/agents/doc-watch`
   A `401` means the redeploy has not landed yet; wait and retry.
5. Update anywhere else it lives (your shell profile, a password manager entry).
   Do not commit it, do not put it in `.env.example`, do not paste it into a
   Loom.

---

## 5. Environment variables the demo needs

Set in **Vercel → Settings → Environment Variables**, Production scope. All are
documented with their defaults in `.env.example`.

**Required for the demo to work at all**

| Var | Value | Consequence if missing |
|---|---|---|
| `CRON_SECRET` | 32-byte hex | every agent route 503s; the crons cannot authenticate |
| `ANTHROPIC_API_KEY` | — | Finch chat and Price Watch's observation text both fail |
| `RESEND_API_KEY` | — | the digest cannot send |
| `PRICE_WATCH_DIGEST_TO` | `joshua@vyso.co.za` | digest returns 503 and sends nothing |
| `SUPABASE_SERVICE_ROLE_KEY` | — | the agent routes cannot read across the org |

**There is no longer an org allowlist to set.** The agents run for **every
organisation** in the `organisations` table — that is Josh's rule, *all agents
need to be available on each org id* — so a new customer's Brief fills in without
anybody editing Vercel. Three vars can only ever narrow that, and **all three are
left blank in production**:

| Var | What it does |
|---|---|
| `AGENTS_ORG_EXCLUDE` | uuids to **skip**. The escape hatch for a churned or internal org. Normally empty |
| `AGENTS_ORG_IDS` | run **only** these orgs. A development/staging convenience. Setting it in production silently turns the agents off for every org it does not name |
| `PRICE_WATCH_ORG_IDS` | the legacy name for the same restriction, read only when `AGENTS_ORG_IDS` is blank |

If `AGENTS_ORG_IDS` or `PRICE_WATCH_ORG_IDS` is still set in Vercel from the
opt-in era, **delete both** — while either is set, only the org it names runs.

**Model tiers — the one that can quietly cost money**

Every `ANTHROPIC_*_MODEL` var is optional and every default is deliberately
cheap: chat is **Haiku**, the Finch workflow tier is **Sonnet**, and long-form /
Price Watch observation text is **Sonnet**.

> **`ANTHROPIC_MODEL` must NOT be set to an Opus id.** It is the long-form tier —
> Price Watch's observation call runs through it on every finding, on every org,
> every night. Leave it unset unless a specific case has been deliberately chosen
> to need Opus, and unset it again afterwards. The same goes for
> `ANTHROPIC_AGENT_MODEL` (chat: keep Haiku) and `ANTHROPIC_WORKFLOW_MODEL`
> (keep Sonnet).

---

## 6. Prospect access

### 6.1 Create a prospect user

One auth user **per prospect** — never a shared login. Their dismissals, notes
and chats then stay theirs, and revoking one does not touch another.

1. Supabase dashboard → **Authentication → Users → Add user**
   - e-mail: `demo+<prospect-slug>@vyso.co.za` (or their own address if they ask)
   - a strong, unique password — generate it, do not reuse
   - tick **Auto Confirm User** (there is no invite flow and
     `SIGNUP_ENABLED=false`)
2. SQL Editor — link the profile to Meridian. Column names follow
   `supabase/tns-users-roles.sql`, which is the pattern this is copied from:

```sql
-- A PROSPECT: role 'admin' so they can see money (canSeeMoney = owner|admin)
-- and the Brief (canSeeBrief, lib/platform/access.ts). A COO demo without rand
-- figures is pointless, so admin it is.
insert into profiles (id, org_id, full_name, role)
select u.id,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       'Prospect — <Their Name>',
       'admin'
  from auth.users u
 where u.email = 'demo+<prospect-slug>@vyso.co.za'
on conflict (id) do update
   set org_id = excluded.org_id,
       full_name = excluded.full_name,
       role  = excluded.role;
```

For the **restricted view** (rehearsal question 4 — the money gate), the same
statement with `'member'` instead of `'admin'`:

```sql
insert into profiles (id, org_id, full_name, role)
select u.id, '01000000-7e5d-4c1a-9b3f-000000000001'::uuid, 'Demo — member view', 'member'
  from auth.users u
 where u.email = 'demo+member@vyso.co.za'
on conflict (id) do update
   set org_id = excluded.org_id, full_name = excluded.full_name, role = excluded.role;
```

Verify:

```sql
select u.email, p.role, p.full_name
  from profiles p join auth.users u on u.id = p.id
 where p.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
 order by p.role, u.email;
```

**What a `member` sees**, so nothing surprises you on the call: no Brief and no
History in the rail; `/app`, `/app?view=all` and `/app/finding/<id>` all redirect
to their first unlocked module; suggestion chips carry no finding, customer or
rand figure; Finch answers stock and price-history questions in full and refuses
margin/debtors questions outright. That is the demo of the gate — it is not a
broken login.

### 6.2 Revoke a prospect user

In order, so nothing is orphaned:

```sql
-- 1. their chats (finch_messages cascade from finch_chats)
delete from finch_chats
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and user_id = (select id from auth.users where email = 'demo+<slug>@vyso.co.za');

-- 2. their profile
delete from profiles
 where id = (select id from auth.users where email = 'demo+<slug>@vyso.co.za');
```

3. Supabase dashboard → **Authentication → Users** → the user → **Delete user**.

Deleting the auth user alone also works — `profiles.id` and `finch_chats.user_id`
both cascade from it — but doing it in this order means you can see what you
removed before it disappears.

### 6.3 Reset the demo between prospects

Cheap, non-destructive, ~30 seconds. Nothing here re-seeds.

```sql
-- (a) Bring back every card the last prospect dismissed or resolved.
update agent_findings
   set status = 'new'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and status in ('dismissed', 'resolved');

-- (b) Wipe the last prospect's chat history (finch_messages cascades).
delete from finch_chats
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and user_id = (select id from auth.users where email = 'demo+<slug>@vyso.co.za');

-- (c) Anything they dragged in during the demo. Check before you delete —
--     the predicate matches any document whose id is NOT seed-shaped.
select id, filename, created_at from documents
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and id::text !~ '-9b3f-[0-9]{12}$';
-- then, once you have read that list:
-- delete from documents where org_id = '…' and id::text !~ '-9b3f-[0-9]{12}$';
```

(c) matters more than it looks: a document dropped during a Loom is read by the
next Price Watch run and adds a **duplicate price point** at the same date and
price, because the dedupe key is `(document_id, line_index)` and a new upload is
a new document. Delete it the same day; `pw_price_points` cascades from
`documents`, so the point goes with it.

**The nine review-queue matches** (`pw_item_matches` with `status = 'review'` —
lines the matcher would not link without a human) can be left alone: **no screen
in the product renders them**, so a prospect cannot see them. If you want them
gone for tidiness:

```sql
update pw_item_matches set status = 'rejected'
 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001' and status = 'review';
```

Do **not** delete the rows — the matcher would simply propose them again on the
next run and you would lose the record that a human declined them.

### 6.4 `demo@vyso.co.za`

The seed header documents its password as `1234` (SEC-05) and that string is
public in this repository.

- **Change the password now**, in Supabase → Authentication → Users →
  `demo@vyso.co.za` → Reset/Update password.
- **Never give `demo@` to a prospect.** It is the account the seed re-points and
  the one screenshots were taken from; two prospects sharing it would see each
  other's dismissals and chats. One user per prospect, always (§6.1).

---

## 7. Uploading the demo PDFs

Every seeded `documents` row carries `storage_path = 'demo/docu/' || filename`,
but **no object was ever uploaded**, so Doc-U's preview pane 404s on all of them.
`app/app/docu/[id]/page.tsx:80` builds the preview with

```ts
supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600)
```

— bucket **`documents`**, key **exactly** the `storage_path` value. Extracted
fields and line items render either way (they come out of `extracted_data`), but
"with the invoice to prove it" wants a page on screen.

### 7.1 Generate the files

pdfkit is **not** a dependency of this repo and must not become one:

```sh
npm --prefix /tmp/pdfgen install pdfkit
node scripts/demo-invoice-pdfs.mjs --pdfkit /tmp/pdfgen --out /tmp/demo-pdfs
node scripts/demo-invoice-pdfs.mjs --list      # what it would render, and why
```

41 one-page A4 PDFs: 25 supplier invoices (the 9 price-observation ones, 6 more
July invoices, the 6 August refresh invoices, doc 16's failed-extraction one, and
08b's 3 — Helderberg INV-9188, Swartland INV-5241, the flagged Peninsula
Beverage INV-3077), 7 delivery notes, 5 statements (08b adds Bergriver's July
one), 3 price lists, 1 customer order. `--only 911,912,913,914` renders just
08b's four; see §2.4. The content is
**parsed out of the seed files themselves** — supplier name/town/e-mail from the
`suppliers` rows, and invoice number, date, VAT, totals and every line item from
that document's own `extracted_data` — so the paper and Doc-U's extraction cannot
disagree. Not generated: docs 32 and 34 (they are `.jpg`, and the detail page
picks `<img>` vs `<iframe>` off the extension, so a PDF wearing a `.jpg` name
renders as a broken image) and doc 23 (`pending`, no extracted data — nothing
true to print).

**The filenames are the contract.** They are byte-identical to the seed's
`filename` values; rename one and its preview 404s.

### 7.2 Drop them in

1. Supabase dashboard → **Storage** → the **`documents`** bucket.
2. Create folder **`demo`**, open it, create folder **`docu`** inside it. You
   should be standing in `documents / demo / docu`.
3. **Upload files** → select all 37 → upload. (Drag-and-dropping the `demo`
   folder itself also works and creates the nesting for you — check afterwards
   that the path is `demo/docu/<file>.pdf` and not `demo/docu/docu/…`.)

### 7.3 Verify one preview

1. Sign in as the prospect user, open `/app/docu`.
2. Open **`riebeek-oils-INV-4559.pdf`** (Riebeek Oils & Fats, 13 August 2026 —
   the invoice the Loom's oil finding points at).
3. The preview pane on the right shows the PDF: `Cooking oil (5L)`, 290 case at
   **664.00** = 192 560.00, total incl. VAT **R 290 637.20** — the same figures
   the extracted-fields panel beside it lists.
4. Repeat once from the Brief: open the oil finding → its evidence link → the
   same document, preview loaded.

### 7.4 If the preview still 404s (or 403s) after uploading

The bucket's RLS policies are **not** in this repository — they were set in the
Supabase dashboard — and the app's own uploader writes to `{org_id}/{uuid}_{name}`
(`lib/platform/docu/upload-client.ts:135`). If the read policy on
`storage.objects` is scoped to `(storage.foldername(name))[1] = <the user's
org_id>`, then a key under `demo/…` is denied no matter what you upload.

Check: Storage → `documents` → **Policies**. Then pick one:

- **Preferred** — add a `select` policy on `storage.objects` for
  `bucket_id = 'documents' and name like 'demo/docu/%'`, restricted to
  authenticated users whose profile org is Meridian. Demo paper only; nothing
  else moves.
- **Fallback** — move the objects under the org id instead and point the rows at
  them. Upload the same 37 files to
  `01000000-7e5d-4c1a-9b3f-000000000001/` and then:
  ```sql
  update documents
     set storage_path = '01000000-7e5d-4c1a-9b3f-000000000001/' || filename
   where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
     and storage_path like 'demo/docu/%';
  ```
  Note that `demo-refresh-2026-08.sql` writes `demo/docu/…` again on every
  re-run, so this UPDATE becomes a step you repeat after every refresh.

---

## 8. Known gaps — say these out loud rather than being caught by them

1. **Doc-U previews 404 until §7 is done.** Fields and line items still render;
   only the file pane is empty.
2. **SEC-04 — every module is force-enabled** (`lib/platform/supabase-server.ts:156`
   returns all features true). Module gating protects nobody on this demo: the
   prospect can open all nine modules from the rail. That is fine for Meridian
   (it is a demo org with no real data) and must not be mistaken for a tenancy
   control.
3. **RLS is untouched by the Brief's role gate.** `canSeeBrief` / `canSeeMoney`
   (`lib/platform/access.ts`) gate the **UI and the routes**; `agent_findings`
   remains readable org-wide at the database level, exactly as before. The member
   view is a product behaviour, not row security.
4. **Findings never auto-close.** Debtors Watch does not resolve a card when the
   invoice is paid, and Price Watch never retracts an open finding when a price
   comes back down. A stale card is dismissed by hand.
5. **WasteWatch's analytics are hardcoded** (`lib/platform/wastewatch.ts`:
   `HEATMAP`, `COST_TIMELINE`, `PREVENTABLE`, `INSIGHTS`). Do not quote a
   WasteWatch number on a call; the module is a 5-second glance in the "under the
   hood" beat and nothing more.
6. **`demo@vyso.co.za`'s password is `1234` in the seed header** until §6.4 is
   done, and that file is in the repository.
7. **Out of scope, and the Loom says so:** Xero/Yoco pulls, drafting supplier
   e-mails from a finding, WhatsApp ordering, mobile. The WhatsApp lane is parked
   on the `feat/whatsapp-ordering` branch and is not on `main`.
8. **Days-of-cover figures drift with the calendar** — they divide the last 30
   days of the movement ledger. On-hand against threshold is exact; if the cover
   numbers have moved since `scripts/finch-rehearsal.md` was written, check the
   on-hand figures and re-word the script rather than assuming a bug.
9. **No hand-edited findings, ever.** If a card is wrong, the detector is wrong:
   fix it, or delete the row and open the Brief with two cards today. A demo with
   a doctored row is a demo you cannot repeat.

---

## 9. Pre-demo checklist

- [ ] `demo-refresh-2026-08.sql` applied (August rows present, MTD ≈ R2.8M)
- [ ] `demo-refresh-2026-08b.sql` applied **after** it (§2.4), and its §4.4
      verification totals **6** — Review reads 2 invoices / 1 statement /
      1 flagged / 2 quote requests
- [ ] `select count(*) from pw_price_points where org_id = …` > 0
- [ ] All four agents run today, in the order of §3
- [ ] Findings read out loud against their source invoices — every rand figure
      defensible
- [ ] The 41 PDFs uploaded and one preview verified (§7.3) — including 08b's
      four, or the Review pane's preview half is empty
- [ ] `agent_findings` reset to `new` and the last prospect's `finch_chats`
      deleted (§6.3)
- [ ] A fresh prospect user created, signed into once by you, landing on a
      populated Brief
- [ ] `ANTHROPIC_MODEL` is **not** an Opus id
- [ ] The four rehearsal questions answered correctly, with the ✦ tool line
      visible (`scripts/finch-rehearsal.md`)

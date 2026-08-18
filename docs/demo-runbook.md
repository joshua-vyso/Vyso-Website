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
   numbers. The demo org is **Meridian Food Co.** and nothing else. If TnS's org
   id is in `AGENTS_ORG_IDS`, TnS findings exist — they must never be on a screen
   a prospect can see, and no prospect login may ever be pointed at that org.
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
`/api/agents/stock-cover` · `/api/agents/digest`

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

---

## 3. Running the agents by hand

All five are `GET` and take the cron secret as a bearer token. Set the secret in
your shell first — **never paste it into a document, a chat or a commit**:

```sh
read -rs CRON_SECRET && export CRON_SECRET   # paste, press enter, nothing echoes
```

```sh
for a in doc-watch price-watch debtors-watch stock-cover; do
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
| `{"ok":true,"ran":0,…}` | the **allowlist is empty** — `AGENTS_ORG_IDS` (or the legacy `PRICE_WATCH_ORG_IDS`) is unset in Vercel. A 200 by design: the cron fired, nothing is enabled |
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
| `/api/agents/doc-watch` | `40 3 * * *` | 05:40 daily |
| `/api/agents/price-watch` | `45 3 * * *` | 05:45 daily |
| `/api/agents/debtors-watch` | `50 3 * * *` | 05:50 daily |
| `/api/agents/stock-cover` | `55 3 * * *` | 05:55 daily |
| `/api/agents/digest` | `0 4 * * 1` | **Monday** 06:00 |

Every route is idempotent, so a manual run before a demo is safe and the ordering
above is a courtesy to the reader of the Brief, not a correctness requirement.

---

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
| `AGENTS_ORG_IDS` | `01000000-7e5d-4c1a-9b3f-000000000001` | every agent no-ops (`ran: 0`) and the Brief renders its empty state |
| `CRON_SECRET` | 32-byte hex | every agent route 503s; the crons cannot authenticate |
| `ANTHROPIC_API_KEY` | — | Finch chat and Price Watch's observation text both fail |
| `RESEND_API_KEY` | — | the digest cannot send |
| `PRICE_WATCH_DIGEST_TO` | `joshua@vyso.co.za` | digest returns 503 and sends nothing |
| `SUPABASE_SERVICE_ROLE_KEY` | — | the agent routes cannot read across the org |

`PRICE_WATCH_ORG_IDS` is the legacy name for `AGENTS_ORG_IDS` and is still read
as a **fallback** when the new var is unset or empty. Set `AGENTS_ORG_IDS` going
forward; leaving both set is harmless, and the new one wins.

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

37 one-page A4 PDFs: 22 supplier invoices (the 9 price-observation ones, 6 more
July invoices, the 6 August refresh invoices, doc 16's failed-extraction one), 7
delivery notes, 4 statements, 3 price lists, 1 customer order. The content is
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
- [ ] `select count(*) from pw_price_points where org_id = …` > 0
- [ ] All four agents run today, in the order of §3
- [ ] Findings read out loud against their source invoices — every rand figure
      defensible
- [ ] The 37 PDFs uploaded and one preview verified (§7.3)
- [ ] `agent_findings` reset to `new` and the last prospect's `finch_chats`
      deleted (§6.3)
- [ ] A fresh prospect user created, signed into once by you, landing on a
      populated Brief
- [ ] `ANTHROPIC_MODEL` is **not** an Opus id
- [ ] The four rehearsal questions answered correctly, with the ✦ tool line
      visible (`scripts/finch-rehearsal.md`)

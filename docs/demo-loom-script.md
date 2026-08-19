# Demo Loom — shot-by-shot script (v2)

**5 minutes 30, hard ceiling.** Recorded against **production**
(`https://vyso.co.za`) signed in as a **prospect user** (never
`demo@vyso.co.za`), on **Meridian Food Co.**

v1 was the Brief, one finding, four questions and a module tour. v2 keeps the
first half and replaces the tour with the thing that has actually been built
since: **Review** — the queue of decisions waiting on a person, the grouped
chain, Approve, and the quote request that turns into a customer. Everything
else in this file is trimmed to make room for it.

> **The one rule.** Every number you say out loud is a number that is on screen,
> from a Meridian row. If a figure is not on the screen at that moment, do not
> say it. If a card's number has moved since this script was written, read the
> card — the card is right and the script is stale.

> **The other rule.** Turn 'n Slice does not appear. Not a name, not a number,
> not a tab in the background.

> **The third rule, new in v2.** You will click **Approve** on a document and
> **Add as new customer** on an enquiry, live, on a recording. Both are writes.
> Neither sends anything to anybody — that is the point of the beat, and it is
> why the sentence *"it drafts, you send"* is said twice in this script rather
> than once.

---

## Pre-flight (do all of this before you hit record)

**SQL, in this order, all four:**

- [ ] `supabase/demo-all-in-one.sql` — the workspace.
- [ ] `supabase/demo-refresh-2026-08.sql` — August. (If you re-run this one,
      you **must** re-run 08b after it: 08's delete preamble matches document
      counters 900-999, which includes 08b's. See 08b's header.)
- [ ] `supabase/demo-refresh-2026-08b.sql` — the Review queue.
- [ ] `supabase/finch-chats.sql` — chats. No chat, no Q1/Q2, no drag-and-drop.
- [ ] `supabase/brief-schedules.sql` — without it the Settings card says so and
      the 07:00/17:30 shot has nothing to press.

**State:**

- [ ] All four agents run today, in the order of `docs/demo-runbook.md` §3, and
      `select count(*) from pw_price_points where org_id = …` > 0.
- [ ] **The Review queue reads 4 + 2.** Run 08b's §4.4 verification: Doc-U
      invoices **2**, Doc-U statements **1**, Doc-U flagged **1**, OrderFlow
      quotes **2** — six in total. Any other number and the chain shot is a
      different shot; go and read 08b §3 before you record.
- [ ] **Stray catalogue lines dealt with** — `scripts/demo-stray-stock-lines.sql`
      part (A) read, and either part (B) run or the count-only sentence accepted
      ("16 other lines have no threshold set…"). Do not let twelve unconfigured
      rows answer the stock question.
- [ ] **41 PDFs uploaded** to the `documents` bucket under `demo/docu/`, and one
      preview verified (runbook §7.3). The four new ones matter more than the
      rest, because the Review pane at 3:00 is a **preview beside the fields**
      and an empty pane there is the whole shot:
      `helderberg-packaging-INV-9188.pdf`, `swartland-grain-INV-5241.pdf`,
      `bergriver-growers-STMT-2026-07.pdf`, `peninsula-beverage-INV-3077.pdf`.
- [ ] **Brief notifications NOT yet set** for the prospect user. The 4:25 beat is
      pressing "Use 07:00 and 17:30" on the **empty state**. If you rehearsed it,
      clear the schedules again.
- [ ] `CRON_SECRET` rotated (runbook §4) — it has been pasted into curl commands
      in three places.
- [ ] `demo@vyso.co.za`'s password changed off `1234` (runbook §6.4).
- [ ] A **fresh prospect user** created (runbook §6.1), signed into once by you,
      landing on a populated Brief. Never `demo@`.
- [ ] `agent_findings` reset to `new` and the last prospect's `finch_chats`
      deleted (runbook §6.3).
- [ ] `ANTHROPIC_MODEL` is **not** an Opus id.

**Recording:**

- [ ] Clean browser profile. No other tabs. No bookmarks bar showing customer
      names. Window at **1440 × 900**, zoom 100 %, menu bar tidy.
- [ ] **One PDF on the desktop** for the drop at 2:20 —
      `boland-dry-goods-INV-7714.pdf` from your `--out` folder. Boland is not in
      a price-watched series, so the drop cannot create a price point that
      matters. Delete the uploaded row afterwards (runbook §6.3(c)).
- [ ] The **07:00 brief e-mail** open in a second window, scrolled to the top,
      ready to alt-tab to at 5:05.
- [ ] Q1 and Q2 rehearsed cold, with the ✦ tool status line appearing each time
      (`scripts/finch-rehearsal.md`). No tool line means it answered from memory
      — stop and fix before recording.

---

## The numbers that will be on screen

Verified against `supabase/demo-refresh-2026-08.sql`'s static-verification
header and `supabase/demo-refresh-2026-08b.sql`'s row table. Do not quote any
figure that is not here.

| Finding | Figure on the card | The proof |
|---|---|---|
| Riebeek Oils & Fats — Cooking oil (5L) | **+10.1 %**, ≈ **R360 937** a year | R558 → R566 → R640 → **R664** a case, 8 Jun → 13 Aug, 4 invoices |
| Overberg Dairy Supply — Cheese block | **+11.0 %**, ≈ **R223 097** a year | R122 → R125 → R138 → **R146** a kg, 10 Jun → 14 Aug |
| Northern Suburbs Supply — late | **R190 900** across **2 invoices** | INV-13187 R101 200 (due 8 Jul), INV-13188 R89 700 (due 16 Jul) |
| Winelands Protein Co. — Line fish fillet | **+10.0 %**, ≈ **R140 848** a year | R148 → R152 → R168 → **R176** a kg, 5 Jun → 12 Aug |
| Cape Cold Chain — Prepared Salad Mix | *no card — it went **down*** | R80.00 → R78.00 → R77.50 → **R76.80** a tub, **−4 %** end to end |
| Stock — Line Fish Fillet | **0** on hand against a threshold of **20** — out **now** | |
| Stock — Cooking Oil (4×5L case) | **12** on hand against a threshold of **16** | same supplier as the +10.1 % finding |

**⚠ The "days past terms" number drifts.** It is computed against today, so the
40 days this script was written with is 42 by the 19th and more next week. Read
it off the card; say "over forty days" if you want a phrase that keeps.

**Expect the Brief to open on four cards plus the overflow card**: cooking oil,
cheese block, Northern Suburbs Supply, line fish fillet — the four biggest rand
figures, in that order. The overflow card's number is whatever it says; read it,
do not predict it.

### The six things in the Review queue

| Group on screen | Rows |
|---|---|
| **Doc-U · Invoices to approve** | Helderberg Packaging INV-9188 (18 Aug) · Swartland Grain & Mill INV-5241 (19 Aug) |
| **Doc-U · Statements** | Bergriver Growers — Statement, July 2026 |
| **Doc-U · Flagged — Vyso could not read these** | Peninsula Beverage Supply INV-3077, **58 %** confidence |
| **OrderFlow · Quote requests** | Elmarie van Wyk, Boland Trading Co. · Thandi Mokoena, Karoo Function Hire |

The **"Approve all in Doc-U (N)"** button counts the approvable rows only — the
flagged one is never in it. It reads **(3)** before you approve anything and
**(2)** after the single Approve at 3:15. **Read the button, do not say a
number from this table.**

---

## Shot list

Twelve beats, 5:30. The timings are budgets, not targets — if a beat lands in
less, take the time back at 4:00, not at 0:00.

### 0:00 — 0:40 · The Brief

**On screen:** `/app`, already loaded, nothing clicked yet.

> "This is Finch. It's the COO you don't have. It read your paperwork overnight,
> and this is what it wants you to know this morning."

Let the greeting and the four cards sit for three full seconds before you move
the mouse. Then, reading off the cards, not from memory:

> "Riebeek put your cooking oil up ten percent — that's about three hundred and
> sixty thousand rand a year on what you actually buy. Overberg's cheese is up
> eleven. Northern Suburbs owes you a hundred and ninety thousand, over forty
> days past terms. And your fish is up ten."

Point at the fifth card.

> "And there's more behind that — it doesn't dump twenty cards on you at seven
> in the morning."

---

### 0:40 — 1:00 · Everything it has, in one page

**On screen:** click the overflow card's **"View the full briefing →"** →
`/app?view=all`.

Scroll the report once, top to bottom, without stopping on anything.

> "That's everything it's holding — every open finding, as a report. Your
> documents, your orders, your stock, your waste. You can go and dig any time."

Back to `/app`.

> "But most mornings you don't want the report. You want the four things that
> cost you money, which is the page we started on."

**Twenty seconds, hard.** A long look at this page is the old pitch and it
undercuts everything above it.

---

### 1:00 — 1:35 · One finding, in full

**On screen:** click the **cooking oil** card → `/app/finding/<id>`.

> "Every one of these opens up."

Scroll so the **price chart** is centred.

> "Four invoices, June the eighth to August the thirteenth. Five fifty-eight,
> five sixty-six, six forty, six sixty-four a case. That's not a spike, that's a
> pattern — and it's the second increase in six weeks."

Hover the evidence strip.

> "And every number here is attached to the invoice it came from. It isn't an
> estimate. It's your paper."

Point at **Draft email** — **do not click it.**

> "It'll write the supplier e-mail for you. It will not send it. Nothing in
> Finch sends anything. **It drafts, you send.**"

---

### 1:35 — 2:20 · Ask it two things it wasn't asked

**On screen:** the finding's **Discuss** / ✦ button → the chat, with the finding
attached.

**Q1.** Type:

> **"How has cooking oil moved this year, and who else supplies it?"**

Wait for the ✦ line to read *"Reading price history…"* — **let the viewer see
it.** Then read the answer off the screen, not off this page. It should give
you:

- the four dated prices, June to August;
- **both** moves, labelled: **+19 %** since June *and* **+10.1 %** against the
  60-day median of **R603**;
- that **Riebeek is the only supplier who has invoiced this line** — nobody else.

> "Note what it didn't do. It didn't invent a second supplier to be helpful. If
> the answer is 'there isn't one', it says there isn't one."

**Q2.** Same chat. Type:

> **"Who owes me money, and how long?"**

Read the answer off the screen.

> "Northern Suburbs Supply. Two invoices, a hundred and ninety thousand nine
> hundred, and the oldest one is over forty days past terms."

**Do not** click through to OrderFlow here — v1 did, and it costs twenty seconds
the Review beat needs. The same-data-different-screen point gets made at 4:45
instead, from the bubble.

---

### 2:20 — 2:40 · Drop a document in

**On screen:** the same chat. Drag `boland-dry-goods-INV-7714.pdf` from the
desktop onto the conversation.

> "And when the paper's in your hand instead of your inbox — you just drop it
> in."

Let it upload and extract. Don't narrate the wait; let it land. It will answer
with **"Saved to Doc-U as boland-dry-goods-INV-7714.pdf."** and what it read.

> "Filed, read, and every line is now in the same pot everything else came out
> of."

One line, then move:

> "Same thing on your phone — photograph a stack of delivery notes and it takes
> them all at once. That's the same lane."

---

### 2:40 — 2:50 · The rail has been asking for you

**On screen:** pan to the left rail. The **Review** row, with the red dot and
the ebbing border.

> "And this has been sitting here the whole time. Review. It's the only red in
> this app, and it only exists when something is actually waiting on a person —
> when the last one's done, the row goes away."

**⚠ Do not say the row appeared because of the drop.** The queue has six items
in it from the moment you sign in, so the row is on screen from 0:00; claiming
the drop conjured it is the one dishonest sentence available in this recording.
Its count is in the aria-label, not on the screen, so nothing visibly changes
when the number moves.

**⚠ If the invoice you just dropped shows up as a seventh row** in the chain at
2:50, that is correct — a chat upload that has not committed inline genuinely is
waiting on you. Say *"and there's the one I just dropped"* and carry on. If it
isn't there, it committed inline: say nothing.

---

### 2:50 — 3:35 · Review — the decisions, grouped

**On screen:** click **Review** → `/app/chat/review`.

Let the opening card render. Then, reading the group headings:

> "Six things. Two invoices to approve, a statement, one it couldn't read, and
> two people who wrote in from the website. Grouped by what the decision *is*,
> not by which module it came out of."

Click the **Swartland Grain & Mill** invoice row. The pane opens beside the
chain: **preview on one side, extracted fields on the other.**

> "There's the invoice, and there's what it read off it. Cake flour, maize meal,
> bread rolls — three hundred and fifty-eight thousand four hundred and
> thirty-two rand including VAT. Nothing here was typed by anybody."

Click **Approve**.

> "That's it. It's filed."

Now point at the **Peninsula Beverage** row under *Flagged*.

> "And this one it's honest about. Fifty-eight percent confidence — a first-time
> supplier and a bad scan. There's no Approve button on it, because it isn't
> willing to pretend it read it. It's asking you."

Point at **Approve all in Doc-U** — **read the number off the button.**

> "And when you trust it, you don't do them one at a time."

**Do not press it.** The next beat needs the quote requests, and the button
never touches them — but a batch write on camera is a bigger claim than this
recording needs to make.

---

### 3:35 — 4:00 · The enquiry that becomes a customer

**On screen:** still in the chain. Click **Thandi Mokoena — Karoo Function
Hire**.

> "And this came off the website at seven eighteen this morning. Forty tubs of
> prepared salad mix and twenty kilos of line fish, for a function on the
> twenty-ninth."

Beat — and only if the stock line is still on screen from earlier, or you are
willing to open it:

> "Which you'll notice is the fish you have none of."

Point at **Add as new customer**, then click it.

> "One press and she's an OrderFlow customer — name, e-mail, phone, straight off
> what she typed. Nothing was guessed."

Click the **Boland Trading Co.** row above it.

> "And this one it won't do. Same button, and it says *already a customer* —
> because Boland's been on the books since last year. It checked before it
> offered."

---

### 4:00 — 4:25 · Plugins

**On screen:** `/app/plugins/xero`. **The connect state — do not connect
anything.**

> "This is where Xero goes. You connect it once, and from then on Finch is
> reading your ledger the same way it reads your invoices — and watching it, the
> same way it watches your prices."

One line, no click:

> "And a document it's already read can be pushed straight through to Hubdoc
> from Doc-U, so your bookkeeper's pile fills itself. On a button. Not
> automatically, unless you turn that on yourself."

**⚠ Meridian has no Xero connection and must not get one.** Never demo a real
customer's Xero data. The connect state is exactly what a prospect's own
workspace looks like on day one, which is why it is worth showing.

---

### 4:25 — 4:45 · When it arrives

**On screen:** `/app/settings`, the **Brief notifications** card, on its empty
state.

Press **Use 07:00 and 17:30**, then **Save**.

> "And you pick when it arrives. Seven in the morning and half past five —
> before you're at your desk, and once more before you go home."

---

### 4:45 — 5:05 · It follows you around

**On screen:** navigate to `/app/orderflow`. Open the **Finch bubble** in the
corner rather than going back to the Brief.

> "And it's on every screen. Same Finch."

Type into the bubble:

> **"What will I run out of this week?"**

Read the top two lines off the answer.

> "Line fish fillet is already **out** — zero, against a minimum of twenty. And
> cooking oil is down to twelve cases against a minimum of sixteen."

Beat.

> "Which is the same cooking oil from the first card. So you're about to reorder
> oil from the supplier who just put you up ten percent. **That's** the job.
> Nobody in your building was ever going to join those two facts up on a Monday
> morning."

---

### 5:05 — 5:20 · Tomorrow, 07:00

**On screen:** alt-tab to the brief e-mail.

> "And then it just arrives. Same findings, biggest first, in your inbox before
> you're at your desk."

---

### 5:20 — 5:30 · Close

**On screen:** back to `/app`, the Brief, cards visible.

> "Two thousand rand for the Operations Audit — one week on your invoices, your
> statements, your stock sheets — and then the first month is free. You decide
> after thirty days.
>
> Everything you just watched is reading your own paperwork back to you. And
> nothing in it sends anything. **It drafts, you send.**"

Stop recording.

---

## Things not to say

- Any rand figure from the marketing site's findings library (R58k, R82k). Those
  are illustrative copy, not Meridian rows.
- Any WasteWatch number — that module's analytics are hardcoded.
- Any margin percentage. Finch can size the **cost** of the oil increase
  (R360 937 a year), but Meridian stores no batch counts and no per-recipe sale
  price, so there is no honest margin impact to quote. If it comes up on a live
  call, say that.
- **"The Review row appeared because I dropped that invoice."** It did not. See
  the ⚠ at 2:40.
- **A count from the Review tables in this file** in place of the number on the
  "Approve all in Doc-U" button. It changes the moment you press Approve.
- Anything about Yoco or WhatsApp ordering. Not built. Mobile Capture is a
  one-line mention at 2:40 and nothing more — do not open it.
- That anything was sent, ordered, reordered, or forwarded. Approve files a
  document. "Add as new customer" writes a customer. Neither e-mails a soul.
- Turn 'n Slice, in any form.

## After the recording

- [ ] **Put the Review queue back.** Runbook §"08b refresh" → the reset tip:
      four documents back to `status='extracted', approved_at=null`, two quote
      requests back to `status='new'`.
- [ ] **Delete the customer you created** from the Karoo Function Hire enquiry,
      and its `of_activity` row — otherwise the next prospect's "Add as new
      customer" says *already a customer* and the beat is dead.
- [ ] Delete the document you dragged in (runbook §6.3(c)) — it will otherwise
      be read by tonight's Price Watch run.
- [ ] Clear the 07:00/17:30 schedules, so the next recording gets the empty
      state.
- [ ] Reset the findings you dismissed, if any (runbook §6.3(a)).
- [ ] Watch it back with the sound off and check no screen shows another
      customer's name, an e-mail preview, or a browser tab you forgot about.

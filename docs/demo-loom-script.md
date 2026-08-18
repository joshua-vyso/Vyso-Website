# Demo Loom — shot-by-shot script

4–5 minutes, recorded against **production** (`https://vyso.co.za`) signed in as a
**prospect user** (never `demo@vyso.co.za`), on **Meridian Food Co.**

Built from `.ai/plan_demo_mvp_finch.md` §4, updated for what actually exists
today: the 4+1 card cap and the `?view=all` briefing report, `/app/finding/[id]`
with its price chart and **Draft email**, `/app/chat/*`, drag-and-drop into a
chat, the module bubble, and the four Finch read tools.

> **The one rule.** Every number you say out loud is a number that is on screen,
> from a Meridian row. If a figure is not on the screen at that moment, do not
> say it. If a card's number has moved since this script was written, read the
> card — the card is right and the script is stale.

> **The other rule.** Turn 'n Slice does not appear. Not a name, not a number,
> not a tab in the background.

---

## Pre-flight (do all of this before you hit record)

- [ ] `docs/demo-runbook.md` §9 checklist is green — refresh applied, all four
      agents run today, findings read out loud, PDFs uploaded.
- [ ] Signed in as the prospect user in a **clean browser profile**. No other
      tabs. No bookmarks bar showing customer names.
- [ ] Window at **1440 × 900**, browser zoom 100 %, macOS menu bar tidy.
- [ ] Have **one PDF on the desktop** for the drag-and-drop beat — use
      `boland-dry-goods-INV-7714.pdf` from `/tmp/demo-pdfs`. Pick a document that
      is **not** in a price-watched series (Boland Dry Goods is not one of the
      three) so the drop cannot create a duplicate price point that matters.
      Delete the uploaded row afterwards (runbook §6.3(c)).
- [ ] Have the **Monday digest e-mail** open in a second window, scrolled to the
      top, ready to alt-tab to at 4:00.
- [ ] Rehearse questions Q1–Q4 once, cold, and check the ✦ tool status line
      appears each time (`scripts/finch-rehearsal.md`). No tool line means it
      answered from memory — stop and fix before recording.

---

## The numbers that will be on screen

Verified in `supabase/demo-refresh-2026-08.sql`'s static-verification header. Do
not quote any figure that is not in this table.

| Finding | Figure on the card | The proof |
|---|---|---|
| Riebeek Oils & Fats — Cooking oil (5L) | **+10.1 %**, ≈ **R360 937** a year | R558 → R566 → R640 → **R664** a case, 8 Jun → 13 Aug, 4 invoices |
| Overberg Dairy Supply — Cheese block | **+11.0 %**, ≈ **R223 097** a year | R122 → R125 → R138 → **R146** a kg, 10 Jun → 14 Aug |
| Northern Suburbs Supply — late | **R190 900** across **2 invoices**, oldest **40 days** past terms | INV-13187 R101 200 (due 8 Jul), INV-13188 R89 700 (due 16 Jul) |
| Winelands Protein Co. — Line fish fillet | **+10.0 %**, ≈ **R140 848** a year | R148 → R152 → R168 → **R176** a kg, 5 Jun → 12 Aug |
| Cape Cold Chain — Prepared Salad Mix | *no card — it went **down*** | R80.00 → R78.00 → R77.50 → **R76.80** a tub, **−4 %** end to end |
| Stock — Line Fish Fillet | **0 on hand** against a threshold of 20 — out **now** | |
| Stock — Cooking Oil (4×5L case) | **12** on hand against a threshold of **16** | same supplier as the +10.1 % finding |
| Count variance — Chicken Portions | **14 boxes** written off, ≈ **12 %** of the 114 received in August | |

**Expect the Brief to open on four cards plus the overflow card**: cooking oil,
cheese block, Northern Suburbs Supply, line fish fillet — the four biggest rand
figures, in that order (money beats recency; a finding with no rand figure sorts
last, which is why the stock cards are behind the overflow card and not on the
front page). The overflow card's number is whatever it says; read it, do not
predict it.

---

## Shot list

### 0:00 — 0:35 · The Brief

**On screen:** `/app`, already loaded, nothing clicked yet.

> "This is Finch. It's the COO you don't have. It read your paperwork overnight,
> and this is what it wants you to know this morning."

Let the greeting and the four cards sit for three full seconds before you move
the mouse. Then, reading off the cards, not from memory:

> "Riebeek put your cooking oil up ten percent — that's about three hundred and
> sixty thousand rand a year on what you actually buy. Overberg's cheese is up
> eleven. Northern Suburbs owes you a hundred and ninety thousand, forty days
> past terms. And your fish is up ten."

Point at the fifth card.

> "And there's more behind that — it doesn't dump twenty cards on you at seven
> in the morning."

**Do not** click the overflow card yet.

---

### 0:35 — 1:15 · One finding, in full

**On screen:** click the **cooking oil** card → `/app/finding/<id>`.

> "Every one of these opens up."

Scroll so the **price chart** is centred.

> "Four invoices, June the eighth to August the thirteenth. Five fifty-eight,
> five sixty-six, six forty, six sixty-four a case. That's not a spike, that's a
> pattern — and it's the second increase in six weeks."

Hover the evidence strip.

> "And every number here is attached to the invoice it came from. It isn't an
> estimate. It's your paper."

Point at **Draft email** — **do not click it**.

> "It'll write the supplier e-mail for you. It will not send it. Nothing in
> Finch sends anything. **It drafts, you send.**"

---

### 1:15 — 1:45 · The invoice underneath

**On screen:** click the first evidence link → `/app/docu/<id>`.

> "One click and I'm at the actual invoice. Riebeek Oils and Fats, thirteenth of
> August, invoice four-five-five-nine."

Point at the line, then at the preview pane.

> "Cooking oil, two hundred and ninety cases at six six four. And there's the
> document itself — Finch read this the same way your bookkeeper would, except at
> two in the morning, and it read all thirty-seven of them."

Back to the finding (browser back).

---

### 1:45 — 2:30 · Q1 · Ask it something it wasn't asked

**On screen:** the finding's **Discuss** / ✦ button → the chat, with the finding
attached. Type:

> **"How has cooking oil moved this year, and who else supplies it?"**

Wait for the ✦ line to read *"Reading price history…"* — **let the viewer see
it**. Then read the answer off the screen, not off this page. It should give you:

- the four dated prices, June to August;
- **both** moves, labelled: **+19 %** since June *and* **+10.1 %** against the
  60-day median of R603;
- that **Riebeek is the only supplier who has invoiced this line** — nobody else.

> "Note what it didn't do. It didn't invent a second supplier to be helpful. If
> the answer is 'there isn't one', it says there isn't one."

Then, in the same chat:

> **"What about Cape Cold Chain?"**

> "That one came **down** — four percent across the same period. It's not just
> looking for bad news, and it's not going to let you renegotiate with the one
> supplier who's been fair with you."

---

### 2:30 — 3:00 · Q2 · Who owes you money

Same chat. Type:

> **"Who owes me money, and how long?"**

Read the answer. Then click through to OrderFlow → the customer → their overdue
invoices.

> "Northern Suburbs Supply. Two invoices, a hundred and ninety thousand nine
> hundred, and the oldest one is forty days past terms. Same data, different
> screen — this isn't a report Finch built, it's your invoice book."

---

### 3:00 — 3:30 · Q3 · What runs out this week

**On screen:** you are on `/app/orderflow`. Open the **Finch bubble** in the
corner rather than going back to the Brief.

> "And it follows you around — same Finch, every screen."

Type into the bubble:

> **"What will I run out of this week?"**

Read the five lines off the answer. Land hard on the first two:

> "Line fish fillet is already **out** — zero, against a minimum of twenty. And
> cooking oil is down to twelve cases against a minimum of sixteen."

Beat.

> "Which is the same cooking oil from the first card. So: you're about to
> reorder oil from the supplier who just put you up ten percent. **That's** the
> job. Nobody in your building was ever going to join those two facts up on a
> Monday morning."

Optional, if you have room:

> **"Anything odd in the stock counts?"** → chicken portions, 14 boxes written
> off, about 12 % of the 114 that came in.

---

### 3:30 — 3:50 · Drag a document in

**On screen:** back on the chat (or the bubble). Drag
`boland-dry-goods-INV-7714.pdf` from the desktop onto the conversation.

> "And when the paper's in your hand instead of your inbox — you just drop it
> in."

Let it upload and extract. Don't narrate the wait; let it land.

> "Filed, read, and every line is now in the same pot everything else came out
> of."

---

### 3:50 — 4:15 · Under the hood, briefly

**On screen:** expand the rail. Click **"View the full briefing →"** from `/app`.

> "Underneath the brief there are nine modules — your documents, your orders,
> your stock, your rosters, your waste. That's where the numbers live. You can
> go and dig any time."

Scroll the briefing report once, top to bottom, without stopping on anything.

> "But most mornings you don't want nine modules. You want the four things that
> cost you money, which is the page we started on."

**Keep this beat to twenty seconds.** A module tour is the old pitch and it
undercuts everything above it.

---

### 4:15 — 4:40 · Monday morning

**On screen:** alt-tab to the digest e-mail.

> "And on a Monday it just arrives. Same findings, biggest first, in your inbox
> before you're at your desk."

---

### 4:40 — 5:00 · Close

**On screen:** back to `/app`, the Brief, cards visible.

> "That's it. Two thousand rand for the Operations Audit — one week on your
> invoices, your statements, your stock sheets — and then the first month is
> free. You decide after thirty days.
>
> Everything you just watched is reading your own paperwork back to you. And
> nothing in it sends anything. It drafts, you send."

Stop recording.

---

## Things not to say

- Any rand figure from the marketing site's findings library (R58k, R82k). Those
  are illustrative copy, not Meridian rows, and quoting them here is exactly the
  dishonesty the Brief was built to avoid.
- Any WasteWatch number — that module's analytics are hardcoded.
- Any margin percentage. Finch can size the **cost** of the oil increase
  (R360 937 a year) and it knows the recipes the line feeds, but Meridian stores
  no batch counts and no per-recipe sale price, so there is no honest margin
  impact to quote. If the topic comes up on a live call, say that.
- Anything about Xero, Yoco, WhatsApp ordering or mobile. Not built. If asked:
  "not yet — that's on the list, and I'd rather show you what's actually
  running."
- Turn 'n Slice, in any form.

## After the recording

- [ ] Delete the document you dragged in (runbook §6.3(c)) — it will otherwise be
      read by tonight's Price Watch run.
- [ ] Reset the findings you dismissed, if any (runbook §6.3(a)).
- [ ] Watch it back with the sound off and check no screen shows another
      customer's name, an e-mail preview, or a browser tab you forgot about.

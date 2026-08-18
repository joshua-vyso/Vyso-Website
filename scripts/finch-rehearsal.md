# Finch read tools — live rehearsal (P1.2)

Four questions, run by hand against **Meridian Food Co.** in a Brief chat
(`/app` → Ask Finch, or `/app/chat/new`). This is the W6 check for
`.ai/plan_finch_read_tools_p12.md`: the unit tests pin the shaping, this pins
what the model actually *says*.

## Before you start

1. `supabase/demo-all-in-one.sql` **and** `supabase/demo-refresh-2026-08.sql`
   applied to Meridian. Every number below comes out of those two files.
2. **Price Watch has been run at least once** since the refresh
   (`/api/agents/price-watch` or the nightly cron). `pw_items`,
   `pw_item_matches` and `pw_price_points` are written by that run, not by the
   seed — with them empty, questions 1 and 3 correctly answer "price history
   isn't switched on for this business yet", which is a *pass* for honesty and a
   *fail* for the rehearsal. Check `select count(*) from pw_price_points` first.
3. Sign in as an **admin/owner** for questions 1–3 and as a **member** for
   question 4.
4. Watch the ✦ status line while it thinks: it should read "Finding the line…",
   "Reading price history…", "Checking stock cover…" or "Sizing the margin
   effect…". No tool line at all means it answered from memory — that is a fail
   however right the answer looks.

Days-of-cover figures move with the calendar (they divide the last 30 days of
the ledger). The ones below are what the week of **18 Aug 2026** reads;
**on-hand against threshold is exact** and is what to check if the cover figures
have drifted.

---

## 1. "How has cooking oil moved this year, and who else supplies it?"

**Expected facts** — Riebeek Oils & Fats, 4 invoices, 8 Jun → 13 Aug 2026:
R558.00 → R566.00 → R640.00 → R664.00 per 4×5L case; **+19 % first→last**;
**+10.1 % against the trailing 60-day median of R603.00**; Riebeek is the
**only** supplier who has invoiced this line.

Must say:

- The four dated prices, or at least the first and last with their dates.
- Both moves, **labelled**: +19 % since June *and* +10.1 % on the 60-day median.
  Either one alone is a different (smaller or larger) claim than the truth.
- Riebeek Oils & Fats by name, and that **nobody else has invoiced this line** —
  "no one else" is the answer to the second half of the question, not a gap.
- How many invoices it read and over what dates.

Must not say:

- A second supplier for cooking oil. There is none.
- The Cape Cold Chain / Prepared Salad Mix series (that one is *falling*,
  −4 % end to end) — it belongs in this answer only if you ask about Cape Cold
  Chain, and it is the check for "does it stay on the line I asked about".
- A rand figure without "about" and "a year".
- Any price not in the four above.

---

## 2. "What will I run out of this week?"

**Expected facts** — exactly five lines, soonest first
(`supabase/demo-refresh-2026-08.sql` §6.4 expects items 2, 16, 21, 23, 30):

| line | on hand / threshold | cover |
| --- | --- | --- |
| Line Fish Fillet (kg) | 0 / 20 | out **now** |
| Bread Rolls (24/bag) | 14 / 30 | ~8 days |
| Baby Spinach (crate) | 6 / 12 | ~8 days |
| Fresh Milk (12×1L case) | 18 / 24 | ~12 days |
| Cooking Oil (4×5L case) | 12 / 16 | ~12 days |

Must say:

- Line Fish Fillet first, and that it is **already out**, not "running low".
- On hand against the threshold for each line, in the line's own unit.
- Days of cover as an approximation ("about 12 days at last month's usage").

Must not say:

- A rand value on any of them. Nothing has been lost yet; there is nothing to
  price, and the tool deliberately returns no money at all.
- Chicken Portions (72 against a threshold of 40 — comfortably fine).
- That it has ordered, reordered or told anyone. It drafts; Josh sends.

Follow-up worth asking: **"anything odd in the stock counts?"** → Chicken
Portions, **14 boxes written off, ~12 % of the 114 that came in**, and Cheese
Block, **10 kg, ~8 % of 130 kg**. Both are August's count adjustments.

---

## 3. "How is the oil increase hitting my margin?"  *(admin)*

**Expected facts** — R664.00 latest against a R603.00 median = **R61.00 a case**,
on **≈5 917 cases a year**, so **about R360 937 a year**. That is the same
figure as the Brief's Price Watch card for this series, computed the same way —
if the card and the chat disagree, that is the bug this question exists to
catch. The line **is** linked: Cooking Oil (4×5L case) is an ingredient in
**Sauce Base — Tomato** (0.15 case/batch), **Bread Rolls** (0.05) and
**Marinated Protein Portions** (0.06), and Meridian's target gross margin is
**41 %**.

Must say:

- About R360 937 a year — hedged as an estimate.
- The per-case difference and where it came from (latest vs the 60-day median).
- The recipes the line feeds, by name.
- That **batch counts and per-recipe sale prices aren't tracked**, so it can
  size the **cost** but not the margin percentage this moves.

Must not say:

- A margin percentage for the effect. The only percentage it may quote is the
  **41 % target**, and it must be labelled as the target, not as the impact.
- "Your margin drops to X %" in any form.
- A different annual figure from the Brief card's.

If Price Watch's matcher named the buy-side item something whose core is not
"cooking oil", the tool answers `margin_effect: not_linked` and the model should
say *"your recipes don't reference this line yet, so I can only size the cost,
not the margin effect."* That is also a **pass** — it is the honest fallback —
but note it, because it means the catalogue name drifted.

---

## 4. The money gate — the same three questions as a **member**

Sign in as a Meridian user with `role = 'member'` (see
`supabase/tns-users-roles.sql` for the pattern).

**Expected:**

- *"How is the oil increase hitting my margin?"* → **refused**: margin and cost
  exposure are admin-only. It should say so plainly and offer nothing as a
  substitute — no partial figure, no "roughly", no workaround.
- *"What will I run out of this week?"* → **answered in full**. Stock is
  operational; every member needs it. Same five lines as question 2.
- *"How has cooking oil moved this year?"* → **answered in full**. Price history
  is operational too.

Must not say:

- Any rand exposure, annual cost or margin target to this user.
- That the *stock* or *price* questions are restricted. Getting the gate right
  in one direction and wrong in the other is the failure mode here.

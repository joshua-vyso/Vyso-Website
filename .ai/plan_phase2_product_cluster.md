# Plan — Phase 2: product cluster (modules · integrations · compare · solutions)

Derived from `.ai/vyso_v2.md` §1, §2.2, §3, §4, §7. Read that first, then this.
Standing rules: **no widget is reused across pages** (the orbit, the phone/brief
panel, the PlatformShowcase, the sequence, the day strip each appear on exactly
one page — the day strip's page is `/compare/finch-vs-hiring-a-coo`); FindingCard
IS allowed everywhere (it's the atom, recoloured per page); `motion` only, no new
deps, zero glass, colour discipline, reduced motion, honesty chips, one `<h1>`,
SSR-safe, no git commands, dev server on :3000, front your browser tab. Every
rebuilt page: `FinchNav` (`active` where it applies) + `FinchFooter`, metadata
rewrite (title ≤ 60 leading with the query, description ≤ 155 with numbers +
"South Africa"), canonical, `BreadcrumbList` JSON-LD (+ `FAQPage` where FAQs
exist), `AuditBand` CTA (→ `/operations-audit`), internal links per §7.5, one
FindingCard with page-specific content. Old page components stay on disk (Phase
5 deletes) — list what you orphan. All four workstreams append their section to
`.ai/implementation_phase2.md`.

Design references: `.ai/design/Homepage.dc.html`, `Pricing.dc.html` and the
built `/`, `/pricing`, `/operations-audit`, `/faq` (read their components) —
match that language exactly. Inspiration bar: Attio / Stripe / Firecrawl / Folk.

---

## Workstream A — `/platform/modules` + `/platform/modules/[slug]` (Sonnet)

Files: `app/platform/modules/page.tsx`, `app/platform/modules/[slug]/page.tsx`,
`app/platform/modules/modules.module.css` (stop importing; leave file for Phase
5), new `components/finch/modules/*`. Data stays in `lib/marketing/modules.ts`
+ `module-data/*` — you may ADD fields (e.g. `agents: string[]`, `group`) but do
not remove or rewrite grounded feature copy; fix any tier/pricing/"Vyso AI"
mentions in the data to the single offer (`grep` first; report each change).

Index (`/platform/modules`): eyebrow `UNDER THE HOOD`, `<h1>` "The machinery
Finch runs on.", sub "Ten modules, one operating foundation. Finch's agents read
from and write to these — you rarely need to open them." Groups (H2 mono
labels): Documents (Doc-U) · Orders & money (OrderFlow, PricePilot) · Suppliers
& stock (ProcurePulse, SupplySync, WasteWatch, PlanWise) · People (ShiftBoard,
ServiceDen `LIMITED ROLLOUT`) · Insight (InsightGen). Cards: white, border,
radius 10, name (STIX 20), one-line capability, "used by" agent chips (mono),
`LIVE`/status chip from the registry, arrow. **Signature visual (unique to this
page):** a quiet "wiring" diagram above the grid — the Finch mark in the middle,
ten module tiles around it, and hairline connectors that draw (`pathLength`) on
enter in blue for read paths and ink for write paths; each connector labelled in
mono where a label fits ("invoices", "prices", "stock"). Static SVG, ≤ 1.2s once,
reduced motion → drawn. Not a carousel, not the orbit.

Detail pages: hero (module name STIX 44, tagline, status chip, "used by" chips
linking to `/#agents`), a `ScreenshotFrame` in Finch style (soft border, radius
12, no browser chrome, one screenshot per feature section — real screenshots
only, they exist), feature sections (existing grounded copy), "How Finch uses
it" (2–3 sentences per module linking the module to the agents that read it —
honest: describe reading/writing data, not outcomes we can't show), workflow
steps, `worksWith` chips → sibling modules, industry fit chips → `/industries/*`,
FAQs (FAQPage schema), prev/next module, AuditBand. Remove any pricing add-on
language. Metadata per module from data. Mobile: single column, screenshots
`max-w-full`.

Verify: tsc/eslint; all 10 slugs 200; one h1 each; JSON-LD parses; grep gates
(tiers/setup/R3,000 per module/Vyso AI/backdrop) → 0 in your files + data;
1440/375.

## Workstream B — `/integrations` (Sonnet)

Files: `app/integrations/page.tsx`, new `components/finch/integrations-page/*`.
Data: `components/finch/integrations.ts` (read-only) — you may create
`lib/marketing/integrations.ts` extending it with per-tool copy (`reads`,
`writes`, `status`, `setup`), keeping the 11 tools + their logo paths.

Page: eyebrow `SENSES, NOT INTEGRATIONS`, `<h1>` "Connect what you already run.
Finch starts watching.", sub (nothing to migrate; connected during onboarding;
data stays yours). **Signature visual (unique):** a "reading table" — a two-
column ledger where each tool row, on enter (staggered), animates the fields
Finch reads out of it as blue extracted mono rows (like the sequence's beat 2 but
as a table row: `xero · invoices · supplier prices · payment dates`), then a
small ink tick. Not the orbit, not logos in a ring. Then per-tool sections in a
`<dl>`: logo (from `/finch/integrations/*.svg`), name, "What Finch reads",
"What Finch can do with it", status (`CONNECTED IN ONBOARDING` / `ROADMAP` —
check with the repo: only claim tools that the product actually integrates
today (grep `lib/**` and `app/api/integrations/**` for xero etc.); everything
else is `ROADMAP` — be honest and say so), and a "you ask Finch" example prompt
(reuse the strings from `integrations.ts`, that's data not a widget). Then "Don't
see your tool?" → expanded mandates line + contact. 4 FAQs (FAQPage). AuditBand.
Metadata: "Integrations — Xero, Sage, WhatsApp, Yoco, Loyverse & more | Vyso"
style, description with "South Africa".

Verify: tsc/eslint; every logo 200; grep gates; 1440/375; JSON-LD parses.

## Workstream C — `/compare` hub + 3 comparisons (Opus)

Files: `app/compare/page.tsx`, `app/compare/finch-vs-hiring-a-coo/page.tsx`
(new), `app/compare/finch-vs-erp/page.tsx` (new; content from
`vyso-vs-erp-systems`), `app/compare/finch-vs-spreadsheets/page.tsx` (new;
content from `vyso-vs-spreadsheets`), delete the two old sub-page files after
copying, `next.config.ts` (add two 301s: `/compare/vyso-vs-erp-systems` →
`/compare/finch-vs-erp`, `/compare/vyso-vs-spreadsheets` → `/compare/finch-vs-spreadsheets`
— re-read the file right before your single minimal edit; other agents may
touch it), `app/sitemap.ts` (swap the two URLs, add the COO page), new
`components/finch/compare/*`, `lib/marketing/compare.ts` (all comparison
content), and `components/finch/day/*` (import + parameterise as needed for the
COO page; do not change its default content).

Hub: `<h1>` "Which is right for your stage?" ; three cards (vs hiring a COO ·
vs an ERP · vs spreadsheets & DIY) each with a one-line verdict and a
FindingCard-styled "when Finch is NOT the answer" honesty note; links to `/faq#comparison`.

`/compare/finch-vs-hiring-a-coo` — the flagship. `<h1>` "Finch vs hiring a COO."
Sections: (1) direct answer paragraph (≤ 45 words); (2) **the day strip** —
`components/finch/day` used ONCE on the site, here, with a two-track framing:
eyebrow `A COO'S DAY · WHAT FINCH DOES WITH IT`; beats as today (06:14 → 17:55)
— the copy around it says a COO reads, checks, chases and reports; Finch does
the reading, checking and chasing and leaves the deciding to you; (3) **the cost
bars** — two horizontal bars grow on enter: "Operations manager / COO in South
Africa: R[low]–R[high] per month" using a cited public source (Robert Walters SA
salary survey / PayScale SA / Michael Page SA — fetch the current figure with the
`firecrawl` skill, cite name + year + URL in a footnote; if you cannot verify a
figure, show the bar unlabelled with "market salary — see sources" and DO NOT
invent a number) vs "Finch: R6,000 per location per month"; rand values stamp;
(4) comparison table (what you get / what you don't: judgement, relationships,
presence in the room — honest about what a human COO gives that Finch doesn't);
(5) "When you should hire a COO instead" (honest section); (6) 4 FAQs (FAQPage);
AuditBand. `BreadcrumbList`. Reduced motion: bars at full width, strip static.

`/compare/finch-vs-erp`, `/compare/finch-vs-spreadsheets` — port the existing
grounded content (tables, 4-step process, FAQs) into the Finch language: table
rows highlight under the pointer, sticky first column on mobile; each has one
FindingCard example ("what Finch would have caught that the ERP/spreadsheet
didn't"), reframed copy Vyso→Finch, no tier mentions. Metadata rewrite; keep
their FAQPage schema.

Verify: tsc/eslint; both 301s; four pages 200, one h1 each; the day strip plays
(sample in a visible tab) and is imported nowhere else (grep); cost figures
cited; JSON-LD parses; 1440/375.

## Workstream D — `/solutions` hub + 4 pages reframed (Opus)

Files: `app/solutions/page.tsx`, `app/solutions/[slug]/page.tsx`, new
`lib/marketing/solutions.ts` (move `SOLUTIONS` out of the page file; keep the
grounded content; reframe copy Vyso→Finch; add `agents: string[]` and
`exampleFinding` per solution), new `components/finch/solutions/*`.

Hub: eyebrow `WHAT FINCH FIXES`, `<h1>` "Fix the problem, not the symptom.",
sub. **Signature visual (unique):** the **symptom checklist that writes a
FindingCard** — a list of 8–10 symptom checkboxes (from the existing symptom
matcher's content: "we only find out about price increases at month end",
"deliveries don't match invoices", "debtors slip past terms", "stock counts
surprise us", "reports arrive too late to act" …); as the user ticks, a
FindingCard beside the list types in its observation (40ms/char, once per
change, reduced motion → instant) and stamps a generic-but-true impact line
("Worth quantifying — that's the audit."), evidence chip = "N symptoms ticked",
actions = the 1–2 solution pages that match + Book your audit. No invented rand.
Then the 4 solution cards (link, one-liner, agents chips).

Detail pages (4): port each solution's grounded sections (problem, struggles,
cost stats — keep only stats that carry a source in the current data; drop or
source the rest — help, workflow, related, FAQ) into the Finch language;
"How Finch fixes it" section names the example agents (chips → `/#agents`) with
honest status; one FindingCard example per solution; related industries/learn
links; FAQPage schema; AuditBand. `reduce-money-leakage` is the hub-of-hubs
(links to the other three). Metadata rewrite per page.

Verify: tsc/eslint; hub + 4 slugs 200; checklist → card typing works (visible
tab); grep gates; JSON-LD parses; 1440/375.

---

## Phase-level verification (architect)

tsc (3 known), lint no new, browser review of each page at 1440/375, redirects
table (`/compare/vyso-vs-*` 308), sitemap swap, no widget reused (grep imports of
IntegrationsOrbit / BriefPanel / PlatformShowcase / ScrollSequence / DayStrip →
each in exactly one page tree), grep gates repo-wide on Phase 2 files.

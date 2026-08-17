# Plan — Phase 3: industries · company pages · legal · learn/glossary/resources

Derived from `.ai/vyso_v2.md` §1, §2.2 (industries), §2.3, §3, §4, §7. Read
that first. Standing rules (unchanged): **no widget reused across pages** —
each page gets its own signature visual listed below; FindingCard is the atom
and allowed everywhere; `motion` only, no new deps, zero glass, colour
discipline (orange = agent activity + CTA + finding impact; blue = evidence),
reduced motion → static end state, SSR-safe, one `<h1>`, honesty rules (Roberto
is the only quoted client; Doc-U live; Price Watch rolling out; others "from
your audit roadmap"; no invented stats/dates/clients), no git commands, dev
server on :3000 (don't start another; front your browser tab). Every rebuilt
page: `FinchNav` (`active="industries"` / `"learn"` where applicable) +
`FinchFooter`, metadata rewrite (title ≤ 60 leading with the query, description
≤ 155 with numbers + "South Africa"), canonical, `BreadcrumbList` JSON-LD (+
`FAQPage`/`Article` where relevant), `AuditBand`, internal links per §7.5, one
page-specific FindingCard. Old components stay on disk (Phase 5). Four
workstreams, disjoint files; each appends "## <letter> — …" to
`.ai/implementation_phase3.md`. Language reference: the built `/`, `/pricing`,
`/operations-audit`, `/faq`, `/solutions`, `/compare/*` and their components.

**Known bug to fix everywhere you touch data:** old data files link Learn
articles by wrong slugs (Phase 2 found 9 dead links in solutions). Valid Learn
slugs are the 8 in `lib/marketing/learn-articles.ts`; valid resources are the 3
in `lib/marketing/resources.ts`. Validate every internal link you emit against
the real routes (`curl` them) and report fixes.

---

## Workstream A — `/industries` hub + 6 verticals + 2 experimental (Opus)

Files: `app/industries/page.tsx`, `app/industries/[slug]/page.tsx`, new
`lib/marketing/industries.ts` (move the inline `INDUSTRIES` object out of the
page; keep grounded content, reframe Vyso→Finch, fix links; add per-vertical
`exampleFindings: FindingCardProps[]` ×3, `agents: {name,status}[]`, `modules:
slug[]`, `learn: slug[]`), new `components/finch/industries/*`.

Hub `/industries`: eyebrow `WHO FINCH WORKS FOR`, `<h1>` "Built for operations-
heavy South African food businesses.", sub. Primary grid (6): food-suppliers
(first), farms, restaurants, catering-companies, wholesale, hospitality — cards
with one vertical-specific example finding line + agents chips. Below, a quiet
row **"Also watching"** with the two experimental verticals (smaller cards, mono
`EXPERIMENTAL` chip) — the ONLY place they're linked besides the sitemap. Hub
JSON-LD `ItemList`.

Vertical pages (8): hero — eyebrow `<VERTICAL> · SOUTH AFRICA`, `<h1>` in the
vertical's vocabulary (e.g. food-suppliers "Every invoice, delivery note and
price list — read before you've had coffee."), sub, CTA → `/operations-audit`;
**signature visual (unique to industries): the finding deck** — three vertical-
specific FindingCards fanned (rotate −4°/0/4°, offset), straightening and
stacking on enter (600ms ease-out, once); hover brings one forward; mobile: the
three stacked vertically. Then "What Finch watches in a <vertical>" (4–6 rows,
each: agent label + one line in the vertical's words + status chip); "Modules
under the hood" chips → `/platform/modules/<slug>`; a short "How the audit runs
for a <vertical>" (3 sentences); related Learn (validated slugs) + related
solutions; 4 FAQs (FAQPage); AuditBand. Metadata per vertical ("Operations
software for food suppliers in South Africa — Finch by Vyso").

Experimental verticals (content per vyso_v2 §2.2, honest framing "Finch is
built for operations-heavy SMEs; here's what it watches in a security business /
brokerage"): `security-companies` — guard rostering vs contract hours, client-
site profitability, supplier/vehicle cost creep, incident-report intake via
Doc-U, invoice-to-contract reconciliation; `insurance-brokers` — renewal
tracking, commission-statement reconciliation (Doc-U), client follow-up cadence,
document-heavy admin. No fake case studies; example FindingCards clearly
`ILLUSTRATIVE`. Indexed, in sitemap, `data-vertical="<slug>"` on the page's
CTA links (hook for Phase 4 analytics), NOT in nav/homepage/footer.

Sitemap: ensure all 8 vertical URLs present (add the two experimental).

Verify: tsc/eslint; 9 pages 200, one h1; deck plays in a visible tab; every
Learn/solutions/module link 200; JSON-LD parses; grep gates; 1440/375.

## Workstream B — `/founding-client`, `/case-studies`, `/case-studies/turn-n-slice`, `/south-africa` (Sonnet)

Files: those four `app/**/page.tsx`, new `components/finch/company/*`
(shared small bits allowed within this workstream only), `lib/marketing/
founding.ts` (terms + commitments copy).

`/founding-client`: `<h1>` "Founding client terms." Terms strip (setup waived ·
first month free · rate locked — reveal left→right), what a founding client
gets (audit → roadmap → agents in priority order → monthly ops review with your
Vyso lead → a direct line to the founder), what we ask (feedback, a monthly
call, permission to quote an outcome once it's real), **signature visual: the
cohort row** — 8 quiet circles; fill only what is true (Turn 'n Slice = 1
filled, labelled), the rest hollow with mono `OPEN`; link to the case study;
FAQs (from `lib/marketing/faq.ts` pricing/terms answers — import, don't
duplicate text); AuditBand.

`/case-studies` + `/case-studies/turn-n-slice`: **copy refresh only, no claim
changes** — every quote and fact stays verbatim (Roberto's quotes, "OrderFlow
replacing QuickBooks", the four capabilities). Reskin to Finch; case study
gets `Article` schema (author Organization Vyso, `about` Turn 'n Slice as
Organization; NO Review/rating). **Signature visual: the "price list in
seconds" micro-demo** — on enter, a mono item name types in and a priced row
appears (once, ≤ 1.5s; reduced motion → final state). Hub lists the one case
study honestly ("More as founding clients go live.").

`/south-africa`: `<h1>` "Built for how South African operations actually run."
Keep the grounded local content (ZAR, VAT-aware documents, POPIA, SARS refs) —
verify each claim still holds in the product before keeping it (grep
`lib/platform` for VAT/POPIA handling; drop what you can't ground). **Signature
visual: an SA outline SVG with one pulse at Johannesburg** (single pulse then
static; hand-drawn simplified outline is fine — no map libraries). Cities line:
"Johannesburg HQ · working with businesses nationally". `areaServed` ZA in
page schema; no street address. FAQs (FAQPage); AuditBand.

Verify: tsc/eslint; 4 pages 200, one h1; quotes byte-identical to before (diff
the strings); links 200; JSON-LD parses; grep gates; 1440/375.

## Workstream C — `/about`, `/academy`, `/privacy`, `/terms`, `/popia` (Sonnet)

Files: `app/about/page.tsx` (rebuild), `app/academy/page.tsx` (new),
`app/privacy/page.tsx` (reskin), `app/terms/page.tsx` (new), `app/popia/page.tsx`
(new), new `components/finch/legal/*` (reading layout), `next.config.ts` (remove
the `/about → /platform` redirect — single minimal edit, re-read first),
`app/sitemap.ts` (add `/about`, `/academy`, `/terms`, `/popia`), `components/ContactForm.tsx`
ONLY to add `variant="academy"` (fields: name, email, business type select;
button "Register interest"; success FindingCard "ACADEMY · Interest noted ·
We'll write when the first cohort opens") + `app/api/contact/route.ts` ONLY to
accept `variant: "academy"` and `businessType` (same validation patterns).

`/about`: `<h1>` "Vyso, the company." Founder (Josh Moreira, Johannesburg —
no invented bio facts: use only what's in the repo/`lib/marketing/site.ts`;
leave a clearly marked `{/* TODO(user): photo + 2-line bio */}` slot), why
Finch (positioning), the honest stage (founding cohort, first customer Turn 'n
Slice), what Vyso does beyond Finch (audits, Academy), principles (evidence
first · rand not vibes · your tools not ours · we tell you if you don't need
us). **Signature visual: a vertical timeline hairline that draws on scroll**
with milestones — ONLY dated if the date is real (repo git history / case study
give: Turn 'n Slice founding customer; homepage/pricing rebuild Aug 2026 —
otherwise undated). `Person` + `Organization` schema (sameAs from `SITE`).

`/academy`: `<h1>` "Vyso Academy — the DIY option." What it will be
(workshops, templates, the weekly-brief discipline), R500 / seat, `COMING
SOON` chip, curriculum outline as 4 quiet modules (marked "planned"), the
interest form (academy variant). **Signature visual: the seat grid** — 12
circles; a signup fills one client-side for the session (honest gesture, no
fake counts; SSR shows all hollow). Schema: `Course` only as `Offer
availability: PreOrder` inside the existing Product graph — actually simpler:
NO Course schema until real; Breadcrumb only.

Legal: `/privacy` keep the current text verbatim, reskin into the reading
layout (STIX headings, 17px body, max-w 720). `/terms`: draft from FACTS ONLY
already on the site (R6,000/location/month; audit R2,000 credited; 30 days'
notice; founding terms; POPIA compliance statement from privacy; SA law) — mark
with a mono chip `DRAFT · UNDER LEGAL REVIEW`, `robots: noindex` until Josh
approves, and a `TODO(user)` comment. `/popia`: a short POPIA/PAIA information
page (Information Officer: Josh Moreira; the contact email; link to the
privacy policy; PAIA manual "available on request") — same draft chip +
noindex. Footer Legal column links to all three (Workstream C may edit
`components/finch/FinchFooter.tsx` for the Legal column ONLY — Workstream D
must not touch it).

Verify: tsc/eslint; `/about` 200 (no redirect); 5 pages one h1; academy form
submits (stub fetch — real key present); JSON-LD parses; sitemap updated;
grep gates; 1440/375.

## Workstream D — `/learn` + 8 articles + `/learn/glossary` + `/resources` + 3 (Opus)

Files: `app/learn/page.tsx`, `app/learn/[slug]/page.tsx`, new
`app/learn/glossary/page.tsx`, `app/learn/glossary/[term]/page.tsx`,
`lib/marketing/learn-articles.ts` (fix the Start-tier paragraph in
`how-much-time-can-workflow-automation-save`; reframe Vyso→Finch where it
reads naturally; add `author`, `datePublished`/`dateModified` ONLY if derivable
from git (`git log --follow --format=%aI -- <file>` — if not per-article, use
the file's first/last commit dates for all and say so), `sources[]` where the
article cites anything — leave existing claims untouched otherwise), new
`lib/marketing/glossary.ts` (12 terms to start — the highest-value ones: fractional
COO, operations audit, money leakage, gross margin vs markup, debtors ageing,
delivery-note reconciliation, price creep, stock cover days, VAT-inclusive
pricing, POPIA, weekly brief, invoice line item; each: 60–120-word direct
definition first, "why it matters for an SA food business", one FindingCard
example, related terms/articles; `DefinedTerm`/`DefinedTermSet` schema), `app/resources/page.tsx`,
`app/resources/[slug]/page.tsx`, `lib/marketing/resources.ts` (reframe only),
new `components/finch/learn/*`, `app/sitemap.ts` (add glossary URLs — single
minimal edit, re-read first; C also edits it), FinchNav `active="learn"`.

`/learn`: `<h1>` "Operations knowledge, not sales copy." category filter
(progressive enhancement), featured article, grid; link to Glossary and
Resources. Article layout: reading column max-w 720, TOC (sticky ≥ lg,
current-heading highlight), author box (Josh Moreira — from `SITE`), sources
block, related agents (→ `/#agents`), related solutions/industries (validated
links), end FindingCard + AuditBand. **Signature visual (learn only): the
reading-progress hairline** (1px ink, top of viewport, `useScroll` progress;
reduced motion → hidden). `Article` schema with author Person, dates, `about`.
Resources: `<h1>` "Practical tools, not another ebook."; cards with a **page-
flip hover** (rotateX 6°, 200ms — unique to resources); detail pages keep the
existing preview content + `ContactForm variant="general"` (do not create a new
variant) framed as "Send me the <resource>". Glossary hub: alphabetical list
with the first sentence of each definition; term pages per above.

Verify: tsc/eslint; learn hub + 8 articles + glossary hub + 12 terms +
resources hub + 3 detail = 25 pages 200 with one h1; every internal link 200;
Article/DefinedTerm JSON-LD parses; the Start-tier text is gone (grep `Start
tier`); progress hairline works in a visible tab; grep gates; 1440/375.

---

## Phase-level verification (architect)

tsc (3 known), lint no new, all Phase 3 routes 200/one h1, `/about` no
redirect, sitemap contains industries ×8, about, academy, terms, popia,
glossary ×13; grep gates; each signature widget in exactly one route; internal
link check across the new pages (script: extract hrefs from SSR HTML, curl
each, expect 200/308); Josh eyeballs deck, timeline, map, micro-demo.

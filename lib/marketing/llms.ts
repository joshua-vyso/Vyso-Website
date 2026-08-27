/* ── /llms.txt + /llms-full.txt builders ─────────────────────────────────────
   `.ai/vyso_v2.md` §7.4: a curated, plain-language index of what Vyso/Finch
   is, for the LLMs and answer engines that read `/llms.txt` (the emerging,
   unofficial convention — https://llmstxt.org) instead of crawling the whole
   site. Every fact below is read out of the data files
   `.ai/plan_phase4_search_ai_visibility.md` names at the top — pricing,
   founding terms, the FAQ, the glossary, per-industry/solution/module/
   integration copy — never hand-typed, so this file cannot state a number the
   rest of the site doesn't already state. Regenerating either output means
   editing a data file and redeploying; nothing here is cached beyond the
   route handlers' own `Cache-Control`.

   The one deliberate exception: the handful of real pages that have no
   corresponding marketing data file (`/about`, `/academy`, `/contact`, the
   case-study pages, `/south-africa`, the legal pages, the hub hand-off pages
   with no `HUB` export of their own). Those get a plain navigational label —
   "About Vyso", "Academy" — paired with their canonical URL. A page label is
   not a claim an engine could cite as fact, so it carries none of the honesty
   risk a rand figure or a definition would; it is the same kind of entry a
   sitemap or a footer nav already carries. Nothing about what those pages
   *say* is asserted here.

   `.ai/plan_vyso_redesign_2026.md` §7.6/§8 (Phase 3): the "Product"/"Facts"
   overview at the top of `/llms.txt` no longer names Finch or a rand figure;
   it now reads `faq.ts`'s current "vyso"/"pricing" groups (see the
   `VYSO_GROUP`/`PRICING_GROUP` lookups below), which fixed a real bug: this
   file's old "finch" group lookup started throwing the moment an earlier
   phase rewrote `faq.ts` without one. `/solutions` and `/industries` already
   read `SOLUTION_LIST`/`INDUSTRY_LIST` (their registries), so the eight
   solutions and three industries this redesign settled on appear with no
   further edit. Phase 4 deleted the Modules/Compare/Founding routes and,
   in this file, the sections and imports that described them (plan §12's
   same-phase rule for a sitemap/llms.ts entry and its redirect). */

import { SITE } from "./site";
import { INDUSTRY_LIST, HUB as INDUSTRIES_HUB } from "./industries";
import { SOLUTION_LIST, HUB as SOLUTIONS_HUB } from "./solutions";
import { INTEGRATION_DETAILS, DONT_SEE_YOUR_TOOL } from "./integrations";
import { FAQ_GROUPS } from "./faq";
import { GLOSSARY_ALPHABETICAL, GLOSSARY_HUB, firstSentence } from "./glossary";
import { LEARN_ARTICLES } from "./learn-articles";
import { RESOURCES } from "./resources";
import { ORBIT_ARTICLES } from "@/lib/orbit/articles";
import { ORBIT_COMPARISONS } from "@/lib/orbit/compare";
import { ORBIT_FAQ_GROUPS } from "@/lib/orbit/faq";
import { ORBIT_PLAN } from "@/lib/orbit/pricing";
import { ORBIT, ORBIT_STATIC_ROUTES } from "@/lib/orbit/site";
import { TRADES } from "@/lib/orbit/trades";

const BASE_URL = SITE.url;
const url = (path: string) => `${BASE_URL}${path}`;

/* ── Shared building blocks ──────────────────────────────────────────────── */

/* `.ai/plan_vyso_redesign_2026.md` §7.6/§8: `faq.ts`'s old "finch" group and
   its "what-is-finch" question are gone (rewritten in an earlier phase to a
   "vyso" group with "what-is-vyso" — Finch is retired from public copy). This
   builder used to read that group directly and threw if it went missing,
   which it did the moment `faq.ts` was rewritten; fixed here by reading the
   registry's current shape instead of the old one, keeping the same
   fail-loud contract so a future rename is caught at build time rather than
   shipping a blank line in `/llms.txt`. Same fix for `CAN_WE_CANCEL`, which
   read `components/finch/pricing/pricing-data.ts` (still Finch-branded,
   still names a rand figure — out of this phase's scope, see plan §7.6's
   "leave modules/compare/founding sections in place for Phase 4"): the
   top-level Product/Facts section of this file is not one of those sections,
   so it now quotes `faq.ts`'s own, current, price-free answer instead. */
const VYSO_GROUP = FAQ_GROUPS.find((g) => g.id === "vyso");
const WHAT_IS_VYSO = VYSO_GROUP?.questions.find((q) => q.id === "what-is-vyso")?.answer;
if (!WHAT_IS_VYSO) {
  throw new Error('lib/marketing/llms.ts: faq.ts has no "vyso" group / "what-is-vyso" question.');
}

const PRICING_GROUP = FAQ_GROUPS.find((g) => g.id === "pricing");
const HOW_MUCH_DOES_VYSO_COST = PRICING_GROUP?.questions.find(
  (q) => q.id === "how-much-does-vyso-cost",
)?.answer;
if (!HOW_MUCH_DOES_VYSO_COST) {
  throw new Error('lib/marketing/llms.ts: faq.ts has no "pricing" group / "how-much-does-vyso-cost" question.');
}

const ONGOING_SUPPORT = PRICING_GROUP?.questions.find(
  (q) => q.id === "does-vyso-offer-ongoing-support",
)?.answer;
if (!ONGOING_SUPPORT) {
  throw new Error(
    'lib/marketing/llms.ts: faq.ts has no "pricing" group / "does-vyso-offer-ongoing-support" question.',
  );
}

const AUDIT_TERM = GLOSSARY_ALPHABETICAL.find((t) => t.slug === "operations-audit");
if (!AUDIT_TERM) {
  throw new Error('lib/marketing/llms.ts: glossary.ts has no "operations-audit" term.');
}
const AUDIT_FIRST_SENTENCE = firstSentence(AUDIT_TERM.definition.join(" "));

type PageEntry = { label: string; url: string };

/** The full page index both files share. Industries, solutions and the
    glossary are generated from their registries — a slug added there appears
    here automatically; nothing is listed twice. */
function buildPageIndex(): PageEntry[] {
  return [
    { label: "Home: Vyso, AI operations company in South Africa", url: url("/") },
    { label: "How it works", url: url("/how-it-works") },
    { label: "Operations Audit: free, about an hour", url: url("/operations-audit") },
    /* The two tools under the audit. Listed by hand rather than generated: this
       index is built from the content registries (industries, solutions,
       modules, glossary), and these two are pages, not registry entries. */
    { label: "Operations self-assessment: ten questions, scored", url: url("/operations-audit/score") },
    { label: "Manual work calculator: what manual work costs a month", url: url("/operations-audit/calculator") },
    { label: INDUSTRIES_HUB.title, url: url("/industries") },
    ...INDUSTRY_LIST.map((i) => ({ label: i.name, url: url(`/industries/${i.slug}`) })),
    { label: SOLUTIONS_HUB.title, url: url("/solutions") },
    ...SOLUTION_LIST.map((s) => ({ label: s.name, url: url(`/solutions/${s.slug}`) })),
    { label: "Integrations", url: url("/integrations") },
    { label: "FAQ", url: url("/faq") },
    { label: "About Vyso", url: url("/about") },
    { label: "Case studies", url: url("/case-studies") },
    { label: "Case study: Turn 'n Slice", url: url("/case-studies/turn-n-slice") },
    { label: "Vyso in South Africa", url: url("/south-africa") },
    { label: "Insights: operations articles", url: url("/learn") },
    { label: GLOSSARY_HUB.title, url: url("/learn/glossary") },
    { label: "Resources", url: url("/resources") },
    { label: "Contact", url: url("/contact") },

    /* Orbit — the second product surface, at `/orbit`. Generated from the same
       registries `app/sitemap.ts` reads. Listed here rather than in a section
       of its own so an engine reading only the page index still finds it; the
       facts about Orbit have their own section below, and `/llms-full.txt`
       carries the depth. */
    ...ORBIT_STATIC_ROUTES.map((route) => ({ label: route.label, url: url(route.path) })),
    ...TRADES.map((trade) => ({
      label: `Orbit for ${trade.name.toLowerCase()}`,
      url: url(`/orbit/for/${trade.slug}`),
    })),
    ...ORBIT_ARTICLES.map((article) => ({
      label: article.title,
      url: url(`/orbit/learn/${article.slug}`),
    })),
  ];
}

const formatPages = (pages: readonly PageEntry[]) =>
  pages.map((p) => `- [${p.label}](${p.url})`).join("\n");

/* ── /llms.txt ────────────────────────────────────────────────────────────
   The short index: entity statement, the product/price/audit in one line
   each, the full page list, the settled facts, contact. Kept deliberately
   thin — `/llms-full.txt` carries the depth. */

export function buildLlmsTxt(): string {
  const pages = buildPageIndex();

  return `# Vyso: automation that knows what happens next

${SITE.description}

## Product
- What Vyso is: ${WHAT_IS_VYSO}
- Pricing: ${HOW_MUCH_DOES_VYSO_COST}
- Operations Audit: ${AUDIT_FIRST_SENTENCE} Vyso's is free and takes about an hour with you.

## Pages
${formatPages(pages)}

## Facts
- Operations Audit: free, about an hour, no obligation. What follows is priced per customer and per scope, quoted directly, never published.
- ${ONGOING_SUPPORT}
- Expanded mandates (multi-entity groups, custom integrations) are priced on scope.
- Vyso is based in ${SITE.address.addressLocality}, ${SITE.address.addressCountry === "ZA" ? "South Africa" : SITE.address.addressCountry}. It serves South African SMEs, with the deepest experience in food distribution and wholesale operations. Locale: ${SITE.locale}.

## Orbit (second product — in development)
- What Orbit is: ${ORBIT.description}
- Status: ${ORBIT.status} Nothing about Orbit describes a shipped product; the site marks every unreleased capability as roadmap.
- Price: ${ORBIT_PLAN.directAnswer}
- Who it is for: one- and two-person South African trade businesses — ${TRADES.map((t) => t.name.toLowerCase()).join(", ")}.
- How it works: ${ORBIT.promise}
- Rule: ${ORBIT.draftsOnly} Orbit never sends anything to a customer on the user's behalf.
- Built on: ${ORBIT.builtOn}
- Waitlist: ${url("/orbit/waitlist")}

## Contact
- Email: ${SITE.email}
- Web: ${SITE.url}
`;
}

/* ── /llms-full.txt ──────────────────────────────────────────────────────── */

function buildFaqSection(): string {
  return FAQ_GROUPS.map((group) => {
    const questions = group.questions
      .map((q) => `### ${q.question}\n${q.answer}`)
      .join("\n\n");
    return `### ${group.title}\n\n${questions}`;
  }).join("\n\n");
}

function buildGlossarySection(): string {
  return GLOSSARY_ALPHABETICAL.map((term) => {
    const aka = term.aka && term.aka.length > 0 ? ` (also called: ${term.aka.join(", ")})` : "";
    return `### ${term.term}${aka}\n${term.definition.join(" ")}\n${url(`/learn/glossary/${term.slug}`)}`;
  }).join("\n\n");
}

function buildIndustriesSection(): string {
  return INDUSTRY_LIST.map((industry) => {
    const agentLines = industry.agents
      .map((a) => `  - ${a.label} (${a.status}): ${a.watches}`)
      .join("\n");
    return `### ${industry.name}\n${industry.lead}\n${industry.watchIntro}\n${agentLines}\n${url(`/industries/${industry.slug}`)}`;
  }).join("\n\n");
}

function buildSolutionsSection(): string {
  return SOLUTION_LIST.map(
    (s) => `### ${s.name}\n${s.summary}\n${url(`/solutions/${s.slug}`)}`,
  ).join("\n\n");
}

function buildIntegrationsSection(): string {
  const rows = INTEGRATION_DETAILS.map((i) => `### ${i.name}: ${i.status}\n${i.reads}`).join(
    "\n\n",
  );
  return `${rows}\n\n${DONT_SEE_YOUR_TOOL}`;
}

function buildLearnSection(): string {
  return LEARN_ARTICLES.map(
    (a) => `### ${a.title}\n${a.description}\n${url(`/learn/${a.slug}`)}`,
  ).join("\n\n");
}

function buildResourcesSection(): string {
  return RESOURCES.map(
    (r) => `### ${r.title}\n${r.summary}\n${url(`/resources/${r.slug}`)}`,
  ).join("\n\n");
}

/* ── Orbit, in full ──────────────────────────────────────────────────────────
   Same discipline as every builder above: read out of `lib/orbit/*`, never
   retyped. The one thing this section adds that the others do not is an
   explicit status line per subsection — an engine summarising Vyso should not
   be able to come away describing Orbit as something a person can buy. */

function buildOrbitSection(): string {
  const trades = TRADES.map(
    (trade) => `### Orbit for ${trade.name.toLowerCase()}\n${trade.lead}\n${url(`/orbit/for/${trade.slug}`)}`,
  ).join("\n\n");

  const faqs = ORBIT_FAQ_GROUPS.map((group) => {
    const questions = group.questions.map((q) => `#### ${q.question}\n${q.answer}`).join("\n\n");
    return `### ${group.title}\n\n${questions}`;
  }).join("\n\n");

  const comparisons = ORBIT_COMPARISONS.map(
    (c) => `### ${c.h1.replace(/\.$/, "")}\n${c.answer}\n${url(`/orbit/compare/${c.slug}`)}`,
  ).join("\n\n");

  const articles = ORBIT_ARTICLES.map(
    (a) => `### ${a.title}\n${a.standfirst}\n${url(`/orbit/learn/${a.slug}`)}`,
  ).join("\n\n");

  return `## Orbit

${ORBIT.description}

**Status: ${ORBIT.status}**

${ORBIT.promise}

${ORBIT.builtOn}

${ORBIT.draftsOnly}

### Pricing
${ORBIT_PLAN.directAnswer}
${ORBIT.price.vatNote}
Included: ${ORBIT_PLAN.included.join("; ")}.
Not in the first release (roadmap): ${ORBIT_PLAN.notIncluded.join("; ")}.
${url("/orbit/pricing")}

### Trades

${trades}

### Orbit FAQ

${faqs}

### Orbit comparisons

${comparisons}

### Orbit guides

${articles}
`;
}

export function buildLlmsFullTxt(): string {
  return `${buildLlmsTxt()}
---

## Full FAQ

${buildFaqSection()}

## Glossary

${GLOSSARY_HUB.lead}

${buildGlossarySection()}

## Industries: what Vyso watches

${buildIndustriesSection()}

## Solutions

${buildSolutionsSection()}

## Integrations

${buildIntegrationsSection()}

## Learn articles

${buildLearnSection()}

## Resources

${buildResourcesSection()}

${buildOrbitSection()}
`;
}

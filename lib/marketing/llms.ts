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
   *say* is asserted here.                                                    */

import { SITE } from "./site";
import {
  PRICE,
  DIRECT_ANSWER,
  FOUNDING_TERMS,
  CANONICAL_URL as PRICING_URL,
  STRAIGHT_ANSWERS,
} from "@/components/finch/pricing/pricing-data";
import { INDUSTRY_LIST, HUB as INDUSTRIES_HUB } from "./industries";
import { SOLUTION_LIST, HUB as SOLUTIONS_HUB } from "./solutions";
import { HUB as COMPARE_HUB, COO, ERP, SPREADSHEETS, SALARY } from "./compare";
import { MARKETING_MODULES } from "./modules";
import { INTEGRATION_DETAILS, DONT_SEE_YOUR_TOOL } from "./integrations";
import { FAQ_GROUPS } from "./faq";
import { GLOSSARY_ALPHABETICAL, GLOSSARY_HUB, firstSentence } from "./glossary";
import { LEARN_ARTICLES } from "./learn-articles";
import { RESOURCES } from "./resources";
import {
  CANONICAL_URL as FOUNDING_URL,
  TITLE as FOUNDING_TITLE,
  DESCRIPTION as FOUNDING_DESCRIPTION,
} from "./founding";
import { ORBIT_ARTICLES } from "@/lib/orbit/articles";
import { ORBIT_COMPARISONS } from "@/lib/orbit/compare";
import { ORBIT_FAQ_GROUPS } from "@/lib/orbit/faq";
import { ORBIT_PLAN } from "@/lib/orbit/pricing";
import { ORBIT, ORBIT_STATIC_ROUTES } from "@/lib/orbit/site";
import { TRADES } from "@/lib/orbit/trades";

const BASE_URL = SITE.url;
const url = (path: string) => `${BASE_URL}${path}`;

/** "R6,000" — the comma-thousands form the site's own copy uses throughout
    (deck findings, pricing page, FAQ), not `Intl`'s en-ZA space separator. */
const rand = (amount: number) => `R${amount.toLocaleString("en-US")}`;

/* ── Shared building blocks ──────────────────────────────────────────────── */

const FINCH_GROUP = FAQ_GROUPS.find((g) => g.id === "finch");
const WHAT_IS_FINCH = FINCH_GROUP?.questions.find((q) => q.id === "what-is-finch")?.answer;
if (!WHAT_IS_FINCH) {
  throw new Error('lib/marketing/llms.ts: faq.ts has no "finch" group / "what-is-finch" question.');
}

const CAN_WE_CANCEL = STRAIGHT_ANSWERS.find((a) => a.question === "Can we cancel?")?.answer;
if (!CAN_WE_CANCEL) {
  throw new Error('lib/marketing/llms.ts: pricing-data.ts has no "Can we cancel?" straight answer.');
}

const AUDIT_TERM = GLOSSARY_ALPHABETICAL.find((t) => t.slug === "operations-audit");
if (!AUDIT_TERM) {
  throw new Error('lib/marketing/llms.ts: glossary.ts has no "operations-audit" term.');
}
const AUDIT_FIRST_SENTENCE = firstSentence(AUDIT_TERM.definition.join(" "));

type PageEntry = { label: string; url: string };

/** The full page index both files share. Industries, solutions, compare,
    modules and the glossary are generated from their registries — a slug
    added there appears here automatically; nothing is listed twice. */
function buildPageIndex(): PageEntry[] {
  return [
    { label: "Home — Finch, the product", url: url("/") },
    { label: "Pricing", url: PRICING_URL },
    { label: "Operations Audit", url: url("/operations-audit") },
    /* The two tools under the audit. Listed by hand rather than generated: this
       index is built from the content registries (industries, solutions,
       modules, glossary), and these two are pages, not registry entries. */
    { label: "Operations self-assessment — ten questions, scored", url: url("/operations-audit/score") },
    { label: "Manual work calculator — what manual work costs a month", url: url("/operations-audit/calculator") },
    { label: INDUSTRIES_HUB.title, url: url("/industries") },
    ...INDUSTRY_LIST.map((i) => ({ label: i.name, url: url(`/industries/${i.slug}`) })),
    { label: SOLUTIONS_HUB.title, url: url("/solutions") },
    ...SOLUTION_LIST.map((s) => ({ label: s.name, url: url(`/solutions/${s.slug}`) })),
    { label: COMPARE_HUB.h1, url: COMPARE_HUB.canonical },
    { label: COO.h1, url: COO.canonical },
    { label: ERP.h1, url: ERP.canonical },
    { label: SPREADSHEETS.h1, url: SPREADSHEETS.canonical },
    { label: "All modules", url: url("/platform/modules") },
    ...MARKETING_MODULES.map((m) => ({ label: `${m.name} — ${m.role}`, url: url(`/platform/modules/${m.slug}`) })),
    { label: "Integrations", url: url("/integrations") },
    { label: "FAQ", url: url("/faq") },
    { label: "About Vyso", url: url("/about") },
    { label: "Academy (coming soon)", url: url("/academy") },
    { label: "Case studies", url: url("/case-studies") },
    { label: "Case study: Turn 'n Slice", url: url("/case-studies/turn-n-slice") },
    { label: "Vyso in South Africa", url: url("/south-africa") },
    { label: "Learn — operations articles", url: url("/learn") },
    { label: GLOSSARY_HUB.title, url: url("/learn/glossary") },
    { label: "Resources", url: url("/resources") },
    { label: FOUNDING_TITLE, url: FOUNDING_URL },
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

  return `# Vyso — Finch, your company's own COO

${SITE.description}

## Product
- What Finch is: ${WHAT_IS_FINCH}
- Price: ${DIRECT_ANSWER}
- Operations Audit: ${AUDIT_FIRST_SENTENCE} It costs ${rand(PRICE.audit)}, credited against the first month.

## Pages
${formatPages(pages)}

## Facts
- ${rand(PRICE.finch)} per location per month, everything included — every module and agent, activated in priority order from the operations audit, plus a monthly ops review with a Vyso lead.
- Operations Audit: ${rand(PRICE.audit)}, one week, credited to the first month.
- Founding-client terms: ${FOUNDING_TERMS.join(", ")}.
- ${CAN_WE_CANCEL}
- Expanded mandates (multi-entity groups, custom integrations) are priced on scope.
- Vyso is based in ${SITE.address.addressLocality}, ${SITE.address.addressCountry === "ZA" ? "South Africa" : SITE.address.addressCountry}. It serves South African food and produce SMEs. Locale: ${SITE.locale}.

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

function buildModulesSection(): string {
  return MARKETING_MODULES.map(
    (m) => `### ${m.name} — ${m.role}\n${m.tagline}\n${url(`/platform/modules/${m.slug}`)}`,
  ).join("\n\n");
}

function buildIntegrationsSection(): string {
  const rows = INTEGRATION_DETAILS.map((i) => `### ${i.name} — ${i.status}\n${i.reads}`).join(
    "\n\n",
  );
  return `${rows}\n\n${DONT_SEE_YOUR_TOOL}`;
}

function buildCompareSection(): string {
  const rows = [COO, ERP, SPREADSHEETS]
    .map((c) => `### ${c.h1.replace(/\.$/, "")}\n${c.answer}\n${c.canonical}`)
    .join("\n\n");
  const salary = `The only external number in this cluster: ${SALARY.role} average base salary in South Africa is ${rand(
    SALARY.monthlyLow ?? 0,
  )}–${rand(SALARY.monthlyHigh ?? 0)} per month (${SALARY.detail.toLowerCase()}), per ${SALARY.publisher} (${SALARY.year}). Source: ${SALARY.url}`;
  return `${COMPARE_HUB.answer}\n\n${rows}\n\n${salary}`;
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

## Industries — what Finch watches

${buildIndustriesSection()}

## Solutions

${buildSolutionsSection()}

## Modules

${buildModulesSection()}

## Integrations

${buildIntegrationsSection()}

## Compare

${buildCompareSection()}

## Learn articles

${buildLearnSection()}

## Resources

${buildResourcesSection()}

## Founding client

${FOUNDING_DESCRIPTION}
${FOUNDING_URL}

${buildOrbitSection()}
`;
}

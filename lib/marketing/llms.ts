import { CAPABILITY_GROUPS, HOME_FAQ, INTEGRATION_SYSTEMS, PROCESS_STEPS } from "@/components/site/content";
import { INDUSTRY_PAGES } from "@/components/site/industries-content";
import { SITE } from "./site";

/* ── llms.txt / llms-full.txt ────────────────────────────────────────────────
   Rebuilt for the agency positioning (2026-09). Same rule as the previous
   generator: nothing is hand-typed that a page doesn't also say — content is
   drawn from the same registries the pages render (`components/site/content`,
   `industries-content`), so this file can never claim something the site
   doesn't. No prices exist anywhere on the site, so none appear here. */

function pageIndex(): string {
  return [
    `- ${SITE.url}/ — Vyso, AI automation agency (Johannesburg): positioning, capability groups, process, illustrative operational-brief demo, FAQ`,
    `- ${SITE.url}/automations — Systems Vyso has built (an operating system for a Johannesburg food wholesaler; a lead engine that drafts but never sends; an invoicing + CRM tracker; order capture from WhatsApp and email) and the five capability groups behind every build`,
    `- ${SITE.url}/industries — Industry overview (food & hospitality, construction, insurance)`,
    ...INDUSTRY_PAGES.map(
      (industry) => `- ${SITE.url}/industries/${industry.slug} — ${industry.metaDescription}`,
    ),
    `- ${SITE.url}/integrations — Systems in production today and systems commonly connected, explained as workflows`,
    `- ${SITE.url}/about — What Vyso is, how engagements run, contact details`,
    `- ${SITE.url}/join — Book a free audit (the site's one conversion path)`,
    `- ${SITE.url}/construction — Vyso Construction: an experimental AI commercial-control product for South African specialist subcontractors (instruction → variation → certification → payment), waitlist open`,
  ].join("\n");
}

const FACTS = [
  `Vyso is an AI automation agency in Johannesburg, South Africa, founded by ${SITE.founder.name}.`,
  "Vyso designs, builds and operates bespoke AI automation systems around the software a business already uses. Its positioning line is: we build the systems that run your business.",
  "Vyso builds five kinds of system: reading documents, checking numbers (reconciliation), watching what moves (monitoring and alerts), following up (drafted reminders with approval), and a daily brief.",
  "Every outward action (client messages, disputes, payments) waits for human approval; low-confidence document reads queue for review.",
  `Systems wired into production workflows today: ${INTEGRATION_SYSTEMS.live.join(", ")}. Other systems connect depending on the workflow.`,
  "Vyso publishes no prices; scope and fees are agreed per engagement in writing.",
  "The one public call to action is booking a free audit at /join.",
  "Vyso Construction (/construction) is an experimental product in validation: an AI commercial-control layer that follows the trail from site instruction to variation, certification and payment for specialist subcontractors, electrical contractors in Gauteng first. Its line is: stop doing work you never get paid for. No pricing is published and no recovery results are claimed.",
  `Contact: ${SITE.email}.`,
].join("\n");

export function buildLlmsTxt(): string {
  return `# ${SITE.name}

> ${SITE.description}

## What Vyso does

${CAPABILITY_GROUPS.map((group) => `- **${group.title}** — ${group.automates}`).join("\n")}

## How an engagement runs

${PROCESS_STEPS.map((step, index) => `${index + 1}. ${step.title} — ${step.body}`).join("\n")}

## Pages

${pageIndex()}

## Facts

${FACTS}
`;
}

export function buildLlmsFullTxt(): string {
  const capabilities = CAPABILITY_GROUPS.map(
    (group) => `### ${group.title}

Problem: ${group.problem}
Vyso automates: ${group.automates}
Stays human: ${group.human}
Result: ${group.result}
Example: ${group.example}`,
  ).join("\n\n");

  const industries = INDUSTRY_PAGES.map(
    (industry) => `### ${industry.name}

${industry.lead}

Status: ${industry.status}

${industry.workflows
  .map(
    (workflow) =>
      `- **${workflow.title}** — ${workflow.problem} Flow: ${workflow.flow.join(" → ")}. Human control: ${workflow.human}`,
  )
  .join("\n")}`,
  ).join("\n\n");

  const faq = HOME_FAQ.map((item) => `**Q: ${item.q}**\nA: ${item.a}`).join("\n\n");

  return `${buildLlmsTxt()}
## Capability groups in full

${capabilities}

## Industries in full

${industries}

## FAQ

${faq}

## Integrations

In production today: ${INTEGRATION_SYSTEMS.live.join(", ")}.
Commonly connected (depending on workflow): ${INTEGRATION_SYSTEMS.common.join(", ")}.
`;
}

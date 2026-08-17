import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { AgentChips } from "@/components/finch/modules/AgentChips";
import { ModuleFeatureSection } from "@/components/finch/modules/ModuleFeatureSection";
import { ModuleScreenshotFrame } from "@/components/finch/modules/ModuleScreenshotFrame";
import { StatusChip } from "@/components/finch/modules/StatusChip";
import {
  MARKETING_MODULE_BY_SLUG,
  MARKETING_MODULE_SLUGS,
  getAdjacentModules,
} from "@/lib/marketing/modules";
import { SITE } from "@/lib/marketing/site";

const SOLUTION_LABELS: Record<string, string> = {
  "/solutions/reduce-money-leakage": "Reduce money leakage",
  "/solutions/procurement-automation": "Procurement automation",
  "/solutions/reporting-automation": "Reporting automation",
  "/solutions/operations-dashboard": "Operations dashboard",
};

/* Short, SEO-budget titles (≤60 chars, leading with the module name — the
   query a reader searches). `${name} — ${role}` alone runs past 60 for the
   longer roles (ServiceDen's is 65+ chars), so these are hand-trimmed rather
   than derived, same reasoning as the descriptions below. */
const META_TITLES: Record<string, string> = {
  "doc-u": "Doc-U — document intake & extraction",
  orderflow: "OrderFlow — orders, invoicing & customer ops",
  pricepilot: "PricePilot — pricing & margin recommendations",
  procurepulse: "ProcurePulse — procurement & stock intelligence",
  planwise: "PlanWise — budgeting & forecasting",
  wastewatch: "WasteWatch — wastage & shrinkage",
  shiftboard: "ShiftBoard — labour & scheduling",
  supplysync: "SupplySync — supplier relationships",
  insightgen: "InsightGen — reporting & operational insight",
  serviceden: "ServiceDen — leads, services & invoicing",
};

/* Short, SEO-budget meta descriptions (≤155 chars, numbers + "South Africa"
   where it fits) — kept separate from `module_.description`, which is the
   longer on-page hero paragraph and regularly runs well past that budget. */
const META_DESCRIPTIONS: Record<string, string> = {
  "doc-u":
    "Doc-U turns supplier invoices, statements and delivery notes into structured data every other module reads — built for South Africa.",
  orderflow:
    "OrderFlow runs orders, invoicing and customer accounts in one flow — real screens from Finch, built for South African food and wholesale.",
  pricepilot:
    "PricePilot builds sell prices from live cost and measures realised margin per sale — Finch's pricing module for South African operators.",
  procurepulse:
    "ProcurePulse builds live stock from scanned documents and compares supplier prices per product — Finch's procurement module for South Africa.",
  planwise:
    "PlanWise tracks budget pace and forecast against your goals, measured daily, not at month-end — Finch's planning module for South African operators.",
  wastewatch:
    "WasteWatch logs and costs preventable waste by reason, recipe and shift — Finch's waste-tracking module for South African restaurants and caterers.",
  shiftboard:
    "ShiftBoard rosters shifts with labour cost showing as you build it, and tracks it against sales — Finch's scheduling module for South Africa.",
  supplysync:
    "SupplySync scores supplier reliability, tracks credits owed and flags price moves with their rand impact — Finch's supplier module for South Africa.",
  insightgen:
    "InsightGen turns five modules' own data into a daily brief, rule-based alerts and CSV exports — Finch's reporting module for South African operators.",
  serviceden:
    "ServiceDen runs a Gmail-linked lead pipeline and branded invoicing for service businesses — a limited rollout at Vyso in South Africa today.",
};

export function generateStaticParams() {
  return MARKETING_MODULE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const module_ = MARKETING_MODULE_BY_SLUG[slug];
  if (!module_) return {};

  const title = META_TITLES[slug] ?? `${module_.name} — ${module_.role}`;
  const description = META_DESCRIPTIONS[slug] ?? module_.description.slice(0, 155);
  const url = `${SITE.url}/platform/modules/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: `/platform/modules/${slug}` },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const module_ = MARKETING_MODULE_BY_SLUG[slug];
  if (!module_) notFound();

  const { previous, next } = getAdjacentModules(slug);
  const url = `${SITE.url}/platform/modules/${slug}`;
  const heroShot = module_.screenshots[0];

  const worksWith = module_.worksWith
    .map((entry) => ({ ...entry, module: MARKETING_MODULE_BY_SLUG[entry.slug] }))
    .filter((entry) => Boolean(entry.module));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Under the hood", item: `${SITE.url}/platform/modules` },
          { "@type": "ListItem", position: 3, name: module_.name, item: url },
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#software`,
        name: module_.name,
        applicationCategory: "BusinessApplication",
        applicationSuite: "Finch",
        operatingSystem: "Web browser",
        description: module_.description,
        publisher: { "@id": `${SITE.url}/#organization` },
        featureList: module_.capabilities,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: module_.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <FinchNav />

      <main id="main">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]">
          <nav aria-label="Breadcrumb" className="mb-[20px] font-fn-mono text-[10.5px] tracking-[0.08em] text-fn-muted">
            <Link href="/platform/modules" className="transition-colors duration-150 hover:text-fn-orange-deep">
              UNDER THE HOOD
            </Link>{" "}
            / {module_.name.toUpperCase()}
          </nav>

          <p className="mb-[14px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            {module_.role.toUpperCase()}
          </p>
          <div className="mb-[16px] flex flex-wrap items-center gap-[14px]">
            <h1 className="m-0 font-fn-serif text-[36px] font-medium tracking-[-0.02em] lg:text-[44px]">
              {module_.name}
            </h1>
            <StatusChip status={module_.status} />
          </div>
          <p className="m-0 mb-[20px] max-w-[620px] text-[15.5px] leading-[1.6] text-fn-ink-3 lg:text-[16px]">
            {module_.description}
          </p>

          <AgentChips agents={module_.agents} className="mb-[40px] lg:mb-[56px]" />

          {heroShot ? (
            <ModuleScreenshotFrame
              src={heroShot.src}
              alt={heroShot.alt}
              label={heroShot.label}
              cropTop={heroShot.cropTop}
              priority
              className="max-w-full"
              sizes="(max-width: 1023px) 92vw, 880px"
            />
          ) : null}
        </section>

        {/* ── Feature sections ────────────────────────────────────────────── */}
        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
          aria-labelledby="module-inside-heading"
        >
          <h2 id="module-inside-heading" className="sr-only">
            Inside {module_.name}
          </h2>
          <div className="flex flex-col gap-[56px] lg:gap-[80px]">
            {module_.featureSections.map((section, index) => (
              <ModuleFeatureSection key={section.id} section={section} index={index} />
            ))}
          </div>
        </section>

        {/* ── How Finch uses it ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]">
          <div className="border-t border-fn-line pt-[40px] lg:pt-[48px]">
            <p className="mb-[16px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
              HOW FINCH USES IT
            </p>
            <p className="m-0 max-w-[720px] text-[16px] leading-[1.65] text-fn-ink-2 lg:text-[17px]">
              {module_.howFinchUsesIt}
            </p>
          </div>
        </section>

        {/* ── Workflow ─────────────────────────────────────────────────────── */}
        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
          aria-labelledby="module-workflow-heading"
        >
          <p className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
            HOW IT FITS YOUR WEEK
          </p>
          <h2
            id="module-workflow-heading"
            className="m-0 mb-[32px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:mb-[44px] lg:text-[36px]"
          >
            The routine, not the feature list.
          </h2>
          <ol className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 sm:grid-cols-2 lg:grid-cols-5 lg:gap-[16px]">
            {module_.workflow.map((step, index) => (
              <li key={step.title} className="rounded-[10px] border border-fn-line bg-fn-surface px-[18px] py-[20px]">
                <span className="mb-[10px] block font-fn-mono text-[11px] text-fn-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 mb-[8px] text-[14.5px] font-semibold leading-[1.3] text-fn-ink">
                  {step.title}
                </h3>
                <p className="m-0 text-[13px] leading-[1.5] text-fn-ink-3">{step.copy}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Works with ───────────────────────────────────────────────────── */}
        {worksWith.length > 0 ? (
          <section
            className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
            aria-labelledby="module-works-with-heading"
          >
            <p className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
              WORKS WITH
            </p>
            <h2
              id="module-works-with-heading"
              className="m-0 mb-[32px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:mb-[44px] lg:text-[36px]"
            >
              Connected where the workflow needs it.
            </h2>
            <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-4">
              {worksWith.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/platform/modules/${entry.slug}`}
                  className="group flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[18px] py-[20px] transition-colors duration-150 hover:border-fn-line-hover"
                >
                  <p className="m-0 mb-[6px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted">
                    {entry.module.role.toUpperCase()}
                  </p>
                  <h3 className="m-0 mb-[8px] font-fn-serif text-[18px] font-medium text-fn-ink">
                    {entry.module.name}
                  </h3>
                  <p className="m-0 mb-[14px] text-[13px] leading-[1.5] text-fn-ink-3">{entry.reason}</p>
                  <span className="mt-auto flex items-center gap-[6px] text-[12.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                    Explore {entry.module.name} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Industry fit ─────────────────────────────────────────────────── */}
        {module_.industryFit.length > 0 ? (
          <section
            className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
            aria-labelledby="module-industry-heading"
          >
            <p className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
              WHO IT&rsquo;S FOR
            </p>
            <h2
              id="module-industry-heading"
              className="m-0 mb-[32px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:mb-[44px] lg:text-[36px]"
            >
              Where {module_.name} earns its place.
            </h2>
            <div className="flex flex-wrap gap-[10px]">
              {module_.industryFit.map((industry) => (
                <Link
                  key={industry.href}
                  href={industry.href}
                  title={industry.reason}
                  className="rounded-[99px] border border-fn-line bg-fn-surface px-[14px] py-[8px] text-[13px] font-medium text-fn-ink-2 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
                >
                  {industry.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── FAQs ─────────────────────────────────────────────────────────── */}
        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
          aria-labelledby="module-faq-heading"
        >
          <p className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
            STRAIGHT ANSWERS
          </p>
          <h2
            id="module-faq-heading"
            className="m-0 mb-[32px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:mb-[44px] lg:text-[36px]"
          >
            {module_.name} questions, answered honestly.
          </h2>

          <div className="border-t border-fn-line">
            {module_.faqs.map((faq) => (
              <details key={faq.question} className="group border-b border-fn-line py-[4px]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-[16px] py-[14px] text-[15px] font-medium text-fn-ink transition-colors duration-150 hover:text-fn-orange-deep [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 12 12"
                    className="h-[11px] w-[11px] shrink-0 text-fn-muted transition-transform duration-150 ease-out group-open:rotate-90"
                  >
                    <path
                      d="M4 2.5 L8 6 L4 9.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </summary>
                <p className="m-0 max-w-[720px] pb-[18px] text-[14px] leading-[1.6] text-fn-ink-3">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Related solutions ────────────────────────────────────────────── */}
        {module_.relatedSolutionHrefs.length > 0 ? (
          <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[72px]">
            <p className="mb-[12px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
              WHERE THIS FITS
            </p>
            <div className="flex flex-wrap gap-x-[24px] gap-y-[8px]">
              {module_.relatedSolutionHrefs.map((href) => (
                <Link
                  key={href}
                  href={href}
                  className="text-[14px] font-medium text-fn-ink underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
                >
                  {SOLUTION_LABELS[href] ?? href} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ── Prev/next ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[72px]">
          <div className="flex items-center justify-between gap-[16px] border-t border-fn-line pt-[24px]">
            <Link
              href={`/platform/modules/${previous.slug}`}
              className="group flex flex-col items-start gap-[4px]"
            >
              <span className="font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted">← PREV</span>
              <span className="text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                {previous.name}
              </span>
            </Link>
            <Link
              href={`/platform/modules/${next.slug}`}
              className="group flex flex-col items-end gap-[4px] text-right"
            >
              <span className="font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted">NEXT →</span>
              <span className="text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                {next.name}
              </span>
            </Link>
          </div>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}

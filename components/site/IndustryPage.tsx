import Link from "next/link";
import { PageShell, JsonLd, breadcrumbs } from "@/components/site/PageShell";
import type { IndustryContent } from "@/components/site/industries-content";
import { SITE } from "@/lib/marketing/site";

/* ── Shared composition for the three industry pages ───────────────────────── */

export function IndustryPage({ industry }: { industry: IndustryContent }) {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbs([
          ["Home", "/"],
          ["Industries", "/industries"],
          [industry.name, `/industries/${industry.slug}`],
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${SITE.url}/industries/${industry.slug}#service`,
          name: `AI automation for ${industry.name.toLowerCase()}`,
          serviceType: "AI workflow automation",
          provider: { "@id": `${SITE.url}/#organization` },
          areaServed: "ZA",
          audience: { "@type": "BusinessAudience", name: industry.name },
          description: industry.metaDescription,
        }}
      />

      <header className="mx-auto max-w-[1200px] px-6 pb-16">
        <p className="vy-eyebrow text-ink-3">{industry.eyebrow}</p>
        <h1 className="mt-5 max-w-[860px] text-balance text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          {industry.headline}{" "}
          <em className="vy-serif font-normal italic text-signal-deep">{industry.headlineEm}</em>
        </h1>
        <p className="mt-6 max-w-[640px] text-pretty text-lg leading-relaxed text-ink-2">
          {industry.lead}
        </p>
        <p className="vy-mono mt-6 max-w-[640px] rounded-xl bg-system-tint px-4 py-3 text-[13px] leading-relaxed text-system-deep">
          {industry.status}
        </p>
      </header>

      <section className="mx-auto max-w-[1200px] px-6" aria-label="Workflows">
        <div className="grid gap-5 md:grid-cols-2">
          {industry.workflows.map((workflow) => (
            <article key={workflow.title} className="vy-card flex flex-col p-6 md:p-8">
              <h2 className="text-xl font-semibold leading-snug">{workflow.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{workflow.problem}</p>
              <ol className="mt-5 flex-1 space-y-2.5 border-t border-line-2/70 pt-5">
                {workflow.flow.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed">
                    <span className="vy-mono flex-none text-[11px] leading-[1.7] text-system-deep">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-xl bg-signal-tint/50 px-4 py-3 text-[13px] leading-relaxed text-signal-deep">
                <span className="vy-eyebrow mr-2">Stays human</span>
                {workflow.human}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1200px] px-6" aria-label="A morning with this automation">
        <div className="vy-card-dark overflow-hidden">
          <div className="flex items-center justify-between border-b border-inkline px-6 py-3.5">
            <span className="vy-mono text-xs uppercase tracking-[0.14em] text-ondark-3">
              The morning brief
            </span>
            <span className="vy-mono rounded-md bg-[#2A2418] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-signal-ondark">
              {industry.example.label}
            </span>
          </div>
          <div className="space-y-3 px-6 py-6">
            {industry.example.lines.map((line) => (
              <p key={line} className="vy-mono text-sm leading-relaxed text-ondark-2">
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1200px] px-6 pb-24" aria-labelledby="outcomes-heading">
        <div className="grid gap-10 border-t border-line pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 id="outcomes-heading" className="text-2xl font-semibold tracking-[-0.01em]">
              What changes
            </h2>
            <Link href="/join" className="vy-btn vy-btn-primary mt-8 inline-flex">
              Join the waitlist
            </Link>
          </div>
          <ul className="grid content-start gap-4 sm:grid-cols-2">
            {industry.outcomes.map((outcome) => (
              <li key={outcome} className="flex gap-2.5 leading-relaxed text-ink-2">
                <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-signal" aria-hidden="true" />
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </PageShell>
  );
}

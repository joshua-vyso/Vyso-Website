import { JsonLd, PageHead, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import type { IndustryContent } from "@/components/site/industries-content";
import { REVIEWS } from "@/components/vx/content";
import { Reveal } from "@/components/vx/primitives";
import { ReviewCard } from "@/components/vx/home/Reviews";
import { SITE } from "@/lib/marketing/site";

/* ── Industry page ───────────────────────────────────────────────────────────
   Reads the existing industry registry (`components/site/industries-content`)
   and lays it out in the VX system: headline, answer capsule, the workflows
   as spec cards, a brief plate with the illustrative morning brief, and the
   industry's review voices. */

export function IndustryPage({ industry }: { industry: IndustryContent }) {
  const reviews = REVIEWS.filter((r) => r.sector === industry.name);
  return (
    <VxShell closing={{ line: "Map your", em: "operation." }}>
      <JsonLd
        data={breadcrumbs([
          ["Home", "/"],
          ["Industries", "/industries"],
          [industry.name, `/industries/${industry.slug}`],
        ])}
      />
      <JsonLd data={webPage({ path: `/industries/${industry.slug}`, name: industry.metaTitle, description: industry.metaDescription })} />
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

      <PageHead
        eyebrow={industry.eyebrow}
        title={industry.headline}
        em={industry.headlineEm}
        answer={industry.metaDescription}
        aside={
          <p className="vx-small" style={{ borderLeft: "2px solid var(--vx-signal)", paddingLeft: 16 }}>
            {industry.status}
          </p>
        }
      />

      <section className="vx-wrap" aria-label="Workflows" style={{ paddingBottom: "clamp(56px, 8vw, 120px)" }}>
        <div className="vx-systems" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {industry.workflows.map((w, i) => (
            <Reveal as="article" key={w.title} className="vx-card" delay={(i % 2) * 90}>
              <p className="vx-eyebrow">Workflow 0{i + 1}</p>
              <h2 className="vx-h4" style={{ marginTop: 14 }}>
                {w.title}
              </h2>
              <p className="vx-small" style={{ marginTop: 10 }}>
                {w.problem}
              </p>
              <ol className="vx-flow" style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--vx-paper-line)" }}>
                {w.flow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="vx-mono" style={{ marginTop: 18, fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--vx-text-3)" }}>
                <span style={{ color: "var(--vx-green)" }}>●</span> {w.human}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="vx-wrap" aria-label="Illustrative brief" style={{ paddingBottom: "clamp(56px, 8vw, 120px)" }}>
        <Reveal className="vx-plate vx-grain">
          <div style={{ padding: "clamp(24px, 4vw, 48px)", display: "grid", gap: 32, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.2fr)" }} className="vx-brief-grid">
            <div>
              <p className="vx-eyebrow">{industry.example.label}</p>
              <h2 className="vx-display vx-h3" style={{ marginTop: 16 }}>
                What lands at 07:00.
              </h2>
              <ul style={{ marginTop: 28, display: "grid", gap: 12 }}>
                {industry.outcomes.map((o) => (
                  <li key={o} className="vx-small" style={{ color: "var(--vx-ondark-2)", display: "flex", gap: 12 }}>
                    <span style={{ color: "var(--vx-signal)" }}>—</span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <div className="vx-art-card" style={{ position: "relative", padding: 18, fontFamily: "var(--vx-mono)", fontSize: "0.76rem", color: "var(--vx-ondark-2)", alignSelf: "start" }}>
              {industry.example.lines.map((line, i) => (
                <p key={line} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--vx-ink-line-2)" : 0, color: i ? undefined : "var(--vx-ondark)" }}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {reviews.length ? (
        <section className="vx-wrap" aria-label="Reviews" style={{ paddingBottom: "clamp(56px, 8vw, 120px)" }}>
          <p className="vx-eyebrow" style={{ marginBottom: 32 }}>
            Reviews · {industry.name}
          </p>
          <div className="vx-reviews">
            {reviews.map((r, i) => (
              <ReviewCard key={r.name} review={r} delay={i * 80} />
            ))}
          </div>
        </section>
      ) : null}
    </VxShell>
  );
}

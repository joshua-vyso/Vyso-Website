import type { Metadata } from "next";
import { JsonLd, PageHead, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import { BRAND, PROCESS } from "@/components/vx/content";
import { Reveal, Words } from "@/components/vx/primitives";
import { SITE } from "@/lib/marketing/site";

const DESCRIPTION =
  "Vyso is a Johannesburg AI automation agency founded by Josh Moreira. We design, build and operate bespoke automation systems for operations-heavy businesses, and we run what we build.";

export const metadata: Metadata = {
  title: "About — we build systems, then we run them",
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
};

const ANSWER =
  "Vyso was founded in Johannesburg by Josh Moreira. It started inside one operations-heavy food business, reading its supplier invoices, watching its prices and reconciling its deliveries. The engine that survived contact with a real operation is what every Vyso system now runs on.";

const BELIEFS = [
  { t: "Start inside the problem", b: "Most AI pitches start with a technology and go looking for a problem. We started inside a warehouse." },
  { t: "One leak at a time", b: "Map one operation, find the bottleneck that actually costs money, build the system there. Then the next." },
  { t: "Say no early", b: "If a system wouldn't pay for itself, we say so before anything is built." },
  { t: "People decide", b: "Software proposes. Messages wait for approval, uncertain reads wait for review, findings arrive with evidence." },
];

export default function AboutPage() {
  return (
    <VxShell closing={{ line: "Talk to", em: "a person." }}>
      <JsonLd data={breadcrumbs([["Home", "/"], ["About", "/about"]])} />
      <JsonLd data={webPage({ path: "/about", name: "About Vyso", description: DESCRIPTION, type: "AboutPage" })} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          "@id": `${SITE.url}/#josh`,
          name: SITE.founder.name,
          jobTitle: SITE.founder.jobTitle,
          worksFor: { "@id": `${SITE.url}/#organization` },
          email: SITE.email,
          address: { "@type": "PostalAddress", addressLocality: "Johannesburg", addressCountry: "ZA" },
        }}
      />
      <PageHead
        eyebrow="About"
        title="We build systems. Then"
        em="we run them."
        answer={ANSWER}
        aside={
          <dl className="vx-mono" style={{ fontSize: "0.74rem", lineHeight: 1.9, color: "var(--vx-text-2)", display: "grid", gap: 2 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <dt style={{ color: "var(--vx-text-3)", minWidth: 80 }}>Founder</dt>
              <dd>{SITE.founder.name}</dd>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <dt style={{ color: "var(--vx-text-3)", minWidth: 80 }}>Based</dt>
              <dd>
                {BRAND.city}, {BRAND.country}
              </dd>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <dt style={{ color: "var(--vx-text-3)", minWidth: 80 }}>Model</dt>
              <dd>Design, build, operate</dd>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <dt style={{ color: "var(--vx-text-3)", minWidth: 80 }}>Contact</dt>
              <dd>
                <a href={`mailto:${BRAND.email}`} className="vx-link" style={{ textTransform: "none", letterSpacing: 0 }}>
                  {BRAND.email}
                </a>
              </dd>
            </div>
          </dl>
        }
      />

      <section className="vx-wrap" aria-label="What we believe" style={{ paddingBottom: "clamp(56px, 8vw, 120px)" }}>
        <div className="vx-spec">
          {BELIEFS.map((b) => (
            <Reveal key={b.t}>
              <h2>{b.t}</h2>
              <p>{b.b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="vx-on-ink vx-section-tight" aria-labelledby="engagement-h">
        <div className="vx-wrap">
          <div className="vx-section-head">
            <div>
              <Reveal>
                <p className="vx-eyebrow">An engagement</p>
              </Reveal>
              <Words as="h2" className="vx-display vx-h2" text="Five steps." em="No decks." />
              <span id="engagement-h" className="sr-only">
                How an engagement runs
              </span>
            </div>
          </div>
          <ol className="vx-systems" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
            {PROCESS.map((s, i) => (
              <Reveal as="li" key={s.num} delay={i * 70} className="vx-card vx-card-ink" >
                <p className="vx-display" style={{ fontSize: "2.6rem", color: "var(--vx-signal)" }}>
                  {s.num}
                </p>
                <h3 className="vx-h4" style={{ marginTop: 18 }}>
                  {s.title}
                </h3>
                <p className="vx-small" style={{ marginTop: 10, color: "var(--vx-ondark-2)" }}>
                  {s.body}
                </p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
    </VxShell>
  );
}

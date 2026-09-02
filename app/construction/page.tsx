import type { Metadata } from "next";
import { JsonLd, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import { AuditForm } from "@/components/vx/AuditForm";
import { Reveal, Words } from "@/components/vx/primitives";
import { SITE } from "@/lib/marketing/site";

/* ── Vyso Construction waitlist ──────────────────────────────────────────────
   An experimental commercial-control product for South African specialist
   subcontractors, published early so the page can start indexing. Honesty
   rules from the scope brief: no prices, no recovery or performance claims,
   interface values labelled illustrative, "experiment" said plainly. */

const TITLE = "Vyso Construction — stop doing work you never get paid for";
const DESCRIPTION =
  "Vyso Construction is an AI commercial-control layer for South African specialist subcontractors. It follows the trail from site instruction to variation, certification and payment, and surfaces where earned revenue is at risk. Electrical contractors in Gauteng first. Waitlist open.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Vyso` },
  description: DESCRIPTION,
  alternates: { canonical: "/construction" },
  keywords: [
    "construction variation management software South Africa",
    "variation tracking for subcontractors",
    "payment certificate reconciliation",
    "commercial control software for electrical contractors",
    "contractual notice tracking",
    "revenue protection for contractors",
  ],
};

const ANSWER =
  "Vyso Construction is an experimental AI commercial-control product for South African specialist subcontractors. It connects the evidence, deadlines, status and values around every variation, from the first instruction to the final payment, and flags where money may be at risk before a notice, approval, certificate or payment falls through the cracks.";

const TRAIL = [
  "An instruction or scope change occurred",
  "It created a commercial entitlement",
  "The required notice was issued on time",
  "The work and its evidence were captured",
  "A variation was priced and submitted",
  "The variation was approved",
  "Performed work appeared in the payment application",
  "The certificate reflected the correct value",
  "Certified value was actually paid",
];

const FINDINGS = [
  { t: "A possible unclaimed variation", b: "A revised drawing or instruction with no variation against it." },
  { t: "A notice about to expire", b: "The contractual clock is running and nobody has started the letter." },
  { t: "A variation waiting too long", b: "Submitted, unresolved, no owner, no next action." },
  { t: "Approved work missing from a certificate", b: "Approved value that never made it into the certified value." },
  { t: "Certified but overdue", b: "Money certified weeks ago, still not in the bank." },
  { t: "Work started without approval", b: "Site moved. The paperwork didn't." },
];

const FAQ = [
  {
    q: "What is Vyso Construction?",
    a: "An experimental AI commercial-control layer for specialist subcontractors. It reads the documents a contractor already produces (BOQs, site instructions, variation registers, drawings, emails, payment applications and certificates), connects related events, and proactively surfaces evidence-backed findings about where earned revenue is at risk.",
  },
  {
    q: "Who is it for?",
    a: "South African specialist subcontractors with several concurrent projects and real variation volumes: electrical first, then HVAC, plumbing, fire protection, civils, steel, ceilings and partitions. Johannesburg, Pretoria and wider Gauteng are the first priority.",
  },
  {
    q: "Is it a full construction software suite?",
    a: "No. It deliberately starts with one narrow trail: instruction to variation to certification to payment. No scheduling, BIM, drawing authoring, payroll, procurement, CRM, accounting or generic project management.",
  },
  {
    q: "What happens when I join the waitlist?",
    a: "Josh reads every submission and reaches out personally. The first conversation is one request: walk us through your most recent real variation, from the first instruction to the final payment. That conversation decides whether the product should exist.",
  },
];

export default function ConstructionPage() {
  return (
    <VxShell closing={{ line: "Protect", em: "earned revenue.", hideCta: true }}>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Vyso Construction", "/construction"]])} />
      <JsonLd data={webPage({ path: "/construction", name: TITLE, description: DESCRIPTION })} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "@id": `${SITE.url}/construction#product`,
          name: "Vyso Construction",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: ANSWER,
          provider: { "@id": `${SITE.url}/#organization` },
          audience: { "@type": "BusinessAudience", name: "Specialist construction subcontractors, South Africa" },
          areaServed: "ZA",
          /* Pre-release: a waitlist, not an offer. No price is published. */
          potentialAction: { "@type": "RegisterAction", target: `${SITE.url}/construction#waitlist`, name: "Join the waitlist" },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "@id": `${SITE.url}/construction#faq`,
          mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
        }}
      />

      {/* Hero plate */}
      <section className="vx-hero" aria-label="Vyso Construction">
        <div className="vx-plate vx-grain" style={{ minHeight: "min(92svh, 900px)", display: "grid", alignContent: "end", padding: "calc(var(--vx-gutter) + 80px) var(--vx-gutter) var(--vx-gutter)" }}>
          <p className="vx-eyebrow">Vyso Construction · Experiment · Waitlist open</p>
          <Words as="h1" className="vx-display vx-h1" text="Stop doing work you never get" em="paid for." immediate delay={150} />
          <div className="vx-hero-foot" style={{ marginTop: 40 }}>
            <p className="vx-answer" style={{ maxWidth: "62ch" }}>
              {ANSWER}
            </p>
            <a href="#waitlist" className="vx-btn vx-btn-signal" data-cursor="link">
              <span>Join the waitlist</span>
              <span className="vx-btn-dot" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M2 8h11M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* The trail */}
      <section className="vx-wrap vx-section" aria-labelledby="trail-h">
        <div className="vx-section-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">The problem</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="Nine links. One missed," em="and it's gone." />
            <span id="trail-h" className="sr-only">
              The commercial trail
            </span>
          </div>
          <Reveal delay={100}>
            <p className="vx-lead">
              Scope changes arrive as instructions, drawings, emails, WhatsApps and conversations. The money they create is recorded somewhere else. Somebody has to prove all nine of these, every time.
            </p>
          </Reveal>
        </div>
        <Reveal>
          <ol className="vx-links">
            {TRAIL.map((step) => (
              <li key={step}>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>

      {/* The pipeline artifact */}
      <section className="vx-wrap" aria-labelledby="pipeline-h" style={{ paddingBottom: "clamp(56px, 8vw, 120px)" }}>
        <Reveal className="vx-plate vx-grain">
          <div style={{ padding: "clamp(24px, 4vw, 48px)" }}>
            <div className="vx-section-head" style={{ marginBottom: 32 }}>
              <div>
                <p className="vx-eyebrow">The product · illustrative interface values</p>
                <h2 id="pipeline-h" className="vx-display vx-h3" style={{ marginTop: 16 }}>
                  Where the money is sitting, across every project.
                </h2>
              </div>
              <p className="vx-small" style={{ color: "var(--vx-ondark-2)" }}>
                A ranked watchlist, not a chatbot. Each finding carries its evidence and a next action. Values shown are illustrative, never a claim.
              </p>
            </div>
            <div className="vx-trail">
              {[
                { k: "Performed, not submitted", v: "R 412 000", s: "3 items · oldest 41 days", p: 0.55, risk: true },
                { k: "Awaiting approval", v: "R 1.28 m", s: "9 variations · 2 past 30 days", p: 0.8, risk: false },
                { k: "Approved, not certified", v: "R 236 000", s: "2 discrepancies found", p: 0.3, risk: true },
                { k: "Certified, overdue", v: "R 574 000", s: "cert 14 · 22 days late", p: 0.65, risk: true },
              ].map((stage) => (
                <div key={stage.k} className="vx-trail-stage" data-risk={stage.risk ? "true" : "false"}>
                  <span className="k">{stage.k}</span>
                  <div>
                    <div className="v">{stage.v}</div>
                    <div className="s">{stage.s}</div>
                    <div className="vx-trail-bar">
                      <i style={{ "--p": stage.p } as React.CSSProperties} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Findings */}
      <section className="vx-wrap" aria-labelledby="findings-h" style={{ paddingBottom: "clamp(56px, 8vw, 120px)" }}>
        <div className="vx-section-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">What it surfaces</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="Findings," em="with evidence." />
            <span id="findings-h" className="sr-only">
              Findings
            </span>
          </div>
        </div>
        <div className="vx-spec" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {FINDINGS.map((f) => (
            <Reveal key={f.t}>
              <h3>{f.t}</h3>
              <p>{f.b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Who + boundaries */}
      <section className="vx-on-ink vx-section-tight" aria-labelledby="who-h">
        <div className="vx-wrap">
          <div className="vx-section-head">
            <div>
              <Reveal>
                <p className="vx-eyebrow">Who it is for</p>
              </Reveal>
              <Words as="h2" className="vx-display vx-h2" text="Specialist subcontractors." em="Electrical first." />
              <span id="who-h" className="sr-only">
                Who it is for
              </span>
            </div>
            <Reveal delay={100}>
              <p className="vx-lead">
                Several projects at once, real variation volumes, a QS or commercial team, and a trail that still lives in Excel, email, WhatsApp, PDFs and memory.
              </p>
            </Reveal>
          </div>
          <div className="vx-spec">
            <div>
              <h3>Where</h3>
              <p>Johannesburg, Pretoria and wider Gauteng first. South Africa.</p>
            </div>
            <div>
              <h3>Trades</h3>
              <p>Electrical, then HVAC, plumbing, fire protection, civils, steel, ceilings and partitions.</p>
            </div>
            <div>
              <h3>Who answers</h3>
              <p>Owners, commercial managers, quantity surveyors, contracts managers, project managers and finance.</p>
            </div>
            <div>
              <h3>Not building</h3>
              <p>Scheduling, BIM, drawings, payroll, procurement, CRM, accounting, generic chat or a full construction ERP.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="vx-wrap vx-section" aria-labelledby="waitlist-h" style={{ scrollMarginTop: 80 }}>
        <div className="vx-join">
          <header>
            <p className="vx-eyebrow">Waitlist</p>
            <Words as="h2" className="vx-display vx-h2" text="Walk us through your last" em="variation." />
            <span id="waitlist-h" className="sr-only">
              Join the waitlist
            </span>
            <p className="vx-lead" style={{ marginTop: 24 }}>
              From the first instruction to the final payment. That conversation is the product right now, and it decides whether it should exist.
            </p>
            <div className="vx-faq" style={{ marginTop: 40 }}>
              {FAQ.map((item, i) => (
                <details key={item.q} name="vx-construction-faq">
                  <summary>
                    <span className="n">0{i + 1}</span>
                    <span>{item.q}</span>
                    <span className="x" aria-hidden="true" />
                  </summary>
                  <p className="a">{item.a}</p>
                </details>
              ))}
            </div>
          </header>
          <Reveal className="vx-card vx-join-card" delay={120}>
            <AuditForm variant="construction" />
          </Reveal>
        </div>
      </section>
    </VxShell>
  );
}

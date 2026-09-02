import type { Metadata } from "next";
import { JsonLd, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import { AuditForm } from "@/components/vx/AuditForm";
import { Reveal, Words } from "@/components/vx/primitives";

const DESCRIPTION =
  "Book a free operations audit with Vyso. We map one operation, find the highest value bottleneck, and tell you honestly whether a bespoke automation system would pay for itself. No payment, nothing to install.";

export const metadata: Metadata = {
  title: "Book a free audit",
  description: DESCRIPTION,
  alternates: { canonical: "/join" },
};

const STEPS = [
  { t: "You write", b: "A minute on the business and the work that eats its hours." },
  { t: "A person reads", b: "Every submission, personally. Expect a couple of sharp questions back." },
  { t: "We talk", b: "A short conversation about whether a system would genuinely pay for itself. If not, we say so." },
];

export default function JoinPage() {
  return (
    <VxShell closing={{ line: "Or just", em: "email.", hideCta: true }}>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Book a free audit", "/join"]])} />
      <JsonLd data={webPage({ path: "/join", name: "Book a free audit", description: DESCRIPTION, type: "ContactPage" })} />
      <div className="vx-wrap vx-page-head">
        <div className="vx-join">
          <header>
            <p className="vx-eyebrow">Free audit</p>
            <Words as="h1" className="vx-display vx-h1" text="Tell us what" em="slows you down." immediate delay={100} />
            <p className="vx-answer" style={{ marginTop: 28 }}>
              {DESCRIPTION}
            </p>
            <ol style={{ marginTop: 40, display: "grid", gap: 22, borderTop: "1px solid var(--vx-paper-line)", paddingTop: 28 }}>
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.t} delay={i * 80} className="vx-join-step">
                  <span className="vx-mono" style={{ fontSize: "0.7rem", color: "var(--vx-signal-small)", letterSpacing: "0.14em" }}>
                    0{i + 1}
                  </span>
                  <span>
                    <span className="vx-h4" style={{ display: "block" }}>
                      {s.t}
                    </span>
                    <span className="vx-small" style={{ display: "block", marginTop: 6 }}>
                      {s.b}
                    </span>
                  </span>
                </Reveal>
              ))}
            </ol>
          </header>
          <Reveal className="vx-card vx-join-card" delay={160}>
            <AuditForm />
          </Reveal>
        </div>
      </div>
    </VxShell>
  );
}

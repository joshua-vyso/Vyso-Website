import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
/* From `./stagger`, never from `./Reveal`: this is a server component, and every
   export of a `"use client"` module reaches one as an opaque client reference.
   See `components/vyso/stagger.ts`. */
import { stagger } from "@/components/vyso/stagger";

/* ── The differentiation ─────────────────────────────────────────────────────
   Plan §7.1.3. The sentence the whole company is built on, said once, in the
   two-tier construction: "Most automation stops when the task is complete."
   then, in the lighter ink, "Vyso looks at what happened next."

   Three numbered steps under it, and deliberately no illustration: the hero
   above it is the illustration, and a second demo forty pixels later would ask
   the reader to watch the same thing twice. This section is the caption on the
   hero, in words. */

const STEPS: readonly { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Automate",
    body: "Orders, invoices, spreadsheets, emails, stock sheets and repetitive admin happen automatically.",
  },
  {
    n: "02",
    title: "Understand",
    body: "Vyso connects what happened across your operation and understands the context around it.",
  },
  {
    n: "03",
    title: "Act",
    body: "Vyso surfaces shortages, anomalies, risks, forgotten tasks, margin issues and anything else that needs your attention.",
  },
];

export function HomeDifferentiation() {
  return (
    <Section
      id="difference"
      eyebrow="Automation is only the beginning"
      heading="Most automation stops when the task is complete."
      continuation="Vyso looks at what happened next."
      divider
    >
      <ol className="m-0 grid list-none grid-cols-1 gap-[32px] p-0 md:grid-cols-3 md:gap-[36px]">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} as="li" delay={stagger(i)}>
            <div className="border-t border-[color:var(--vy-line-2)] pt-[18px]">
              <span className="vy-label block text-[color:var(--vy-ink-4)]">{step.n}</span>
              <h3 className="vy-h3 mt-[14px] text-[color:var(--vy-ink)]">{step.title}</h3>
              <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

export default HomeDifferentiation;

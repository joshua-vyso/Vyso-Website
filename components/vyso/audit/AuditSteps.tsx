import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";
import { AUDIT_STEPS } from "@/components/vyso/audit/audit-content";

/* ── The five steps ──────────────────────────────────────────────────────────
   Plan §7.3 and the brief's own five. An `<ol>`, because the order is the
   meaning, and the `#step-01…05` ids are what the `HowTo` schema's steps point
   at (`audit-jsonld.ts`), so each one exists exactly once on the page.

   The step numbers are decorative duplicates of the list's own ordinals, so the
   markers carry `aria-hidden` and the list announces "1 of 5" itself rather
   than "01, one, Tell us how your operation works".

   Text comes from `audit-content.ts` so the schema and the page cannot drift. */

export function AuditSteps() {
  return (
    <Section
      id="steps"
      eyebrow="What happens"
      heading="Five steps,"
      continuation="and the first one is a conversation."
      lead="No system, no tooling, no access to anything. We are trying to understand how the work moves before we have an opinion about it."
      divider
    >
      <ol className="m-0 flex list-none flex-col p-0">
        {AUDIT_STEPS.map((step, i) => (
          <Reveal key={step.n} as="li" delay={stagger(i)}>
            <div
              id={`step-${step.n}`}
              className="grid scroll-mt-[100px] grid-cols-1 gap-[8px] border-t border-[color:var(--vy-line)] py-[22px] md:grid-cols-[64px_minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-baseline md:gap-[28px] md:py-[26px]"
            >
              <span aria-hidden="true" className="vy-label text-[color:var(--vy-ink-4)]">
                {step.n}
              </span>
              <h3 className="vy-h3 text-[color:var(--vy-ink)]">{step.label}</h3>
              <p className="vy-body text-[color:var(--vy-ink-3)] text-pretty">{step.text}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

export default AuditSteps;

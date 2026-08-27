import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── The process ─────────────────────────────────────────────────────────────
   Plan §7.1.7, the brief's five steps verbatim in content. An ordered list, and
   an `<ol>` for the same reason the timeline is one: the order is the meaning.
   Nothing here is illustrated, because five steps illustrated is five pictures
   of an arrow.

   The step numbers are decorative duplicates of the list's own ordinals, so the
   markers carry `aria-hidden` and the `<li>` is announced as "1 of 5" by the
   list itself rather than as "01, one, Audit". */

const STEPS: readonly { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Audit",
    body: "We learn how your business actually operates.",
  },
  {
    n: "02",
    title: "Diagnose",
    body: "We identify where time, money and information are leaking.",
  },
  {
    n: "03",
    title: "Prioritise",
    body: "You receive a clear report, ranked by potential return.",
  },
  {
    n: "04",
    title: "Build",
    body: "We implement the highest-value system first.",
  },
  {
    n: "05",
    title: "Improve",
    body: "Vyso monitors the operation and evolves the system as your business changes.",
  },
];

export function HomeProcess() {
  return (
    <Section
      id="process"
      eyebrow="How we start"
      heading="Start where the return is highest."
      lead="Every engagement begins the same way, and the first thing we build is the one with the clearest return. If a system won't create a meaningful return, we shouldn't build it."
      divider
    >
      <ol className="m-0 flex list-none flex-col p-0">
        {STEPS.map((step, i) => (
          <Reveal key={step.n} as="li" delay={stagger(i)}>
            <div className="grid grid-cols-1 gap-[6px] border-t border-[color:var(--vy-line)] py-[22px] md:grid-cols-[80px_220px_1fr] md:items-baseline md:gap-[24px] md:py-[26px]">
              <span aria-hidden="true" className="vy-label text-[color:var(--vy-ink-3)]">
                {step.n}
              </span>
              <h3 className="vy-h3 text-[color:var(--vy-ink)]">{step.title}</h3>
              <p className="vy-body text-[color:var(--vy-ink-3)] text-pretty">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>

      <div className="mt-[36px] border-t border-[color:var(--vy-line)] pt-[36px]">
        <Button
          href="/operations-audit"
          size="lg"
          event="book_audit_click"
          eventProps={{ page: "home-process" }}
        >
          Start with a free Operations Audit
        </Button>
      </div>
    </Section>
  );
}

export default HomeProcess;

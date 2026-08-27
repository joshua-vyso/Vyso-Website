import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── Audit, diagnose, build, monitor ─────────────────────────────────────────
   Plan §7.2 asks for the LOOP, which is the one thing a four-step list draws
   badly: a list ends, and this does not. Monitoring is what produces the next
   diagnosis, so the fourth item says so in words and the closing line under the
   list says it again plainly. That is cheaper and more legible than a circular
   diagram, which at 375px becomes four boxes in a column with arrows that no
   longer point anywhere.

   The homepage's process section is the five-step sales-side version (audit,
   diagnose, prioritise, build, improve). This is the same engagement described
   as an operating relationship rather than as an onboarding, which is what a
   reader on this page is trying to picture. They agree in content and neither
   one invents a promise about how long anything takes. */

const LOOP: readonly { n: string; title: string; body: string }[] = [
  {
    n: "01",
    title: "Audit",
    body: "About an hour with whoever actually runs the day. We walk through how work moves through the business, where it stalls, what gets retyped, and what only happens because somebody remembers to do it. Nothing to prepare and nothing to send first.",
  },
  {
    n: "02",
    title: "Diagnose",
    body: "You get a written report: where time, money and information are leaking, what each one is plausibly worth, and the order we would fix them in. The report is yours whether or not you build anything with us.",
  },
  {
    n: "03",
    title: "Build",
    body: "We build the highest-return item first, scoped to that one problem. It runs against your real work in your real tools, and it is adjusted while your team uses it rather than after a launch date.",
  },
  {
    n: "04",
    title: "Monitor",
    body: "Once it is live, the system watches the operation it automated. That is what surfaces the next problem worth solving, which is where this list starts again rather than ends.",
  },
];

const CLOSING =
  "This is a loop, not a project plan. The fourth step is what produces the next first step, " +
  "and a business that changes shape in eighteen months gets a system that changed with it.";

export function HowLoop() {
  return (
    <Section
      id="the-loop"
      eyebrow="How an engagement runs"
      heading="Audit, diagnose, build,"
      continuation="then keep watching."
      lead="Every engagement starts the same way, and it starts free. We do not scope a build before we understand what the build is for."
      divider
    >
      <ol className="m-0 grid list-none grid-cols-1 gap-[0px] p-0 md:grid-cols-2 md:gap-x-[48px]">
        {LOOP.map((step, i) => (
          <Reveal key={step.n} as="li" delay={stagger(i)}>
            <div className="h-full border-t border-[color:var(--vy-line-2)] py-[22px] md:py-[26px]">
              <span aria-hidden="true" className="vy-label block text-[color:var(--vy-ink-3)]">
                {step.n}
              </span>
              <h3 className="vy-h3 mt-[12px] text-[color:var(--vy-ink)]">{step.title}</h3>
              <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
                {step.body}
              </p>
            </div>
          </Reveal>
        ))}
      </ol>

      <div className="mt-[32px] border-t border-[color:var(--vy-line)] pt-[28px]">
        <p className="vy-body-lg max-w-[640px] text-[color:var(--vy-ink-2)] text-pretty">
          {CLOSING}
        </p>
        <div className="mt-[24px]">
          <Button
            href="/operations-audit"
            event="book_audit_click"
            eventProps={{ page: "how-it-works-loop" }}
          >
            See what the audit covers
          </Button>
        </div>
      </div>
    </Section>
  );
}

export default HowLoop;

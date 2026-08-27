import { Section } from "@/components/vyso/Section";
import { HONESTY_LINE } from "@/components/vyso/audit/audit-content";

/* ── Diagnosis first ─────────────────────────────────────────────────────────
   Plan §7.3, and it carries the honesty line (plan §3.8) that appears ONCE on
   the whole site: "Sometimes the right answer is a better spreadsheet. If
   that's the case, we'll tell you."

   The line is set as a `<blockquote>` at display size rather than as a bullet,
   because it is the single most disarming sentence on the site and burying it
   in a list is throwing it away. Everything around it exists to make it
   credible: three short paragraphs saying what the audit does not commit you
   to, in the order the doubts arrive.

   No accent here, deliberately. This section's whole argument is that we are
   not selling in it. */

const POINTS: readonly { title: string; body: string }[] = [
  {
    title: "The audit is not a sales meeting",
    body: "We spend the hour understanding how your business runs, not describing what we build. The report is written afterwards, and it is written about your operation rather than about our capabilities.",
  },
  {
    title: "You are not committing to software",
    body: "Diagnosis comes first, and the findings are yours whether or not you ever build anything with us. Plenty of what an audit turns up is worth fixing without a system at all.",
  },
  {
    title: "We would rather say no",
    body: "If the return on a system would not comfortably exceed what it costs to build and run, we say so. Building it anyway is how a supplier ends up with a happy quarter and an unhappy client.",
  },
];

export function AuditHonesty() {
  return (
    <Section
      id="no-obligation"
      eyebrow="Diagnosis first"
      heading="You are not buying anything"
      continuation="by letting us look."
      divider
    >
      <div className="grid grid-cols-1 items-start gap-[40px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-[56px]">
        <ul className="m-0 flex list-none flex-col p-0">
          {POINTS.map((point) => (
            <li key={point.title} className="border-t border-[color:var(--vy-line-2)] py-[20px]">
              <h3 className="vy-h3 text-[color:var(--vy-ink)]">{point.title}</h3>
              <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
                {point.body}
              </p>
            </li>
          ))}
        </ul>

        <blockquote className="m-0 border-l-[3px] border-[color:var(--vy-line-2)] pl-[24px] lg:mt-[20px]">
          <p className="vy-h2 text-[color:var(--vy-ink)] text-pretty">{HONESTY_LINE}</p>
          <p className="vy-body mt-[18px] text-[color:var(--vy-ink-3)] text-pretty">
            Some of the best outcomes of an audit have been a sheet restructured properly, a
            process changed, or one recurring job moved to the person it should have been with all
            along. None of those are a project for us, and all of them are the correct answer when
            they are the correct answer.
          </p>
        </blockquote>
      </div>
    </Section>
  );
}

export default AuditHonesty;

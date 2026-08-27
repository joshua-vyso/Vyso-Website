import { Card } from "@/components/vyso/Card";
import { AuditForm } from "@/components/vyso/audit/AuditForm";
import { DIRECT_ANSWER } from "@/components/vyso/audit/audit-content";

/* ── /operations-audit, the hero ─────────────────────────────────────────────
   Plan §7.3. Every "book your audit" on the site lands here, so the decision
   and the form share the top row: a visitor who arrived already convinced
   should not have to scroll to act, and one who arrived curious reads the
   column on the left.

   The lead is the page's AEO direct answer (`audit-content.ts`), which is also
   the `Service` and `HowTo` description in the schema. One sentence, one place.

   ── Why the form is a `Card` and not the page's shadowed object ─────────────
   The system's single ambient shadow belongs to window chrome and a hero demo
   (plan §4). A form is not a demo. It is a flat card with the site's one
   hairline, and the thing that draws the eye to it is the ink-filled button,
   which is the only filled thing in the row.

   Hand-rolled section rather than `Section` for the same reason `HomeHero` is:
   the headline and the form sit BESIDE each other, and `Section` stacks its
   header above its children. It repeats `Section`'s rhythm constants and
   carries no divider. */

const EYEBROW = "Free operations audit";

const REASSURANCE: readonly string[] = [
  "About an hour, and it is free.",
  "Whoever runs the day should be in the room.",
  "Nothing to prepare and nothing to send first.",
  "You keep the report either way.",
];

export function AuditHero() {
  return (
    <section className="px-[var(--vy-gutter)] pt-[44px] pb-[64px] md:px-[40px] md:pt-[72px] md:pb-[96px]">
      <div className="mx-auto grid w-full max-w-[var(--vy-content)] grid-cols-1 items-start gap-[44px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-[64px]">
        <div>
          <p className="vy-label mb-[20px] text-[color:var(--vy-ink-3)]">{EYEBROW}</p>

          {/* The page's single h1, in the system's two-tier construction. */}
          <h1 className="vy-h1 text-[color:var(--vy-ink)]">
            Find out where your operation is leaking{" "}
            <span className="text-[color:var(--vy-ink-3)]">time and money.</span>
          </h1>

          <p className="vy-body-lg mt-[22px] max-w-[560px] text-[color:var(--vy-ink-3)]">
            {DIRECT_ANSWER}
          </p>

          <ul className="m-0 mt-[30px] flex list-none flex-col p-0">
            {REASSURANCE.map((line) => (
              <li
                key={line}
                className="vy-body border-t border-[color:var(--vy-line)] py-[13px] text-[color:var(--vy-ink-2)]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>

        <Card id="book" padding="lg" className="scroll-mt-[100px]">
          <h2 className="vy-h3 text-[color:var(--vy-ink)]">Book your audit</h2>
          <p className="vy-body mt-[8px] mb-[24px] text-[color:var(--vy-ink-3)] text-pretty">
            Five questions. We reply within one business day to confirm a time.
          </p>
          <AuditForm />
        </Card>
      </div>
    </section>
  );
}

export default AuditHero;

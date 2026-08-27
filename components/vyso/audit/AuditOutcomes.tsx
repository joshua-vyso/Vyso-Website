import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";
import { AUDIT_OUTCOMES } from "@/components/vyso/audit/audit-content";
import { FindingCard } from "@/components/vyso/demo/FindingCard";

/* ── What the audit is looking for ───────────────────────────────────────────
   Plan §7.3's outcomes list, and the one place on this page where a reader who
   has not seen the homepage gets a picture of what "a finding" actually is. One
   `FindingCard`, in the section's one accented state, standing beside the six
   outcomes as an example of the kind of thing the report contains.

   It is illustrative and the caption says so, in the same words the homepage
   uses. Every rand figure on this site is OPERATIONAL: what a supplier charged
   a distributor. Vyso's own fees appear nowhere.

   The link into `/#examples` is the cross-reference plan §7.3 asks for: four
   more of these, on the homepage, without this page having to grow a second
   demo section of its own. */

export function AuditOutcomes() {
  return (
    <Section
      id="outcomes"
      eyebrow="What comes out of it"
      heading="A list of specific problems,"
      continuation="ranked by what fixing them is worth."
      lead="Not a strategy document. The report names the work that repeats, the information that never arrives in time, and the money that leaves quietly, and it says which one we would start with."
      divider
    >
      <div className="grid grid-cols-1 items-start gap-[40px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-[56px]">
        <ul className="m-0 grid list-none grid-cols-1 gap-x-[36px] gap-y-[0px] p-0 sm:grid-cols-2">
          {AUDIT_OUTCOMES.map((outcome, i) => (
            <Reveal key={outcome.title} as="li" delay={stagger(i)}>
              <div className="h-full border-t border-[color:var(--vy-line-2)] py-[18px]">
                <h3 className="vy-body font-medium text-[color:var(--vy-ink)]">{outcome.title}</h3>
                <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)] text-pretty">
                  {outcome.body}
                </p>
              </div>
            </Reveal>
          ))}
        </ul>

        <div>
          <p className="vy-label mb-[16px] text-[color:var(--vy-ink-4)]">
            What a finding looks like
          </p>
          <FindingCard
            state="alert"
            observation="Twenty three supplier invoices arrived this week. Twenty two went through untouched. One did not: Supplier B charged above the last agreed price."
            impact="R4.20 per kg over"
            evidence="SUPPLIER B, INV-4471"
            meta="24 AUGUST"
            actions={["Query the supplier", "Draft the email"]}
          />
          <p className="vy-label mt-[12px] text-right text-[10.5px] text-[color:var(--vy-ink-4)]">
            Illustrative example
          </p>
          <div className="mt-[20px]">
            <Button href="/#examples" variant="quiet">
              See four more examples
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

export default AuditOutcomes;

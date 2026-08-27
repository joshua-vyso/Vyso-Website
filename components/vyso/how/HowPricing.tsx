import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Section } from "@/components/vyso/Section";

/* ── Pricing philosophy ──────────────────────────────────────────────────────
   Plan §7.2 and brief §40, and the hardest block on the site to write, because
   it has to be CONFIDENT WITHOUT BEING VAGUE while carrying no figure at all
   (plan §3.1: no price for Vyso's work, anywhere).

   Two rules the brief sets and this section obeys literally:

   1. "Before we quote anything, we understand the problem." It is the section's
      heading, not a line buried in a paragraph.
   2. Never a bare "contact us for a custom quote". A page that ends its pricing
      section with that sentence has said nothing. So the reader leaves here
      knowing four concrete things instead: what the price is scoped against,
      what the two components of it are, when they will see it, and that the
      thing that produces it is free.

   The salon and the distributor are the brief's own contrast, and they are the
   reason a tier table would be a lie rather than a simplification: they are not
   two sizes of the same job.

   No rand figure appears in this section, including as an illustration. */

const PRINCIPLES: readonly { title: string; body: string }[] = [
  {
    title: "Scoped against a problem, not a plan",
    body: "We quantify what the problem is costing you first, then recommend the smallest system that can produce the outcome. If the return is not obviously larger than the build, we say so and we do not build it.",
  },
  {
    title: "Two numbers, both fixed, both quoted upfront",
    body: "A fixed price to build the system and a monthly price to run and maintain it. You see both in writing before anything starts, and neither one changes because the month was busy.",
  },
  {
    title: "You see the price after the diagnosis",
    body: "The audit is free and produces the findings report. The quote comes with the report, priced per item on it, so you are choosing between known problems rather than between packages.",
  },
];

const CONTRAST_TITLE = "Why there is no price list";

const CONTRAST_BODY =
  "A salon asking us to automate enquiries and bookings and a distributor asking us to redesign " +
  "stock, procurement and wastage workflows are not two sizes of the same job. They share almost " +
  "nothing: not the systems, not the data, not the work, not the value of getting it right. A " +
  "tier table would have to be wrong for one of them to be right for the other, so we quote the " +
  "job in front of us.";

export function HowPricing() {
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      heading="Before we quote anything,"
      continuation="we understand the problem."
      lead="Every Vyso system is scoped around the operational problem it needs to solve. We start with the problem, quantify the opportunity, then recommend the smallest system capable of producing the outcome you want."
      divider
    >
      <div className="grid grid-cols-1 gap-[36px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-[56px]">
        <ul className="m-0 flex list-none flex-col p-0">
          {PRINCIPLES.map((item) => (
            <li key={item.title} className="border-t border-[color:var(--vy-line-2)] py-[20px]">
              <h3 className="vy-h3 text-[color:var(--vy-ink)]">{item.title}</h3>
              <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
                {item.body}
              </p>
            </li>
          ))}
        </ul>

        <Card padding="lg" className="h-fit">
          <h3 className="vy-h3 text-[color:var(--vy-ink)]">{CONTRAST_TITLE}</h3>
          <p className="vy-body mt-[12px] text-[color:var(--vy-ink-3)] text-pretty">
            {CONTRAST_BODY}
          </p>
          <div className="mt-[22px] border-t border-[color:var(--vy-line)] pt-[20px]">
            <p className="vy-small text-[color:var(--vy-ink-3)]">
              The audit is free, and it is what turns your operation into the list of problems we
              would price. There is nothing to buy to get it.
            </p>
            <div className="mt-[16px]">
              <Button
                href="/operations-audit"
                event="book_audit_click"
                eventProps={{ page: "how-it-works-pricing" }}
              >
                Start with a free operations audit
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </Section>
  );
}

export default HowPricing;

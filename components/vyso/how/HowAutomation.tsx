import { Card } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── How the automation works ────────────────────────────────────────────────
   Plan §7.2, the first of the two halves: the part that does the work. Four
   stages, as an `<ol>`, because the order is the meaning and because a reader
   who has been sold automation before wants to know exactly where a human is
   still standing.

   The approval card under the list is the answer to the question this section
   always raises and the brief names twice: does it act on its own? It does not,
   unless you have told it to, and saying so in a bordered aside rather than in
   a fifth list item is what stops it reading as fine print. */

const STAGES: readonly { n: string; title: string; body: string; meta: string }[] = [
  {
    n: "01",
    title: "It reads what already arrives",
    body: "Orders on WhatsApp, invoices attached to email, price lists in a spreadsheet, delivery notes photographed on a phone. The information is already there. Nobody has to start entering it somewhere new for the system to work.",
    meta: "WHATSAPP · EMAIL · SPREADSHEETS · PDFS",
  },
  {
    n: "02",
    title: "It does the repetitive part",
    body: "Capturing the order, creating the invoice on the right customer's pricing, checking stock, updating the sheet, filing the document, sending the confirmation. The work that has to happen and that nobody should be doing by hand twice a day.",
    meta: "THE WORK THAT REPEATS",
  },
  {
    n: "03",
    title: "It writes to the systems you already run",
    body: "Your accounting package, your stock sheet, your order book, your inbox. Vyso is the layer between them, not a replacement for them, so your team keeps opening the same tools tomorrow.",
    meta: "YOUR TOOLS, KEPT",
  },
  {
    n: "04",
    title: "It keeps a record of what happened",
    body: "Every captured order, every processed invoice, every price on every line. That record is what makes the second half of this page possible: you cannot notice a change if nothing remembered the first version.",
    meta: "THE PART MOST AUTOMATION SKIPS",
  },
];

const APPROVAL_TITLE = "A person still approves anything that matters";

const APPROVAL_BODY =
  "Vyso drafts the invoice, the purchase order and the query to the supplier. Whether it sends " +
  "them is your decision, and which actions need approval is set when the system is built. " +
  "Nothing is quietly handed authority over your money because it happened to be running.";

export function HowAutomation() {
  return (
    <Section
      id="automation"
      eyebrow="The first half"
      heading="How the automation works."
      lead="Nothing here is exotic. Work arrives, the system does the repetitive part of it, and what it did lands in the tools your team already uses."
      divider
    >
      <ol className="m-0 flex list-none flex-col p-0">
        {STAGES.map((stage, i) => (
          <Reveal key={stage.n} as="li" delay={stagger(i)}>
            <div className="grid grid-cols-1 gap-[6px] border-t border-[color:var(--vy-line)] py-[22px] md:grid-cols-[64px_1fr_200px] md:items-baseline md:gap-[28px] md:py-[26px]">
              <span aria-hidden="true" className="vy-label text-[color:var(--vy-ink-4)]">
                {stage.n}
              </span>
              <div>
                <h3 className="vy-h3 text-[color:var(--vy-ink)]">{stage.title}</h3>
                <p className="vy-body mt-[8px] max-w-[640px] text-[color:var(--vy-ink-3)] text-pretty">
                  {stage.body}
                </p>
              </div>
              <span className="vy-label mt-[8px] text-[10.5px] text-[color:var(--vy-ink-4)] md:mt-0">
                {stage.meta}
              </span>
            </div>
          </Reveal>
        ))}
      </ol>

      <Card className="mt-[36px] max-w-[720px]" padding="lg">
        <h3 className="vy-h3 text-[color:var(--vy-ink)]">{APPROVAL_TITLE}</h3>
        <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
          {APPROVAL_BODY}
        </p>
      </Card>
    </Section>
  );
}

export default HowAutomation;

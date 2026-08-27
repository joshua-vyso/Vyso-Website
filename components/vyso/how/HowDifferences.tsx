import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── The three comparisons ───────────────────────────────────────────────────
   Plan §7.2: this page absorbs the intent of the retired compare pages, which
   is why the three questions are asked in the reader's words and answered in
   the first two sentences (plan §8, AEO). Everything after those two sentences
   is for a person who is still reading; an answer engine that lifts only the
   opening has still lifted something true and complete.

   The rule that shapes the tone: every comparison here has to be fair enough
   that somebody who chooses the other thing was right to. An ERP is the correct
   answer for plenty of businesses, Zapier is genuinely good at what it does,
   and an excellent operations person is worth more than any system we would
   build. Saying so is what makes the paragraph after it believable. */

type Comparison = { id: string; question: string; answer: string; detail: string };

const COMPARISONS: readonly Comparison[] = [
  {
    id: "vs-erp",
    question: "How is Vyso different from an ERP?",
    answer:
      "An ERP is a system your business moves into. Vyso is a system built around the one you already run.",
    detail:
      "An ERP replaces your order book, your stock control and often your accounting with one large product, and your team learns to work the way it works. That can be the right decision, and it is a long, expensive one that touches everybody. Vyso goes the other way: we leave your tools where they are, automate the specific work that is costing you, and connect what those tools already know so the system can tell you when something is wrong. You can start with one workflow in weeks instead of moving the business into a new one.",
  },
  {
    id: "vs-zapier",
    question: "How is Vyso different from Zapier or Make?",
    answer:
      "Those tools connect apps so a task completes. Vyso reads what the completed task produced and decides whether it is worth your attention.",
    detail:
      "A workflow tool is excellent at moving a record from one place to another when something triggers it, and if that is the whole problem, it is the cheaper answer and you should use it. What it does not do is hold the context: it has no view of what this customer normally pays, what that supplier charged last month, or whether the stock you just committed exists. Vyso is built for the second half. It also means somebody else owns the building and the maintenance of it, rather than one person in your office who set it up and has since left.",
  },
  {
    id: "vs-admin-hire",
    question: "How is Vyso different from hiring another admin person?",
    answer:
      "A new person gives you more hours of the same work. Vyso removes the work, and then watches what is left.",
    detail:
      "Hiring is the right call when the problem is judgement, relationships or physical presence, and no system replaces a good operations person. But a large part of what a new admin hire does is retyping: the order into the invoice, the invoice into the sheet, the sheet into the report. That part does not need a person, it needs to stop happening. A person also cannot check every invoice against every agreed price every morning without it becoming their entire job, and that is precisely the thing this does before anyone arrives.",
  },
];

export function HowDifferences() {
  return (
    <Section
      id="comparisons"
      eyebrow="Compared with the alternatives"
      heading="The three things people think we are."
      lead="Direct answers, in case that is all you came for."
      divider
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {COMPARISONS.map((item, i) => (
          <Reveal key={item.id} as="li" delay={stagger(i)}>
            <div
              id={item.id}
              className="grid scroll-mt-[100px] grid-cols-1 gap-[10px] border-t border-[color:var(--vy-line)] py-[26px] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-[48px] md:py-[32px]"
            >
              <h3 className="vy-h3 text-[color:var(--vy-ink)]">{item.question}</h3>
              <div>
                <p className="vy-body-lg text-[color:var(--vy-ink)] text-pretty">{item.answer}</p>
                <p className="vy-body mt-[12px] text-[color:var(--vy-ink-3)] text-pretty">
                  {item.detail}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </ul>

      <div className="mt-[32px] border-t border-[color:var(--vy-line)] pt-[28px]">
        <Button href="/faq" variant="quiet">
          More questions, answered plainly
        </Button>
      </div>
    </Section>
  );
}

export default HowDifferences;

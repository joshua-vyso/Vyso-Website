import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";

/* ── The case preview ────────────────────────────────────────────────────────
   Plan §7.1.9. One real client, named, with what was built stated plainly and
   the results left as placeholders.

   ── The placeholders are the point ──────────────────────────────────────────
   `[TNS_NUMBER]` stays on the page exactly as written until Josh supplies the
   figures (plan §3.4 and §14.5). An invented number is the one thing on this
   site worse than a gap, and a gap that is visibly a gap cannot be shipped by
   accident. The mono line under the results says why they are blank, so a
   reviewer reading the page knows this is a pending fact rather than a bug.

   "Our first client" is the honest framing and it is also the interesting one.
   "Founding client" is banned copy (plan §2 / acceptance criterion 2) and said
   less. */

const ROWS: readonly { label: string; body: string }[] = [
  {
    label: "Industry",
    body: "Fresh produce wholesale, Johannesburg.",
  },
  {
    label: "The problem",
    body: "Orders arrived on WhatsApp, supplier prices moved every week, stock lived in a spreadsheet, and the margin on an order was only visible long after the delivery had gone out.",
  },
  {
    label: "What we built",
    body: "Order capture, invoicing, procurement and stock visibility, supplier price monitoring and operational alerts, built around the systems the team already used.",
  },
];

const RESULTS: readonly string[] = [
  "[TNS_NUMBER] supplier invoices processed a month.",
  "[TNS_NUMBER] hours a week returned to the owner.",
];

export function HomeCase() {
  return (
    <Section
      id="case"
      eyebrow="Proof"
      heading="Built in the real world."
      lead="Turn ’n Slice is a fresh produce wholesaler in Johannesburg, and our first client. Everything below is what was actually built."
      divider
    >
      <Reveal>
        <Card as="article" padding="lg">
          <h3 className="vy-h3 text-[color:var(--vy-ink)]">Turn ’n Slice</h3>

          <dl className="m-0 mt-[24px] flex flex-col">
            {ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 gap-[6px] border-t border-[color:var(--vy-line)] py-[18px] md:grid-cols-[180px_1fr] md:gap-[24px]"
              >
                <dt className="vy-label text-[color:var(--vy-ink-4)]">{row.label}</dt>
                <dd className="vy-body m-0 text-[color:var(--vy-ink-2)] text-pretty">{row.body}</dd>
              </div>
            ))}

            <div className="grid grid-cols-1 gap-[6px] border-t border-[color:var(--vy-line)] py-[18px] md:grid-cols-[180px_1fr] md:gap-[24px]">
              <dt className="vy-label text-[color:var(--vy-ink-4)]">Results</dt>
              <dd className="m-0">
                <ul className="m-0 flex list-none flex-col gap-[6px] p-0">
                  {RESULTS.map((result) => (
                    <li key={result} className="vy-body text-[color:var(--vy-ink-2)]">
                      {result}
                    </li>
                  ))}
                </ul>
                <p className="vy-label mt-[12px] text-[10px] text-[color:var(--vy-ink-4)]">
                  Figures being confirmed with the client before publication
                </p>
              </dd>
            </div>
          </dl>

          <div className="mt-[8px] border-t border-[color:var(--vy-line)] pt-[20px]">
            <Button href="/case-studies/turn-n-slice" variant="quiet">
              Read the case study
            </Button>
          </div>
        </Card>
      </Reveal>
    </Section>
  );
}

export default HomeCase;

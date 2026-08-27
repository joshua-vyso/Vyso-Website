import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";

/* ── Bespoke ─────────────────────────────────────────────────────────────────
   Plan §7.1.6. The diagram is the section: inputs on the left, the operational
   layer in the middle, outcomes on the right.

   ── Why it is HTML and not a picture ────────────────────────────────────────
   Plan §7.1 asks for an accessible HTML or SVG diagram with real text, and
   between the two, HTML wins outright here. The thing being drawn is three
   LISTS and two arrows: as HTML it is three `<ul>`s a screen reader can walk,
   a search engine can read and a phone can reflow into one column. As SVG it
   would be the same words in `<text>` nodes that reflow into nothing. There is
   no geometry in this drawing that HTML cannot express, so there is nothing to
   buy with the trade.

   The two arrows are the only drawn marks, they carry `aria-hidden`, and they
   change direction with the layout: right between three columns on a desktop,
   down between three stacked blocks on a phone. The `<figcaption>` says in one
   sentence what the picture says in three columns, which is what a caption is
   for and what a reader who never sees the arrows gets instead of them. */

const INPUTS: readonly string[] = [
  "WhatsApp messages",
  "Excel and Google Sheets",
  "Email and attachments",
  "Your accounting system",
  "Stock records",
  "Customer records",
];

const OUTPUTS: readonly string[] = [
  "Alerts",
  "Invoices",
  "Dashboards",
  "Reports",
  "Recommendations",
  "Automated actions",
  "Reminders",
];

const LAYER: readonly string[] = [
  "It captures the repetitive work.",
  "It connects what happened across the operation.",
  "It watches what happens next.",
];

const LEAD =
  "We don't sell a massive one-size-fits-all software platform. We learn how your operation " +
  "works, identify the highest-return opportunities, and build around the systems your team " +
  "already uses.";

const CAPTION =
  "The work your business already does goes in. Vyso captures it, connects it and watches it. " +
  "What comes out is action: alerts, documents, reports and recommendations.";

/* Right between columns, down between stacked blocks. One glyph, two
   orientations, no second element to keep in sync. */
function Flow() {
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center py-[4px] text-[18px] leading-none text-[color:var(--vy-ink-4)] md:self-center md:py-0"
    >
      <span className="md:hidden">&darr;</span>
      <span className="hidden md:inline">&rarr;</span>
    </span>
  );
}

function Column({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div>
      <p className="vy-label mb-[12px] text-[color:var(--vy-ink-3)]">{label}</p>
      <ul className="m-0 flex list-none flex-col gap-[8px] p-0">
        {items.map((item) => (
          <li
            key={item}
            className="vy-small rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[14px] py-[9px] text-[color:var(--vy-ink-2)]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeBespoke() {
  return (
    <Section
      id="bespoke"
      eyebrow="Built around you"
      heading="Your business isn't a template."
      continuation="Your systems shouldn't be either."
      lead={LEAD}
      divider
    >
      <Reveal>
        <figure className="m-0">
          {/* `items-start` so the two column labels sit on the same line: the
              lists are six items and seven, and centring the columns against
              each other would leave their headings visibly out of step. The
              hub and the two arrows re-centre themselves. */}
          <div className="grid grid-cols-1 items-center gap-[10px] md:grid-cols-[minmax(0,1fr)_40px_minmax(0,1.1fr)_40px_minmax(0,1fr)] md:items-start md:gap-0">
            <Column label="What comes in" items={INPUTS} />

            <Flow />

            <div className="rounded-[var(--vy-radius)] border border-[color:var(--vy-line-2)] bg-[color:var(--vy-surface-2)] px-[22px] py-[24px] md:mx-[10px] md:mt-[26px] md:self-center">
              <p className="vy-label mb-[10px] text-[color:var(--vy-ink-3)]">The Vyso layer</p>
              <p className="vy-h3 text-[color:var(--vy-ink)]">
                One operational system, built for your business.
              </p>
              <ul className="m-0 mt-[16px] flex list-none flex-col gap-[8px] p-0">
                {LAYER.map((line) => (
                  <li key={line} className="vy-small text-[color:var(--vy-ink-2)]">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <Flow />

            <Column label="What comes out" items={OUTPUTS} />
          </div>

          <figcaption className="vy-small mt-[24px] max-w-[720px] text-[color:var(--vy-ink-3)] text-pretty">
            {CAPTION}
          </figcaption>
        </figure>
      </Reveal>
    </Section>
  );
}

export default HomeBespoke;

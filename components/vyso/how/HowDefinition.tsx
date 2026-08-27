import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── What Vyso is, and what it is not ────────────────────────────────────────
   Plan §7.2 asks for an explicit NOT list, and it is the most useful block on
   the page: everyone who lands here is already holding a category to put us in,
   and three of those categories are wrong in ways that cost a conversation.

   ── The third "not", and the word it does not use ───────────────────────────
   The brief's third item is "not a fractional COO". Plan §2 retires that title
   from the public site entirely, and a NOT list is still a public reference: a
   page that says "we are not a fractional COO" has put the phrase on the site,
   and search engines index denials exactly as happily as claims. So the item
   says the same thing in the reader's own words instead. Nobody arrives
   thinking "is this a fractional executive?"; they arrive thinking "am I hiring
   a person or buying a system?", and that is the sentence that answers them.

   Two lists, side by side, both real `<ul>`s. The IS column carries the
   heading's weight; the NOT column is quieter ink, because a page that shouts
   its denials louder than its claims reads as defensive. */

const IS: readonly { title: string; body: string }[] = [
  {
    title: "An operations company that builds software",
    body: "We start with how your business actually runs, then build the system that fixes the expensive part of it. The software is the means, not the offer.",
  },
  {
    title: "Built around your operation, one problem at a time",
    body: "Every system is designed for the way your team already works, using the tools they already open in the morning.",
  },
  {
    title: "Automation that keeps watching",
    body: "The work happens by itself, and what happened is read for shortages, anomalies, margin problems and anything else worth knowing about today rather than at month end.",
  },
  {
    title: "South African, and built for how business runs here",
    body: "WhatsApp, Excel, Sage, Xero, rand pricing, VAT, EFT and POPIA are the ordinary conditions of the work, not an export market we adapted to.",
  },
];

const IS_NOT: readonly { title: string; body: string }[] = [
  {
    title: "Not a software platform you subscribe to",
    body: "There is no product to license, no per-seat plan and no set of features you have to bend your operation around. What we hand over is built for your business and nobody else's.",
  },
  {
    title: "Not an agency that sets up Zapier or Make",
    body: "Connecting two apps so a row copies into a spreadsheet is a task, and tasks are the easy half. Vyso reads what happened after the task and decides whether it is worth your attention.",
  },
  {
    title: "Not a person you hire by the month",
    body: "We do not sit on your org chart, run your team or attend your management meetings. What you get is a working system and the people who built it, not a seat in your business.",
  },
];

export function HowDefinition() {
  return (
    <Section
      id="what-vyso-is"
      eyebrow="The short version"
      heading="What Vyso is,"
      continuation="and what it is not."
      lead="Most of the confusion about what we do comes down to which of three familiar things a reader thinks we are. We are none of them, and the difference matters before anything else on this page makes sense."
      divider
    >
      <div className="grid grid-cols-1 gap-[44px] md:grid-cols-2 md:gap-[48px]">
        <div>
          <h3 className="vy-label mb-[20px] text-[color:var(--vy-ink-3)]">What Vyso is</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {IS.map((item, i) => (
              <Reveal key={item.title} as="li" delay={stagger(i)}>
                <div className="border-t border-[color:var(--vy-line-2)] py-[18px]">
                  <p className="vy-body font-medium text-[color:var(--vy-ink)]">{item.title}</p>
                  <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)] text-pretty">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="vy-label mb-[20px] text-[color:var(--vy-ink-3)]">What Vyso is not</h3>
          <ul className="m-0 flex list-none flex-col p-0">
            {IS_NOT.map((item, i) => (
              <Reveal key={item.title} as="li" delay={stagger(i)}>
                <div className="border-t border-[color:var(--vy-line)] py-[18px]">
                  <p className="vy-body font-medium text-[color:var(--vy-ink-2)]">{item.title}</p>
                  <p className="vy-body mt-[8px] text-[color:var(--vy-ink-3)] text-pretty">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

export default HowDefinition;

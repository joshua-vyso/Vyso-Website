import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";
import { ChromeFrame, WhatsAppBubble } from "@/components/vyso/demo/ChromeFrame";
import { FindingCard } from "@/components/vyso/demo/FindingCard";

/* ── The examples ────────────────────────────────────────────────────────────
   Plan §7.1.4, the brief's four scenarios: the shortage, the thin margin, the
   supplier who charged over the agreed price, and the meeting nobody had time
   to prepare for. Four cells, each one label, one claim and one vignette.

   ── Two accents in one section, on purpose ──────────────────────────────────
   The system's rule of thumb is roughly one accented element per section, and
   this section has two `state="alert"` cards. That rule exists so the accent
   stays a signal rather than a decoration, and this is the one section on the
   page whose SUBJECT is the signal: it is four examples of Vyso noticing
   something. Two of the four are money leaving the building (a shortage, an
   overcharge) and are painted; the margin is a pattern being watched and the
   meeting is a thing already prepared, and both of those are grey. A version
   where all four were accented would be a page with no signal in it, which is
   exactly what the rule is guarding against.

   ── Why the first cell is not a timeline ────────────────────────────────────
   The hero already runs the order story as a timeline. Repeating it here in
   the same grammar forty pixels down would ask the reader to watch the same
   thing twice. So this cell compresses it: the WhatsApp message that starts it
   (the single most recognisable object in a South African SME's day) and the
   finding it ends in, with the middle stated in one line.

   Figures are illustrative and the section says so. Every rand amount is
   OPERATIONAL: what a customer is invoiced, what a supplier charged. Vyso's own
   fees appear nowhere on this site. */

export function HomeExamples() {
  return (
    <Section
      id="examples"
      eyebrow="What Vyso catches"
      heading="Small problems become expensive"
      continuation="when nobody notices them."
      lead="Four things worth catching on a Tuesday, in a business that runs on WhatsApp, spreadsheets and a good memory. The figures below are illustrative."
      divider
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-[36px] p-0 md:grid-cols-2 md:gap-x-[32px] md:gap-y-[48px]">
        {/* ── 1. Orders ─────────────────────────────────────────────────── */}
        <Reveal as="li" delay={stagger(0)} className="flex flex-col">
          <span className="vy-label text-[color:var(--vy-ink-4)]">Orders</span>
          <h3 className="vy-h3 mt-[12px] mb-[18px] text-[color:var(--vy-ink)]">
            A shortage found on Tuesday, not on the loading bay.
          </h3>
          <ChromeFrame variant="whatsapp" title="Thyme and Basil" subtitle="online" flat>
            <WhatsAppBubble time="09:41">
              Can I get 40 boxes for tomorrow?
            </WhatsAppBubble>
          </ChromeFrame>
          <FindingCard
            className="mt-[12px]"
            state="alert"
            observation="The order was captured, the invoice created and stock checked inside a minute. You are nine boxes short for tomorrow."
            impact="9 boxes short"
            evidence="ORDER 4471"
            meta="DELIVERY TOMORROW 06:00"
            actions={["Purchase before 11:00 to fulfil the delivery"]}
          />
        </Reveal>

        {/* ── 2. Margin ─────────────────────────────────────────────────── */}
        <Reveal as="li" delay={stagger(1)} className="flex flex-col">
          <span className="vy-label text-[color:var(--vy-ink-4)]">Margin</span>
          <h3 className="vy-h3 mt-[12px] mb-[18px] text-[color:var(--vy-ink)]">
            An order that earns less than this customer usually does.
          </h3>
          <FindingCard
            source="VYSO IS WATCHING"
            state="watching"
            observation="This order is materially below the margin this customer normally runs at."
            impact="8.4% against a 17.8% average"
            evidence="R18,420 REVENUE · R16,870 COST"
            meta="GROSS MARGIN, PER ORDER"
            actions={["Open the breakdown"]}
          />
        </Reveal>

        {/* ── 3. Supplier invoices ──────────────────────────────────────── */}
        <Reveal as="li" delay={stagger(2)} className="flex flex-col">
          <span className="vy-label text-[color:var(--vy-ink-4)]">Supplier invoices</span>
          <h3 className="vy-h3 mt-[12px] mb-[18px] text-[color:var(--vy-ink)]">
            The one invoice out of twenty three worth reading.
          </h3>
          <FindingCard
            state="alert"
            observation="Twenty three supplier invoices arrived this week. Twenty two went through untouched. One did not: Supplier B charged above the last agreed price."
            impact="R4.20 per kg over"
            evidence="SUPPLIER B, INV-4471"
            meta="24 AUGUST"
            actions={["Query the supplier", "Draft the email"]}
          />
        </Reveal>

        {/* ── 4. Client relationships ───────────────────────────────────── */}
        <Reveal as="li" delay={stagger(3)} className="flex flex-col">
          <span className="vy-label text-[color:var(--vy-ink-4)]">Client relationships</span>
          <h3 className="vy-h3 mt-[12px] mb-[18px] text-[color:var(--vy-ink)]">
            A meeting you walk into already prepared.
          </h3>
          <FindingCard
            source="VYSO PREPARED THIS"
            state="resolved"
            observation="Tomorrow at 09:00 you are meeting Highveld Foods. No preparation notes existed, so your last five interactions have been summarised."
            impact="Five interactions summarised"
            evidence="MEETING TOMORROW 09:00"
            meta="HIGHVELD FOODS"
            actions={["Read the summary"]}
          />
        </Reveal>
      </ul>
    </Section>
  );
}

export default HomeExamples;

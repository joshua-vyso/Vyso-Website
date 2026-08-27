import { Section } from "@/components/vyso/Section";
import { ChromeFrame } from "@/components/vyso/demo/ChromeFrame";
import { EventTimeline, type TimelineScript } from "@/components/vyso/demo/EventTimeline";

/* ── How the proactive half works ────────────────────────────────────────────
   Plan §7.2: the `EventTimeline` again, running a SECOND scenario. The homepage
   spends its timeline on the order that turns into a shortage; running the same
   morning here would teach a reader who has just scrolled from the homepage
   nothing at all.

   So this one is the supplier-invoice scenario from the brief's examples list:
   twenty three invoices arrive overnight, twenty two reconcile and are never
   seen by a person, and one is R4.20 per kg over the agreed price. It is the
   better story for THIS page because the noticing is the whole event. There is
   no dramatic shortage at the end of it, just a document that would have been
   paid on Friday and a difference nobody had time to look for.

   ── Two accented rows, which is the cap ─────────────────────────────────────
   One `alert` (the invoice that does not reconcile) and one `recommendation`
   (the draft query waiting for approval). Everything before them is grey,
   including the twenty two that matched, because a script where every row is
   painted has no signal in it.

   Every timestamp is a STATIC string. Every rand figure is OPERATIONAL: what a
   supplier charged a distributor per kilogram. Vyso's own fees appear nowhere
   on this site. */

const INVOICE_SCRIPT: TimelineScript = [
  {
    time: "07:10",
    kind: "event",
    title: "Twenty three supplier invoices arrive overnight",
    body: "PDFs attached to email, from eleven suppliers, no two of them laid out the same way.",
    meta: "EMAIL, 23 ATTACHMENTS",
  },
  {
    time: "07:12",
    kind: "event",
    title: "Every invoice is read and matched",
    body: "Line items, quantities and prices are pulled off each document and matched against the order that asked for them and the price that was agreed.",
    meta: "23 DOCUMENTS, NOBODY TYPING",
  },
  {
    time: "07:14",
    kind: "check",
    title: "Twenty two reconcile and need nobody",
    body: "They agree with the order and the agreed price, so they are filed and posted. No person opens them and nothing about them is worth your morning.",
    meta: "MATCHED",
  },
  {
    time: "07:14",
    kind: "alert",
    title: "One invoice does not reconcile",
    body: "Supplier B charged R4.20 per kg above the price last agreed with them. Everything else on the delivery is correct, which is exactly why nobody would have caught it.",
    meta: "SUPPLIER B, INV-4471",
  },
  {
    time: "07:15",
    kind: "recommendation",
    title: "Query it before Friday's payment run",
    body: "The agreed price, the invoiced price and the delivery note are attached, and the query to Supplier B is drafted. Sending it is your call.",
    meta: "PAYMENT RUN FRIDAY",
  },
];

const LEAD =
  "Most automation stops when the task is complete. The invoice is captured, the row is " +
  "written, the job is done. Vyso reads what the task produced and asks whether anything " +
  "about it is worth your attention today.";

const AFTER =
  "Nothing in that sequence is a report you have to open, and none of it happened because " +
  "somebody remembered to check. Twenty two invoices were handled and never mentioned. One " +
  "was, because it was the only one worth mentioning.";

export function HowProactive() {
  return (
    <Section
      id="proactive"
      eyebrow="The second half"
      heading="Then it reads what happened,"
      continuation="and tells you what is worth knowing."
      lead={LEAD}
      divider
    >
      <div className="grid grid-cols-1 items-start gap-[36px] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-[56px]">
        <div>
          <ChromeFrame title="Supplier invoices" meta="Thu 28 Aug">
            <div className="px-[18px] py-[24px] md:px-[26px] md:py-[28px]">
              <EventTimeline
                script={INVOICE_SCRIPT}
                replay
                label="Example: supplier invoices arriving overnight on a Thursday"
              />
            </div>
          </ChromeFrame>
          <p className="vy-label mt-[12px] text-right text-[10.5px] text-[color:var(--vy-ink-3)]">
            Illustrative example
          </p>
        </div>

        <div className="lg:pt-[8px]">
          <p className="vy-body-lg text-[color:var(--vy-ink-2)] text-pretty">{AFTER}</p>
          <p className="vy-body mt-[18px] text-[color:var(--vy-ink-3)] text-pretty">
            The same reading runs across everything the automation touches: an order that earns
            less than that customer normally does, a debtor slipping past their usual pattern,
            stock that will not cover a standing weekly delivery, a meeting tomorrow that nobody
            has notes for. What gets surfaced is decided with you when the system is built, and it
            changes as the business does.
          </p>
        </div>
      </div>
    </Section>
  );
}

export default HowProactive;

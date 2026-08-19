import type { CSSProperties } from "react";

/* ── The other end of the message ────────────────────────────────────────────
   The phone shows what a tradesperson sends. This shows what it becomes: a job
   record and a draft invoice on the Vyso platform. Two cards, deliberately
   plain, in the same family as `components/finch/FindingCard.tsx`'s `ink`
   variant — hairline border, mono label, one accent.

   Why it matters that this exists at all: the claim on `/orbit` is that Orbit
   is a WhatsApp front door onto software that already runs South African
   businesses. A page that only ever shows a chat screen is a page about a
   chatbot. Showing the record the chat produces is what makes the claim
   visible rather than merely stated.

   The `DRAFT` chip on the invoice is not decoration. `ORBIT.draftsOnly` — Orbit
   prepares the document and a person sends it — and this is where the site
   shows that rather than only writing it.

   No directive: `OrbitSequence` (a client component) animates these in, and a
   server page renders them plain.                                             */

export type JobRecord = {
  reference: string;
  customer: string;
  site: string;
  lines: [string, string][];
  total: string;
  state: "Done" | "In progress";
};

export type InvoiceDraft = {
  number: string;
  to: string;
  amount: string;
  terms: string;
};

function Chip({ children, tone }: { children: string; tone: "blue" | "orange" }) {
  return (
    <span
      className={
        "shrink-0 rounded-full border px-[9px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] uppercase " +
        (tone === "blue"
          ? "border-ob-blue/45 text-ob-blue-soft"
          : "border-fn-orange/45 text-fn-orange-on-ink")
      }
    >
      {children}
    </span>
  );
}

export function JobCard({ job, style, className = "" }: { job: JobRecord; style?: CSSProperties; className?: string }) {
  return (
    <div
      style={style}
      className={
        "rounded-[10px] border border-ob-line bg-ob-surface px-[18px] py-[16px] shadow-[0_18px_44px_rgba(2,6,16,0.45)] " +
        className
      }
    >
      <div className="mb-[12px] flex items-center gap-[10px]">
        <span aria-hidden className="h-[6px] w-[6px] shrink-0 rounded-full bg-ob-blue" />
        <span className="font-fn-mono text-[10px] tracking-[0.12em] text-ob-mono uppercase">
          Job · {job.reference}
        </span>
        <span className="ml-auto">
          <Chip tone="blue">{job.state}</Chip>
        </span>
      </div>
      <p className="m-0 mb-[2px] text-[15px] font-medium text-ob-text">{job.site}</p>
      <p className="m-0 mb-[12px] text-[12.5px] text-ob-mono">{job.customer}</p>
      <div className="flex flex-col gap-[6px] border-t border-ob-line-2 pt-[11px]">
        {job.lines.map(([label, value]) => (
          <span key={label} className="flex items-baseline justify-between gap-[12px] text-[12.5px]">
            <span className="text-ob-text-2">{label}</span>
            <span className="font-fn-mono text-ob-text">{value}</span>
          </span>
        ))}
      </div>
      <div className="mt-[12px] flex items-baseline justify-between border-t border-ob-line-2 pt-[11px]">
        <span className="font-fn-mono text-[10px] tracking-[0.12em] text-ob-mono uppercase">Total</span>
        <span className="text-[19px] font-semibold tracking-[-0.01em] text-fn-orange-on-ink">{job.total}</span>
      </div>
    </div>
  );
}

export function InvoiceDraftCard({
  invoice,
  style,
  className = "",
}: {
  invoice: InvoiceDraft;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      style={style}
      className={
        "rounded-[10px] border border-ob-line bg-ob-bg-2 px-[18px] py-[16px] shadow-[0_18px_44px_rgba(2,6,16,0.45)] " +
        className
      }
    >
      <div className="mb-[12px] flex items-center gap-[10px]">
        <span className="font-fn-mono text-[10px] tracking-[0.12em] text-ob-mono uppercase">
          Invoice {invoice.number}
        </span>
        <span className="ml-auto">
          <Chip tone="orange">Draft</Chip>
        </span>
      </div>
      <div className="flex flex-col gap-[6px]">
        <span className="flex items-baseline justify-between gap-[12px] text-[12.5px]">
          <span className="text-ob-text-2">To</span>
          <span className="font-fn-mono text-ob-text">{invoice.to}</span>
        </span>
        <span className="flex items-baseline justify-between gap-[12px] text-[12.5px]">
          <span className="text-ob-text-2">Amount</span>
          <span className="font-fn-mono text-ob-text">{invoice.amount}</span>
        </span>
        <span className="flex items-baseline justify-between gap-[12px] text-[12.5px]">
          <span className="text-ob-text-2">Terms</span>
          <span className="font-fn-mono text-ob-text">{invoice.terms}</span>
        </span>
      </div>
      <p className="m-0 mt-[12px] border-t border-ob-line-2 pt-[11px] text-[11.5px] leading-[1.5] text-ob-mono">
        Orbit drafts. You send — nothing reaches a customer without you.
      </p>
    </div>
  );
}

/** The record the homepage sequence produces, matching `JOB_TO_INVOICE` in
    `lib/orbit/sequences.ts` message for message. Exported so the sequence and
    the static fallback cannot describe different jobs. */
export const HERO_JOB: JobRecord = {
  reference: "J-0042",
  customer: "M. Naidoo",
  site: "1st Avenue — tiling",
  lines: [
    ["Work", "Bathroom re-tile"],
    ["Recorded", "Today · 16:41"],
    ["Source", "WhatsApp"],
  ],
  total: "R3,800.00",
  state: "Done",
};

export const HERO_INVOICE: InvoiceDraft = {
  number: "#0042",
  to: "M. Naidoo",
  amount: "R3,800.00",
  terms: "14 days",
};

export default JobCard;

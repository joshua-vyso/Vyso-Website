import type { ReactNode } from "react";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import { SeamHairline } from "@/components/finch/ground/SeamHairline";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
import { STATEMENT_CLASS } from "@/components/finch/text/statement-class";
import { ORBIT } from "@/lib/orbit/site";
import type { CompareRow } from "@/lib/orbit/pricing";
import { TRADES } from "@/lib/orbit/trades";

/* ── The pieces every Orbit page is made of ──────────────────────────────────
   Small, boring and shared, so that ten trade pages, two comparison pages,
   three articles and five standing pages cannot each invent their own eyebrow
   size, breadcrumb separator or CTA wording.

   The one rule this file enforces by construction: **`WaitlistCta` is the only
   call to action on the subsite.** It hard-codes `ORBIT.waitlistCta` ("Join
   Waitlist") and `/orbit/waitlist`, takes no `label` prop, and is what every
   page ends on. There is no second button to accidentally word differently.

   `STATEMENT_CLASS` is imported from `text/statement-class` and not from
   `text/Statement` — the latter carries `"use client"`, and a server component
   importing a constant across that boundary receives an opaque client
   reference instead of a string. That trap has bitten this codebase twice; the
   file it now lives in explains it at length.                                  */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-[14px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase lg:text-[11px]">
      {children}
    </p>
  );
}

/** The one-line honesty note. Rendered above the fold on every page that could
    otherwise read as a product announcement. */
export function StatusNote({ className = "" }: { className?: string }) {
  return (
    <p
      className={
        "m-0 inline-flex items-center gap-[9px] rounded-full border border-ob-line bg-white/[0.03] px-[14px] py-[7px] text-[12.5px] text-ob-text-2 " +
        className
      }
    >
      <span aria-hidden className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" />
      {ORBIT.status}
    </p>
  );
}

export function Breadcrumb({ trail }: { trail: [string, string][] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-[18px]">
      <ol className="m-0 flex list-none flex-wrap items-center gap-[8px] p-0 font-fn-mono text-[10.5px] tracking-[0.1em] text-ob-mono uppercase">
        {trail.map(([label, href], i) => (
          <li key={href} className="flex items-center gap-[8px]">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {i === trail.length - 1 ? (
              <span aria-current="page" className="text-ob-text-2">{label}</span>
            ) : (
              <Link href={href} className="transition-colors duration-150 hover:text-fn-orange-on-ink">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A band-sized claim. `Statement` itself is a client component; this is the
    server-side spelling of the same typography, used where nothing needs to
    animate. */
export function Claim({
  children,
  as: Tag = "h2",
  /* The colour comes from the band, not from the caller — a `className` of
     `text-fn-blue-text` would be fighting `text-ob-text` for the same property,
     and two arbitrary Tailwind utilities for one property resolve by
     stylesheet order rather than by the order they are written on the element.
     `Band` solves the same problem the same way (`paddingClassName`). */
  tone = "ink",
  className = "",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "p";
  tone?: "ink" | "blue";
  className?: string;
}) {
  const colour = tone === "blue" ? "text-fn-blue-text" : "text-ob-text";
  return <Tag className={`m-0 ${STATEMENT_CLASS} ${colour} ${className}`}>{children}</Tag>;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={"max-w-[720px] " + className}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="m-0 mb-[14px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-ob-text lg:text-[38px]">
        {title}
      </h2>
      {lead ? <p className="m-0 text-[15px] leading-[1.65] text-ob-text-2 lg:text-[16.5px]">{lead}</p> : null}
    </div>
  );
}

/** The single CTA. See the header — no `label`, on purpose. */
export function WaitlistCta({
  note,
  className = "",
  secondary,
}: {
  note?: string;
  className?: string;
  /** An optional quiet second link — never a second call to action, always a
      route the reader might want *instead* of committing. */
  secondary?: { href: string; label: string };
}) {
  return (
    <div className={"flex flex-col gap-[14px] sm:flex-row sm:items-center sm:gap-[18px] " + className}>
      <MagneticButton href="/orbit/waitlist" tone="dark" className="w-full text-[16px] sm:w-auto sm:text-[15.5px]">
        {ORBIT.waitlistCta}
      </MagneticButton>
      {secondary ? (
        <Link
          href={secondary.href}
          className="text-[14.5px] font-medium text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
        >
          {secondary.label}
        </Link>
      ) : null}
      {note ? (
        <span className="font-fn-mono text-[10.5px] tracking-[0.06em] text-ob-mono uppercase">{note}</span>
      ) : null}
    </div>
  );
}

/** The closing band. Ink ground, an oscillating grid in orange (§3.1's
    `squares` mode is reserved for exactly this — the closing CTA), one claim,
    one button. Every Orbit page ends on it. */
export function WaitlistBand({
  claim = "Join the waitlist.",
  lead = "Orbit is being built now. The list is free, it commits you to nothing, and founding pricing is locked for the people on it.",
}: {
  claim?: string;
  lead?: string;
}) {
  return (
    <Band
      ground="ink"
      className="bg-ob-bg-2"
      device={<OscillatingGrid mode="squares" color="--fn-orange" colorFallback="#FF7727" opacity={0.22} pitch={26} />}
    >
      <div className="max-w-[720px]">
        <SeamHairline className="mb-[26px] w-[52px]" />
        <Claim>{claim}</Claim>
        <p className="m-0 mt-[20px] max-w-[560px] text-[15.5px] leading-[1.65] text-ob-text-2 lg:text-[17px]">{lead}</p>
        <WaitlistCta className="mt-[28px]" note={`${ORBIT.price.display} ${ORBIT.price.unit}`} />
      </div>
    </Band>
  );
}

/* ── Tables ─────────────────────────────────────────────────────────────────
   Generative engines quote tables more readily than prose, which is the whole
   reason the comparison content is shaped as one. Two constraints follow:
   real `<th scope>` markup (so the relationship survives being read out of
   context), and a horizontal scroll container rather than a squeeze — a
   three-column table at 390px either scrolls or becomes unreadable, and this
   one scrolls. */
export function CompareTable({ columns, rows }: { columns: [string, string, string]; rows: CompareRow[] }) {
  return (
    <div className="-mx-[20px] overflow-x-auto px-[20px] lg:mx-0 lg:px-0">
      <table className="w-full min-w-[680px] border-collapse text-left">
        <thead>
          <tr className="border-b border-ob-line">
            {columns.map((column, i) => (
              <th
                key={column || `col-${i}`}
                scope="col"
                className={
                  "pb-[12px] align-bottom font-fn-mono text-[10.5px] tracking-[0.12em] uppercase " +
                  (i === 2 ? "text-fn-orange-on-ink" : "text-ob-mono")
                }
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.question} className="border-b border-ob-line-2 align-top">
              <th scope="row" className="w-[26%] py-[16px] pr-[20px] text-[14px] font-medium text-ob-text">
                {row.question}
              </th>
              <td className="w-[37%] py-[16px] pr-[20px] text-[14px] leading-[1.55] text-ob-text-2">{row.today}</td>
              <td className="w-[37%] py-[16px] text-[14px] leading-[1.55] text-ob-text">{row.orbit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── The FAQ accordion ──────────────────────────────────────────────────────
   Native `<details>`, exactly as `/faq` and `/pricing` do it, so every answer
   is in the HTML whether or not JavaScript ran — which matters twice over
   here, because the answers are also the `FAQPage` JSON-LD and an answer an
   engine can read in the markup is worth more than one behind a click. */
export function FaqList({
  items,
  idPrefix = "",
}: {
  items: { id: string; question: string; answer: string }[];
  idPrefix?: string;
}) {
  return (
    <div className="border-t border-ob-line">
      {items.map((item) => (
        <details key={item.id} id={`${idPrefix}${item.id}`} className="group scroll-mt-[100px] border-b border-ob-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-[16px] py-[18px] text-[15.5px] font-medium text-ob-text transition-colors duration-150 hover:text-fn-orange-on-ink [&::-webkit-details-marker]:hidden">
            {item.question}
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="h-[11px] w-[11px] shrink-0 text-ob-mono transition-transform duration-150 ease-out group-open:rotate-90"
            >
              <path d="M4 2.5 L8 6 L4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <p className="m-0 max-w-[760px] pb-[20px] text-[14.5px] leading-[1.65] text-ob-text-2">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** The ten trades as a strip of links. On `/orbit` it is the internal-linking
    spine of the subsite; on a trade page it is how a reader gets to theirs. */
export function TradeStrip({ exclude }: { exclude?: string }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-[10px] p-0">
      {TRADES.filter((t) => t.slug !== exclude).map((trade) => (
        <li key={trade.slug}>
          <Link
            href={`/orbit/for/${trade.slug}`}
            className="inline-flex rounded-full border border-ob-line px-[14px] py-[8px] text-[13.5px] text-ob-text-2 transition-colors duration-150 hover:border-fn-orange-on-ink hover:text-ob-text"
          >
            {trade.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A numbered step. Used by "How it works" on `/orbit` and, at length, on
    `/orbit/how-it-works`. */
export function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[10px]">
      <span aria-hidden className="font-fn-mono text-[11px] tracking-[0.14em] text-fn-orange-on-ink">
        {String(index).padStart(2, "0")}
      </span>
      <h3 className="m-0 font-fn-serif text-[21px] font-medium leading-[1.25] tracking-[-0.015em] text-ob-text lg:text-[23px]">
        {title}
      </h3>
      <p className="m-0 text-[14.5px] leading-[1.65] text-ob-text-2">{children}</p>
    </div>
  );
}

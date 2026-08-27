import Link from "next/link";

import { TrackedLink } from "@/components/finch/TrackedLink";
import { SITE } from "@/lib/marketing/site";

import { Button } from "./Button";
import { Wordmark } from "./Wordmark";

/* ── The footer ──────────────────────────────────────────────────────────────
   Four columns, a CTA row and a brand line (plan §5). Density lands between
   Polar's four lean columns and Attio's enterprise grid, which is where a B2B
   SME business with real POPIA obligations belongs: comprehensive, and Privacy
   / Terms / POPIA surfaced rather than buried in a legal line.

   NO Orbit link, no Finch links, no module links. Orbit stays live at its own
   subsite and keeps its own nav; it is simply not part of this brand's story
   any more (plan §2). Industries is reachable from here and from internal
   links, which is the traffic it is worth — it is not in the nav.

   ── Four of these routes do not exist yet ───────────────────────────────────
   The Solutions column names the four slugs the plan settles on in §5, three of
   which Phase 2c creates (`whatsapp-order-automation`, `invoice-automation`,
   `inventory-automation`). They 404 until then. Listing them now is deliberate:
   the footer is part of the reviewable system, and a column of placeholder
   labels would hide the shape of the thing being reviewed. */

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Case studies", "/case-studies"],
    ],
  },
  {
    title: "Solutions",
    links: [
      ["WhatsApp order automation", "/solutions/whatsapp-order-automation"],
      ["Invoice automation", "/solutions/invoice-automation"],
      ["Inventory automation", "/solutions/inventory-automation"],
      ["Procurement automation", "/solutions/procurement-automation"],
    ],
  },
  {
    title: "Resources",
    links: [
      /* "Insights" is the label; `/learn` is the URL that holds the equity. */
      ["Insights", "/learn"],
      ["Resources", "/resources"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["POPIA", "/popia"],
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[color:var(--vy-line)]">
      <div className="mx-auto max-w-[var(--vy-content)] px-[var(--vy-gutter)] pt-[56px] pb-[40px] lg:px-[40px] lg:pt-[80px] lg:pb-[48px]">
        {/* The CTA row. The same action as the nav and every closing band, in
            the same words — one primary action, repeated verbatim. */}
        <div className="flex flex-col gap-[20px] border-b border-[color:var(--vy-line)] pb-[48px] md:flex-row md:items-center md:justify-between">
          <div className="max-w-[520px]">
            <p className="vy-h3 text-[color:var(--vy-ink)]">
              Find out what your operations are costing you.
            </p>
            <p className="vy-small mt-[8px] text-[color:var(--vy-ink-3)]">
              The operations audit is free, and it ends in a diagnosis rather than a quote.
            </p>
          </div>
          <Button
            href="/operations-audit"
            event="book_audit_click"
            eventProps={{ page: "footer" }}
            className="self-start md:self-auto"
          >
            Free Operations Audit
          </Button>
        </div>

        <div className="mt-[48px] grid grid-cols-2 gap-[32px] md:grid-cols-4 md:gap-[40px]">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <div className="vy-label mb-[16px] text-[11px] text-[color:var(--vy-ink-3)]">
                {column.title}
              </div>
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="vy-small text-[13.5px] text-[color:var(--vy-ink-2)] transition-colors duration-150 hover:text-[color:var(--vy-ink)]"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-[48px] flex flex-wrap items-center gap-x-[22px] gap-y-[10px] border-t border-[color:var(--vy-line)] pt-[28px] text-[13px] text-[color:var(--vy-ink-3)] lg:mt-[64px]">
          <Wordmark size="footer" className="opacity-70" />
          <span>Johannesburg, South Africa</span>
          <TrackedLink
            href={`mailto:${SITE.email}`}
            event="outbound_click"
            eventProps={{ href: `mailto:${SITE.email}` }}
            className="text-[color:var(--vy-ink-2)] transition-colors duration-150 hover:text-[color:var(--vy-ink)]"
          >
            {SITE.email}
          </TrackedLink>
          <span className="ml-auto">&copy; {year} Vyso</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;

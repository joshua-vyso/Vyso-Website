import Image from "next/image";
import Link from "next/link";

import { TrackedLink } from "./TrackedLink";

const CONTACT_EMAIL = "joshua@vyso.co.za";

/* Four columns of real routes only. A link is listed here when the page exists
   today or 308s somewhere sensible — nothing points at a URL that 404s. */
const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Finch",
    links: [
      ["Home",               "/"],
      ["What Finch watches", "/#agents"],
      ["Under the hood",     "/platform/modules"],
      ["Integrations",       "/integrations"],
      ["Pricing",            "/pricing"],
      ["Compare",            "/compare"],
    ],
  },
  {
    title: "Vyso",
    links: [
      ["About",            "/about"],
      // Orbit is a Vyso product, not a Finch feature — it belongs in this
      // column rather than the one above it. Added with the nav link so the
      // subsite is reachable from the bottom of every marketing page as well
      // as the top, which is what makes ten trade pages crawlable.
      ["Orbit",            "/orbit"],
      ["Operations Audit", "/operations-audit"],
      ["Founding client",  "/founding-client"],
      // Academy has no page yet; the pricing page carries the honest
      // "coming soon" note, so the link goes there rather than nowhere.
      ["Academy",          "/academy"],
      ["Case studies",     "/case-studies"],
      ["Contact",          "/contact"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["Articles",     "/learn"],
      ["Resources",    "/resources"],
      ["FAQ",          "/faq"],
      ["South Africa", "/south-africa"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms",   "/terms"],
      ["POPIA",   "/popia"],
    ],
  },
];

/* The footer for every marketing route. The wordmark is pure black artwork, so
   it is quietened with opacity rather than a colour swap. */
export function FinchFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-fn-line">
      <div className="mx-auto max-w-[1160px] px-[20px] pt-[64px] pb-[40px] lg:px-[40px] lg:pt-[96px] lg:pb-[48px]">
        <div className="grid grid-cols-1 gap-[32px] md:grid-cols-4 md:gap-[40px]">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <div className="mb-[16px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted uppercase">
                {column.title}
              </div>
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {column.links.map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:text-fn-orange-deep"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-[48px] flex flex-wrap items-center gap-x-[22px] gap-y-[10px] border-t border-fn-line-2 pt-[28px] text-[12.5px] text-fn-muted lg:mt-[64px] lg:text-[13px]">
          <Image
            src="/finch/vyso-wordmark.svg"
            alt="Vyso"
            width={51}
            height={13}
            className="block h-[13px] w-auto opacity-70"
          />
          <span>Built by Vyso in Johannesburg.</span>
          <TrackedLink
            href={`mailto:${CONTACT_EMAIL}`}
            event="outbound_click"
            eventProps={{ href: `mailto:${CONTACT_EMAIL}` }}
            className="text-fn-ink-3 transition-colors duration-150 hover:text-fn-orange-deep"
          >
            {CONTACT_EMAIL}
          </TrackedLink>
          <span className="ml-auto">&copy; {year} Vyso</span>
        </div>
      </div>
    </footer>
  );
}

export default FinchFooter;

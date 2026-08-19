import Link from "next/link";

import { TRADES } from "@/lib/orbit/trades";
import { BRAND_LABEL, BrandLockup } from "@/components/finch/BrandLockup";

import { OrbitMobileMenu } from "./OrbitMobileMenu";

/* ── The Orbit nav ───────────────────────────────────────────────────────────
   Deliberately *not* `FinchNav` with different links. Two reasons, and the
   second one is the load-bearing one:

   1. The subsite has its own wordmark, its own single CTA and a trades menu
      that Finch has no equivalent of.
   2. `globals.css` inverts `nav[aria-label="Primary"]` over blue and ink
      bands — including `filter: invert(1)` on any `<img>` inside it, which
      exists because the Vyso wordmark is dark artwork on a dark band. Orbit's
      wordmark is *already* the light variant, so that filter would invert it
      back to near-black. Labelling this landmark `Orbit` rather than `Primary`
      opts the whole nav out of a rule written for a paper-first site, and the
      colours below are then stated once, explicitly, instead of being applied
      and then undone.

   A server component. The only client piece is the mobile sheet; the desktop
   trades menu is CSS (`group-hover` + `group-focus-within`) over a real link
   to `/orbit/for`, so it needs no hydration and degrades to a plain link.     */

export type OrbitNavSection = "how-it-works" | "pricing" | "faq" | "for" | "learn" | "none";

export const ORBIT_NAV_LINKS: { section: OrbitNavSection; href: string; label: string }[] = [
  { section: "how-it-works", href: "/orbit/how-it-works", label: "How it works" },
  { section: "pricing",      href: "/orbit/pricing",      label: "Pricing"       },
  { section: "faq",          href: "/orbit/faq",          label: "FAQ"           },
];

export const ORBIT_NAV_CTA = { href: "/orbit/waitlist", label: "Join Waitlist" };

const LINK_BASE = "transition-colors duration-150 hover:text-fn-orange-on-ink";

export function OrbitNav({ active = "none" }: { active?: OrbitNavSection }) {
  return (
    <nav
      aria-label="Orbit"
      /* `relative z-30` for the same reason `FinchNav` carries it: the hero is
         a dark band that runs its ground up behind the nav, and the band is a
         later sibling. */
      className="relative z-30 mx-auto flex max-w-[1160px] items-center gap-[28px] px-[20px] py-[18px] text-ob-text lg:px-[40px] lg:py-[24px]"
    >
      {/* `Vyso | Orbit`, the same lockup component the Finch nav draws as
          `Vyso | Finch`. Orbit is a product of the company, not a company, and
          a top-left that says only "Orbit" is the one place a reader would
          never find that out. */}
      <Link href="/orbit" aria-label={BRAND_LABEL.orbit} className="flex shrink-0 items-center">
        <BrandLockup product="orbit" size="nav" />
      </Link>

      <div className="ml-auto flex items-center gap-[16px] text-[14px] font-medium lg:gap-[24px]">
        {ORBIT_NAV_LINKS.map(({ section, href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={section === active ? "page" : undefined}
            className={`hidden lg:inline ${LINK_BASE} ${
              section === active ? "text-ob-text" : "text-ob-text-2"
            }`}
          >
            {label}
          </Link>
        ))}

        {/* The trades menu. The trigger is a real link to a real hub page, so
            the panel is an enhancement rather than the only way in — which is
            what makes a hover menu acceptable here at all. */}
        <div className="group relative hidden lg:block">
          <Link
            href="/orbit/for"
            aria-current={active === "for" ? "page" : undefined}
            className={`inline-flex items-center gap-[5px] ${LINK_BASE} ${
              active === "for" ? "text-ob-text" : "text-ob-text-2"
            }`}
          >
            For trades
            <svg aria-hidden viewBox="0 0 10 6" className="h-[5px] w-[9px] transition-transform duration-150 group-hover:rotate-180">
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div
            className="invisible absolute right-0 top-full z-40 pt-[14px] opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
          >
            <ul className="m-0 grid w-[420px] list-none grid-cols-2 gap-x-[8px] gap-y-[2px] rounded-[12px] border border-ob-line bg-ob-surface p-[12px] shadow-[0_24px_60px_rgba(2,6,16,0.55)]">
              {TRADES.map((trade) => (
                <li key={trade.slug}>
                  <Link
                    href={`/orbit/for/${trade.slug}`}
                    className="block rounded-[7px] px-[10px] py-[8px] text-[13.5px] text-ob-text-2 transition-colors duration-150 hover:bg-white/[0.06] hover:text-ob-text"
                  >
                    {trade.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Link
          href="/"
          className={`hidden text-ob-mono lg:inline ${LINK_BASE}`}
        >
          Vyso
        </Link>

        <Link
          href={ORBIT_NAV_CTA.href}
          className="rounded-[8px] bg-fn-orange-cta px-[14px] py-[8px] text-[13px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white lg:px-[18px] lg:py-[9px] lg:text-[14px]"
        >
          {ORBIT_NAV_CTA.label}
        </Link>

        <OrbitMobileMenu
          active={active}
          links={ORBIT_NAV_LINKS}
          trades={TRADES.map((t) => ({ href: `/orbit/for/${t.slug}`, label: t.name }))}
          cta={ORBIT_NAV_CTA}
          className="lg:hidden"
        />
      </div>
    </nav>
  );
}

export default OrbitNav;

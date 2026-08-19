import Link from "next/link";
import { BRAND_LABEL, BrandLockup } from "./BrandLockup";

import { MobileMenu } from "./MobileMenu";
import { TrackedLink } from "./TrackedLink";

/** Which nav item the current page is, so it can carry the active ink colour. */
export type FinchNavSection = "industries" | "pricing" | "learn" | "orbit" | "none";

export type FinchNavLink = { section: FinchNavSection; href: string; label: string };

/* Passed down to `MobileMenu` rather than imported by it: this module is a
   server component, so a client import here would drag the whole nav into the
   client bundle. Plain data crosses the boundary as props for free.

   No "Finch" link: the homepage *is* the product page, so the wordmark on the
   left is already that link and a second one would point at the page you are
   most often already on. */
export const FINCH_NAV_LINKS: FinchNavLink[] = [
  { section: "industries", href: "/industries", label: "Industries" },
  { section: "pricing",    href: "/pricing",    label: "Pricing"    },
  { section: "learn",      href: "/learn",      label: "Learn"      },
  /* Orbit — the second product surface (`.ai/plan_orbit_site.md`). One link,
     no mega-menu: this nav has none, and Orbit's own subsite carries the
     trades menu. Deliberately last in the row, and deliberately *not* the CTA:
     the CTA sells the audit, which is a thing that exists today, and Orbit is
     a waitlist. `/orbit` swaps to `OrbitNav` entirely, so no page ever shows
     both navs. */
  { section: "orbit",      href: "/orbit",      label: "Orbit"      },
];

export const FINCH_NAV_CTA = { href: "/operations-audit", label: "Book your audit" };
export const FINCH_NAV_LOGIN = { href: "/login", label: "Log in" };

/* The nav for every marketing route. Desktop shows every link inline — there is
   no hamburger above `lg`; the hamburger and its sheet only exist below it. */
export function FinchNav({ active = "none" }: { active?: FinchNavSection }) {
  return (
    <nav
      aria-label="Primary"
      /* `relative z-30`: a page whose first band is dark runs that ground up
         behind the nav (`Band`'s `underNav`). The band is a later sibling, so
         without a stacking order of its own the nav would be painted over by
         the very ground it is meant to invert against. Harmless on every other
         page — the nav is the topmost element there anyway. */
      className="relative z-30 mx-auto flex max-w-[1160px] items-center gap-[36px] px-[20px] py-[18px] lg:px-[40px] lg:py-[26px]"
    >
      {/* The company lockup, not a Finch wordmark: `Vyso | Finch`, the same
          component the Orbit nav draws as `Vyso | Orbit`. One link, one
          accessible name — see `BrandLockup`. */}
      <Link href="/" aria-label={BRAND_LABEL.finch} className="flex items-center">
        <BrandLockup product="finch" size="nav" />
      </Link>

      <div className="ml-auto flex items-center gap-[14px] text-[14px] font-medium lg:gap-[26px]">
        {FINCH_NAV_LINKS.map(({ section, href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={section === active ? "page" : undefined}
            className={`hidden transition-colors duration-150 hover:text-fn-orange-deep lg:inline ${
              section === active ? "text-fn-ink" : "text-fn-ink-2"
            }`}
          >
            {label}
          </Link>
        ))}
        {/* Log in is a returning-customer door, not a marketing link — one step
            quieter than the rest of the row so it never competes with the CTA. */}
        <Link
          href={FINCH_NAV_LOGIN.href}
          className="hidden text-fn-muted transition-colors duration-150 hover:text-fn-orange-deep lg:inline"
        >
          {FINCH_NAV_LOGIN.label}
        </Link>
        {/* `data-nav-cta` is what the ground-inversion rules in globals.css
            exclude: over a blue or ink band every other link in this row goes
            warm-white, and the CTA deliberately does not — §8 keeps it orange
            on every ground, because it is the one element whose colour is a
            decision rather than a context. */}
        <TrackedLink
          href={FINCH_NAV_CTA.href}
          event="book_audit_click"
          eventProps={{ page: "nav" }}
          data-nav-cta
          className="rounded-[8px] bg-fn-orange-cta px-[14px] py-[8px] text-[13px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white lg:px-[18px] lg:py-[9px] lg:text-[14px]"
        >
          {FINCH_NAV_CTA.label}
        </TrackedLink>
        <MobileMenu
          active={active}
          links={FINCH_NAV_LINKS}
          login={FINCH_NAV_LOGIN}
          cta={FINCH_NAV_CTA}
          className="lg:hidden"
        />
      </div>
    </nav>
  );
}

export default FinchNav;

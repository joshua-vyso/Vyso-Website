import Link from "next/link";

import { Button } from "./Button";
import { MobileMenu } from "./MobileMenu";
import { Wordmark } from "./Wordmark";

/* ── The nav ─────────────────────────────────────────────────────────────────
   Five links, a quiet log in, one filled CTA. Nothing else (plan §5): no Finch,
   no Orbit, no Industries, no Academy. Industries stays reachable from the
   footer and from internal links, which is what it is worth.

   "Insights" is a LABEL, not a URL. The eight articles and twelve glossary
   terms live at `/learn/**` and carry every scrap of search equity the site
   has; renaming the route to match the word in the nav would trade that for
   nothing. `/insights` 301s to `/learn` (plan §6).

   Server component. Only the hamburger and its sheet are client, and they are
   handed their links as plain data so importing `MobileMenu` here does not drag
   the row into the bundle. */

export type VysoNavSection =
  | "how-it-works"
  | "solutions"
  | "case-studies"
  | "about"
  | "insights"
  | "none";

export type VysoNavLink = { section: VysoNavSection; href: string; label: string };

export const VYSO_NAV_LINKS: VysoNavLink[] = [
  { section: "how-it-works", href: "/how-it-works", label: "How it works" },
  { section: "solutions", href: "/solutions", label: "Solutions" },
  { section: "case-studies", href: "/case-studies", label: "Case studies" },
  { section: "about", href: "/about", label: "About" },
  { section: "insights", href: "/learn", label: "Insights" },
];

export const VYSO_NAV_CTA = { href: "/operations-audit", label: "Free Operations Audit" };
export const VYSO_NAV_LOGIN = { href: "/login", label: "Log in" };

export function Nav({ active = "none" }: { active?: VysoNavSection }) {
  return (
    <nav
      aria-label="Primary"
      className="relative z-30 mx-auto flex max-w-[var(--vy-content)] items-center gap-[36px] px-[var(--vy-gutter)] py-[18px] lg:px-[40px] lg:py-[24px]"
    >
      <Link href="/" aria-label="Vyso, home" className="flex items-center">
        <Wordmark size="nav" />
      </Link>

      <div className="ml-auto flex items-center gap-[14px] text-[14px] lg:gap-[26px]">
        {VYSO_NAV_LINKS.map(({ section, href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={section === active ? "page" : undefined}
            className={`hidden transition-colors duration-150 hover:text-[color:var(--vy-ink)] lg:inline ${
              section === active
                ? "text-[color:var(--vy-ink)]"
                : "text-[color:var(--vy-ink-2)]"
            }`}
          >
            {label}
          </Link>
        ))}
        {/* Log in is a returning-customer door, not a marketing link — one step
            quieter than the rest of the row so it never competes with the CTA. */}
        <Link
          href={VYSO_NAV_LOGIN.href}
          className="hidden text-[color:var(--vy-ink-3)] transition-colors duration-150 hover:text-[color:var(--vy-ink)] lg:inline"
        >
          {VYSO_NAV_LOGIN.label}
        </Link>
        {/* Visible at every width, including 375px — the free audit is the
            site's single conversion target and hiding it behind a hamburger on
            the devices most South African SME owners browse on would be the
            wrong economy. `sm` is what makes it fit; see `ButtonSize`. */}
        <Button
          href={VYSO_NAV_CTA.href}
          size="sm"
          event="book_audit_click"
          eventProps={{ page: "nav" }}
        >
          {VYSO_NAV_CTA.label}
        </Button>
        <MobileMenu
          active={active}
          links={VYSO_NAV_LINKS}
          login={VYSO_NAV_LOGIN}
          cta={VYSO_NAV_CTA}
          className="lg:hidden"
        />
      </div>
    </nav>
  );
}

export default Nav;

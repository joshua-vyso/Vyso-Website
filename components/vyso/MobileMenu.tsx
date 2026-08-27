"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";
import { track } from "@/lib/analytics";

import { Wordmark } from "./Wordmark";
import type { VysoNavLink, VysoNavSection } from "./Nav";

type NavTarget = { href: string; label: string };

/* ── The hamburger glyph ─────────────────────────────────────────────────────
   Two 18px hairlines 6px apart that rotate into an × over 200ms. Both states
   render from the same two spans so the morph is a transition, not a swap. */
function Bars({ open }: { open: boolean }) {
  const base =
    "absolute left-[11px] h-px w-[18px] bg-[color:var(--vy-ink)] transition-transform duration-200 ease-out";
  return (
    <span aria-hidden="true" className="relative block h-[40px] w-[40px]">
      <span
        className={base}
        style={{
          top: "50%",
          transform: open ? "translateY(-0.5px) rotate(45deg)" : "translateY(-3.5px)",
        }}
      />
      <span
        className={base}
        style={{
          top: "50%",
          transform: open ? "translateY(-0.5px) rotate(-45deg)" : "translateY(2.5px)",
        }}
      />
    </span>
  );
}

/* ── The sheet ───────────────────────────────────────────────────────────────
   A full-screen panel below `lg`. Ported from `components/finch/MobileMenu.tsx`
   with its two hard-won details intact, both of which are easy to lose in a
   rewrite:

   1. **Open is derived from the pathname, not synced to it.** `openedOn` holds
      the route the sheet was opened on and `open` is "that route is still the
      current one", so a navigation closes the sheet with no effect at all. The
      repo's ESLint config errors on `react-hooks/set-state-in-effect`, and the
      obvious `useEffect(() => setOpen(false), [pathname])` is exactly that.
   2. **The focus trap pulls focus back in**, not just wraps at the ends —
      browser chrome and the nav underneath can otherwise hold it.

   The sheet itself never fades: it is solid `--vy-bg` from the first frame,
   because a cross-fading panel is translucent for as long as it lasts. Only the
   items move, and under reduced motion they do not. */

export function MobileMenu({
  active = "none",
  links,
  login,
  cta,
  className = "",
}: {
  active?: VysoNavSection;
  links: VysoNavLink[];
  login: NavTarget;
  cta: NavTarget;
  className?: string;
}) {
  const pathname = usePathname();
  const still = useStaticMotion();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn !== null && openedOn === pathname;

  const close = useCallback(() => {
    setOpenedOn(null);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(sheet.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));

    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      const inside = current instanceof Node && sheet.contains(current);
      if (event.shiftKey && (!inside || current === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || current === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  /* The system's ceiling is 80ms; the sheet uses half of it, because five items
     arriving one after another is a list opening, not a performance. */
  const step = still ? 0 : 0.04;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => (open ? close() : setOpenedOn(pathname))}
        className={`-mr-[8px] flex h-[40px] w-[40px] items-center justify-center ${className}`}
      >
        <Bars open={open} />
      </button>

      {open ? (
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[color:var(--vy-bg)] lg:hidden"
        >
          {/* Mirrors the nav row above it, so the × lands where the hamburger
              was and the sheet reads as the nav expanding rather than a new
              screen arriving. */}
          <div className="flex items-center gap-[36px] border-b border-[color:var(--vy-line)] px-[var(--vy-gutter)] py-[18px]">
            <Link href="/" onClick={close} aria-label="Vyso, home" className="flex items-center">
              <Wordmark size="sheet" />
            </Link>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="-mr-[8px] ml-auto flex h-[40px] w-[40px] items-center justify-center"
            >
              <Bars open />
            </button>
          </div>

          <div className="flex flex-1 flex-col px-[var(--vy-gutter)] pt-[32px] pb-[32px]">
            <ul className="m-0 flex list-none flex-col gap-[22px] p-0">
              {links.map(({ section, href, label }, i) => (
                <motion.li
                  key={href}
                  initial={still ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut", delay: i * step }}
                >
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={section === active ? "page" : undefined}
                    className={`vy-h2 text-[26px] ${
                      section === active
                        ? "text-[color:var(--vy-ink)]"
                        : "text-[color:var(--vy-ink-2)]"
                    }`}
                  >
                    {label}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <div className="mt-auto flex flex-col gap-[18px] border-t border-[color:var(--vy-line)] pt-[28px]">
              <Link
                href={login.href}
                onClick={close}
                className="text-[15px] font-medium text-[color:var(--vy-ink-3)]"
              >
                {login.label}
              </Link>
              {/* Not `Button`: the sheet's CTA is full-width and closes the
                  sheet as well as tracking, which is an `onClick` the server
                  component cannot carry. Same fill, same radius, same label. */}
              <Link
                href={cta.href}
                onClick={() => {
                  track("book_audit_click", { page: "nav_sheet" });
                  close();
                }}
                className="rounded-[var(--vy-radius)] bg-[color:var(--vy-ink)] px-[24px] py-[15px] text-center text-[15px] font-medium text-[color:var(--vy-bg)]"
              >
                {cta.label}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MobileMenu;

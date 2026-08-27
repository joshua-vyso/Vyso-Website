"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BRAND_LABEL, BrandLockup, type BrandName } from "./BrandLockup";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { track } from "@/lib/analytics";

import type { FinchNavLink, FinchNavSection } from "./FinchNav";

type NavTarget = { href: string; label: string };

/* ── The hamburger glyph ─────────────────────────────────────────────────────
   Two 18px hairlines 6px apart that rotate into an × over 200ms. Both states
   render from the same two spans so the morph is a transition, not a swap. */
function Bars({ open }: { open: boolean }) {
  const base =
    "absolute left-[11px] h-px w-[18px] bg-fn-ink transition-transform duration-200 ease-out";
  return (
    <span aria-hidden="true" className="relative block h-[40px] w-[40px]">
      {/* `data-nav-bar`: the bars are `bg-fn-ink`, which is invisible on an ink
          band. 6b gave `/pricing` a dark hero that runs behind the nav, so the
          ground-inversion rules in globals.css now flip these two hairlines to
          `--fn-ink-text` alongside the links — and deliberately do not flip the
          identical pair inside the sheet, which is always on paper. */}
      <span
        data-nav-bar
        className={base}
        style={{
          top: "50%",
          transform: open ? "translateY(-0.5px) rotate(45deg)" : "translateY(-3.5px)",
        }}
      />
      <span
        data-nav-bar
        className={base}
        style={{
          top: "50%",
          transform: open ? "translateY(-0.5px) rotate(-45deg)" : "translateY(2.5px)",
        }}
      />
    </span>
  );
}

export function MobileMenu({
  active = "none",
  links,
  login,
  cta,
  /** Mirrors `FinchNav`'s prop of the same name — the sheet's top-left has to
      name the same thing the nav row above it does. */
  brand = "finch",
  className = "",
}: {
  active?:   FinchNavSection;
  links:     FinchNavLink[];
  login:     NavTarget;
  cta:       NavTarget;
  brand?:    BrandName;
  className?: string;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const sheetRef  = useRef<HTMLDivElement | null>(null);

  /* The sheet is open only while the route it was opened on is still the
     current one. Deriving "open" from the pathname closes it on navigation
     without an effect — the repo's ESLint config errors on
     `react-hooks/set-state-in-effect`, and this needs no state sync at all. */
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
      // Trap: wrap at both ends, and pull focus back in if it has escaped the
      // sheet (browser chrome, or the nav underneath, can hold it otherwise).
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last  = items[items.length - 1];
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

  const stagger = reduceMotion ? 0 : 0.04;

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
        /* The sheet itself never fades: it is solid `#FAF9F6` from the first
           frame (the Finch surface has no glass, and a cross-fading panel is
           translucent for as long as it lasts). Only the items move. */
        <div
          ref={sheetRef}
          /* The sheet lives inside `<nav>`, so without this marker the nav's
             ground-inversion rules would recolour every link in it to
             warm-white — on a warm-white panel. globals.css excludes anything
             under `[data-nav-sheet]` from the inversion and re-asserts the
             paper ink for whatever inherits its colour. */
          data-nav-sheet
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-fn-bg lg:hidden"
        >
          {/* Mirrors the nav row above it, so the × lands where the hamburger
              was and the sheet reads as the nav expanding rather than a new
              screen arriving. */}
          <div className="flex items-center gap-[36px] border-b border-fn-line px-[20px] py-[18px]">
            <Link
              href="/"
              onClick={close}
              aria-label={BRAND_LABEL[brand]}
              className="flex items-center"
            >
              <BrandLockup product={brand} size="sheet" />
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

          <div className="flex flex-1 flex-col px-[20px] pt-[32px] pb-[32px]">
            <ul className="m-0 flex list-none flex-col gap-[24px] p-0">
              {links.map(({ section, href, label }, i) => (
                <motion.li
                  key={href}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut", delay: i * stagger }}
                >
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={section === active ? "page" : undefined}
                    className={`font-fn-serif text-[28px] tracking-[-0.015em] ${
                      section === active ? "text-fn-ink" : "text-fn-ink-2"
                    }`}
                  >
                    {label}
                  </Link>
                </motion.li>
              ))}
            </ul>

            <div className="mt-auto flex flex-col gap-[18px] border-t border-fn-line pt-[28px]">
              <Link
                href={login.href}
                onClick={close}
                className="text-[15px] font-medium text-fn-muted"
              >
                {login.label}
              </Link>
              <Link
                href={cta.href}
                onClick={() => {
                  track("book_audit_click", { page: "nav" });
                  close();
                }}
                className="rounded-[10px] bg-fn-orange-cta px-[24px] py-[15px] text-center text-[15px] font-semibold text-[#FFF7F0]"
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

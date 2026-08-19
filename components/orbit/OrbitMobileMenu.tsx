"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { OrbitNavSection } from "./OrbitNav";

/* ── The mobile sheet ────────────────────────────────────────────────────────
   The same mechanism as `components/finch/MobileMenu.tsx` — open state derived
   from the pathname so a navigation closes it without an effect, focus trapped
   while open, Escape closes, body scroll locked — on the Orbit ground, and
   carrying the ten trade links that the desktop nav puts in a hover panel.

   The two differences from the Finch sheet are both consequences of the dark
   ground: the panel is `--ob-bg` rather than paper (so it needs no
   `data-nav-sheet` marker, because there is no inversion to opt out of), and
   the bars are `--ob-text` rather than `--fn-ink`.

   No `motion` import. The Finch sheet staggers its items in; this one has
   fourteen links including the trades, and a staggered fourteen-item list is a
   half-second of the reader waiting for a menu. It appears.                    */

type NavTarget = { href: string; label: string };

function Bars({ open }: { open: boolean }) {
  const base = "absolute left-[11px] h-px w-[18px] bg-ob-text transition-transform duration-200 ease-out";
  return (
    <span aria-hidden="true" className="relative block h-[40px] w-[40px]">
      <span
        className={base}
        style={{ top: "50%", transform: open ? "translateY(-0.5px) rotate(45deg)" : "translateY(-3.5px)" }}
      />
      <span
        className={base}
        style={{ top: "50%", transform: open ? "translateY(-0.5px) rotate(-45deg)" : "translateY(2.5px)" }}
      />
    </span>
  );
}

export function OrbitMobileMenu({
  active = "none",
  links,
  trades,
  cta,
  className = "",
}: {
  active?: OrbitNavSection;
  links: { section: OrbitNavSection; href: string; label: string }[];
  trades: NavTarget[];
  cta: NavTarget;
  className?: string;
}) {
  const pathname = usePathname();
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
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ob-bg lg:hidden"
        >
          <div className="flex items-center gap-[28px] border-b border-ob-line px-[20px] py-[18px]">
            <Link href="/orbit" onClick={close} className="flex items-center">
              <Image
                src="/orbit/orbit-primary-dark.svg"
                alt="Orbit"
                width={1200}
                height={425}
                className="block h-[26px] w-auto"
              />
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

          <div className="flex flex-1 flex-col px-[20px] pt-[28px] pb-[32px]">
            <ul className="m-0 flex list-none flex-col gap-[20px] p-0">
              {links.map(({ section, href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={section === active ? "page" : undefined}
                    className={`font-fn-serif text-[26px] tracking-[-0.015em] ${
                      section === active ? "text-ob-text" : "text-ob-text-2"
                    }`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-[30px] mb-[12px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
              For trades
            </p>
            <ul className="m-0 grid list-none grid-cols-2 gap-x-[12px] gap-y-[10px] p-0">
              {trades.map((trade) => (
                <li key={trade.href}>
                  <Link href={trade.href} onClick={close} className="text-[14.5px] text-ob-text-2">
                    {trade.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-col gap-[16px] border-t border-ob-line pt-[26px]">
              <Link href="/" onClick={close} className="text-[14.5px] font-medium text-ob-mono">
                Built on Vyso
              </Link>
              <Link
                href={cta.href}
                onClick={close}
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

export default OrbitMobileMenu;

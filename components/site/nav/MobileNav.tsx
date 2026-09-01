"use client";

/* ── Mobile navigation ───────────────────────────────────────────────────────
   The authored dock is a pointer-proximity instrument; its own controller
   already goes static under 600px, and per the integration brief the site
   provides a simpler mobile navigation instead of stretching the bar. Plain
   fixed header + a full-screen <dialog> menu: native focus trapping, Esc to
   close, closes on navigation. */

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";

const LINKS = [
  { href: "/automations", label: "Automations" },
  { href: "/industries", label: "Industries" },
  { href: "/integrations", label: "Integrations" },
  { href: "/about", label: "About" },
  { href: "/login", label: "Log in" },
];

export function MobileNav() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  /* Close on route change (Next preserves the dialog across soft navs). */
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  return (
    <>
      <div className="vy-mobilebar">
        <Link href="/" aria-label="Vyso — home">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size inline wordmark */}
          <img src="/site/vyso-wordmark-paper.svg" alt="" width={54} height={14} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className="rounded-full bg-signal-cta px-4 py-2 text-sm font-semibold text-[#FFF7F0]"
            onClick={() => track("join_waitlist_click", { source: "mobile_nav" })}
          >
            Join waitlist
          </Link>
          <button
            type="button"
            className="rounded-full border border-inkline px-4 py-2 text-sm font-medium text-paper"
            onClick={() => dialogRef.current?.showModal()}
          >
            Menu
          </button>
        </div>
      </div>
      <dialog
        ref={dialogRef}
        className="vy-mobilemenu m-0 h-dvh max-h-none w-full max-w-none bg-ink text-paper"
        aria-label="Site menu"
      >
        <div className="flex h-full flex-col px-6 pb-10 pt-4">
          <div className="flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size inline wordmark */}
            <img src="/site/vyso-wordmark-paper.svg" alt="Vyso" width={54} height={14} />
            <button
              type="button"
              className="rounded-full border border-inkline px-4 py-2 text-sm"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
          </div>
          <nav aria-label="Primary" className="mt-10 flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-4 text-2xl font-medium text-paper hover:bg-white/5"
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto">
            <Link
              href="/join"
              className="vy-btn vy-btn-primary w-full"
              onClick={() => track("join_waitlist_click", { source: "mobile_nav" })}
            >
              Join the waitlist
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}

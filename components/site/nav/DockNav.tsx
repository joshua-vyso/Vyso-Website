"use client";

/* ── Primary navigation: AnimatedTopDock command bar, exact-source adapter ───
   The registered `AnimatedTopDock` component (`src/shaders/animated-top-dock/
   AnimatedTopDock.tsx`, hash-verified) is a self-contained catalogue demo: its
   "modern" variant hard-codes a placeholder brand and five inert buttons and
   exposes no label/link API. Per the integration brief ("use supported
   configuration, slots, or an application-level adapter — do not modify the
   verified registered files"), this adapter composes the SITE's real
   navigation from the same authored parts, all unmodified:

   - `createTopDockController` (the registered spring/proximity engine) runs
     over this bar exactly as it does in the registered component, with the
     brief's configured options: proximity 122, spring 0.19, damping 0.70,
     widthGrowth 17, heightGrowth 16, drop 3.5 — plus the modern variant's
     `lockTrack` fit on the x axis, matching the registered invocation.
   - The authored `atd-modern__*` classes from the verified `threeui.css`
     drive all visual styling; `.vy-dockframe` (globals.css) only neutralises
     the catalogue framing on elements this file composes.

   The controller itself handles reduced motion, coarse pointers and <600px
   viewports by going static; links stay plain anchors so navigation works
   with no JS and no WebGL at all. Below 720px the site swaps to `MobileNav`. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createTopDockController } from "@/src/shaders/animated-top-dock/topDockController";
import { track } from "@/lib/analytics";

export type DockLink = { href: string; label: string; icon: React.ReactNode };

/* 16×16 stroke glyphs drawn for this site in the authored icon idiom
   (fill:none, stroke:currentColor via the registered `.atd-modern__icon svg`
   rule). */
const NAV_LINKS: DockLink[] = [
  {
    href: "/automations",
    label: "Automations",
    icon: (
      <>
        <path d="M8 1.9 14.1 5v6L8 14.1 1.9 11V5z" />
        <path d="M1.9 5 8 8.1 14.1 5M8 8.1v6" />
      </>
    ),
  },
  {
    href: "/industries",
    label: "Industries",
    icon: (
      <>
        <path d="M8 1.9 14.4 5.6 8 9.3 1.6 5.6z" />
        <path d="m2.6 8 5.4 3.1L13.4 8M2.6 10.7 8 13.8l5.4-3.1" />
      </>
    ),
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: (
      <>
        <circle cx="3.2" cy="8" r="1.7" />
        <circle cx="12.8" cy="3.6" r="1.7" />
        <circle cx="12.8" cy="12.4" r="1.7" />
        <path d="M4.8 7.2 11.2 4.3M4.8 8.8l6.4 2.9" />
      </>
    ),
  },
  {
    href: "/about",
    label: "About",
    icon: (
      <>
        <circle cx="8" cy="8" r="5.9" />
        <path d="M8 7.2v4M8 4.9h.01" />
      </>
    ),
  },
];

export function DockNav() {
  const dockRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  /* Collapse rules (Josh, 2026-09): the full bar is CONSTANT over the hero;
     everywhere else it lives as the hamburger, opened by a press. The one
     exception: an upward scroll while still in the problem section (just
     after the hero) unfolds the bar — beyond that, scrolling up does nothing
     and only the hamburger expands it. A manual expand gets ~120px of grace
     before scroll-down folds it again. Presentation only, on the SITE's
     wrapper — the registered controller keeps running underneath. */
  const [collapsed, setCollapsed] = useState(false);
  const manualExpandYRef = useRef<number | null>(null);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      const vh = window.innerHeight;

      const heroWrap = document.querySelector<HTMLElement>(".vy-hero-wrap");
      /* Hero zone: while the sticky hero stage is still what the wrapper is
         paying out (its travel = wrapper height − one viewport). Pages
         without a hero treat the top of the page the same way. */
      const heroZone = heroWrap ? y < heroWrap.offsetHeight - vh : y < 180;
      if (heroZone) {
        manualExpandYRef.current = null;
        setCollapsed(false);
        return;
      }
      if (Math.abs(delta) < 6) return;
      if (delta > 0) {
        const grace = manualExpandYRef.current;
        if (grace !== null && y < grace + 120) return;
        manualExpandYRef.current = null;
        setCollapsed(true);
        return;
      }
      /* Scrolling up: only the problem section re-expands. */
      const problem = document.getElementById("problem-heading")?.closest("section");
      if (problem) {
        const rect = problem.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < vh) setCollapsed(false);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const root = dockRef.current;
    if (!root) return undefined;
    return createTopDockController(root, () => ({
      proximity: 122,
      spring: 0.19,
      damping: 0.7,
      widthGrowth: 17,
      heightGrowth: 16,
      drop: 3.5,
      axis: "x",
      lockTrack: true,
    }));
  }, []);

  const onDark = pathname === "/";

  return (
    <div
      className="vy-dockframe"
      data-ground={onDark ? "dark" : "paper"}
      data-nav={collapsed ? "collapsed" : "expanded"}
    >
      <button
        type="button"
        className="vy-navburger"
        aria-label="Show navigation"
        aria-expanded={!collapsed}
        onClick={() => {
          manualExpandYRef.current = window.scrollY;
          setCollapsed(false);
        }}
        inert={!collapsed}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
        </svg>
      </button>
      <div className="animated-top-dock-component atd-modern" inert={collapsed}>
        <header className="atd-modern__bar">
          <Link className="atd-modern__brand" href="/" aria-label="Vyso — home">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size
                inline wordmark; next/image adds a wrapper the authored brand
                row doesn't expect */}
            <img
              src="/site/vyso-wordmark-paper.svg"
              alt=""
              className="vy-dock-wordmark"
              width={54}
              height={14}
            />
          </Link>
          <nav
            ref={dockRef}
            className="atd-modern__dock"
            aria-label="Primary"
            data-dock-state="idle"
            data-dock-max="0.00"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                className="atd-modern__item"
                data-dock-item
                href={link.href}
                aria-current={
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "page"
                    : undefined
                }
              >
                <span className="atd-modern__icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16">{link.icon}</svg>
                </span>
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>
          <div className="atd-modern__actions">
            <Link className="atd-modern__ghost" href="/login">
              Log in
            </Link>
            <Link
              className="atd-modern__cta"
              href="/join"
              onClick={() => track("join_waitlist_click", { source: "nav" })}
            >
              <span>Book a free audit</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.2 8h9.1M8.6 4.3 12.4 8l-3.8 3.7" />
              </svg>
            </Link>
          </div>
        </header>
      </div>
    </div>
  );
}

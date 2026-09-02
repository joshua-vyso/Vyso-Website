"use client";

/* ── Status bar + menu ───────────────────────────────────────────────────────
   A fixed bar blended with `difference` so it reads over the ink plate and
   the paper without swapping themes: wordmark, links, a live Johannesburg
   clock and the one CTA. The menu is a full-screen ink overlay with the
   links in the display face. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { BRAND, NAV } from "./content";

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const time = useClock();

  /* Close on navigation: React's "adjust state while rendering" pattern
     (no effect, no cascading render). */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      setScrolled(window.scrollY > window.innerHeight * 0.6);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header className="vx-nav" role="banner" data-scrolled={scrolled && !open ? "true" : "false"}>
        <Link href="/" className="vx-nav-brand" aria-label="Vyso home" data-cursor="link">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline wordmark */}
          <img src="/site/vyso-wordmark-paper.svg" alt="Vyso" width={62} height={16} />
        </Link>
        <nav className="vx-nav-links" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href || pathname.startsWith(item.href + "/") ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="vx-nav-right">
          <span className="vx-nav-clock" aria-label={`Johannesburg time ${time}`}>
            <i aria-hidden="true" />
            JHB {time || "--:--"}
          </span>
          <Link
            href="/join"
            className="vx-nav-cta"
            onClick={() => track("join_waitlist_click", { source: "nav" })}
          >
            Book a free audit
          </Link>
          <button
            type="button"
            className="vx-nav-menu"
            aria-expanded={open}
            aria-controls="vx-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="bars" aria-hidden="true">
              <i />
              <i />
            </span>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <div id="vx-menu" className="vx-menu" data-open={open ? "true" : "false"} aria-hidden={!open}>
        <nav className="vx-menu-links" aria-label="Menu">
          {[{ href: "/", label: "Home" }, ...NAV, { href: "/construction", label: "Vyso Construction" }, { href: "/join", label: "Book a free audit" }].map((item, i) => (
            <Link key={item.href} href={item.href} tabIndex={open ? 0 : -1}>
              <span style={{ "--i": i } as React.CSSProperties}>{item.label}</span>
              <small style={{ "--i": i } as React.CSSProperties}>0{i + 1}</small>
            </Link>
          ))}
        </nav>
        <div className="vx-menu-foot">
          <a href={`mailto:${BRAND.email}`} tabIndex={open ? 0 : -1}>
            {BRAND.email}
          </a>
          <span>{BRAND.city}, {BRAND.country}</span>
          <span>AI automation agency</span>
        </div>
      </div>
    </>
  );
}

"use client";

/* ── VX primitives ───────────────────────────────────────────────────────────
   Reveal, Words, Marquee and the arrow button. Everything renders real text
   on the server (crawlers and reduced-motion users see the finished state via
   CSS); the client only adds an IntersectionObserver that flips a class. */

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

type Tag = "div" | "section" | "li" | "article" | "p" | "h1" | "h2" | "h3" | "span" | "figure";

function useInView<T extends HTMLElement>(cls = "is-in", margin = "-12% 0px") {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add(cls);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add(cls);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.05 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [cls, margin]);
  return ref;
}

export function Reveal({
  as: T = "div",
  className = "",
  delay = 0,
  children,
  margin,
}: {
  as?: Tag;
  className?: string;
  delay?: number;
  children: ReactNode;
  margin?: string;
}) {
  const ref = useInView<HTMLElement>("is-in", margin);
  return (
    <T
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow tag union, one ref
      ref={ref as any}
      className={`vx-reveal ${className}`}
      style={delay ? ({ "--d": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </T>
  );
}

/** Splits a string into masked words; `em` marks words rendered in the italic
    voice. Real text stays in the DOM in reading order. */
export function Words({
  text,
  em,
  as: T = "span",
  className = "",
  delay = 0,
  startIndex = 0,
  immediate = false,
}: {
  text: string;
  em?: string;
  as?: Tag;
  className?: string;
  delay?: number;
  startIndex?: number;
  immediate?: boolean;
}) {
  const ref = useInView<HTMLElement>("is-in", "-6% 0px");
  useEffect(() => {
    if (immediate) ref.current?.classList.add("is-in");
  }, [immediate, ref]);
  const words = text.split(" ");
  const emWords = em ? em.split(" ") : [];
  let i = startIndex;
  return (
    <T
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`vx-words ${className}`}
      style={delay ? ({ "--d": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {words.map((w, k) => (
        <span key={`w${k}`}>
          <span className="w">
            <span style={{ "--i": i++ } as React.CSSProperties}>{w}</span>
          </span>
          {k < words.length - 1 || emWords.length ? " " : ""}
        </span>
      ))}
      {emWords.map((w, k) => (
        <span key={`e${k}`}>
          <span className="w">
            <span className="vx-em" style={{ "--i": i++ } as React.CSSProperties}>
              {w}
            </span>
          </span>
          {k < emWords.length - 1 ? " " : ""}
        </span>
      ))}
    </T>
  );
}

export function Marquee({
  children,
  speed = 40,
  reverse = false,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div className={`vx-marquee ${className}`} aria-hidden="true">
      <div
        className="vx-marquee-track"
        data-reverse={reverse ? "" : undefined}
        style={{ "--speed": `${speed}s` } as React.CSSProperties}
      >
        {children}
        {children}
      </div>
    </div>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2 8h11M8.5 3.5 13 8l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The site's button: a pill with the orange dot that turns into an arrow.
    Magnetic on fine pointers (the whole pill leans toward the cursor). */
export function Btn({
  href,
  children,
  variant = "",
  size = "",
  onClick,
  cursor = "link",
}: {
  href: string;
  children: ReactNode;
  variant?: "" | "vx-btn-signal" | "vx-btn-paper" | "vx-btn-ghost";
  size?: "" | "vx-btn-sm";
  onClick?: () => void;
  cursor?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !window.matchMedia("(pointer: fine)").matches) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const move = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      node.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
    };
    const leave = () => {
      node.style.transform = "";
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
    };
  }, []);
  return (
    <Link
      ref={ref}
      href={href}
      className={`vx-btn ${variant} ${size}`}
      onClick={onClick}
      data-cursor={cursor}
    >
      <span>{children}</span>
      <span className="vx-btn-dot" aria-hidden="true">
        <Arrow />
      </span>
    </Link>
  );
}

/** Counts from 0 to `to` once in view. Renders the final value on the server. */
export function Count({ to, duration = 1400, className = "" }: { to: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        node.textContent = String(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(node);
    return () => io.disconnect();
  }, [to, duration]);
  return (
    <span ref={ref} className={className}>
      {to}
    </span>
  );
}

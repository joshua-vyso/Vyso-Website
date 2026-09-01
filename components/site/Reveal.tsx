"use client";

/* ── Scroll reveal ───────────────────────────────────────────────────────────
   Fade+rise on first approach. Opacity/transform only, one shared observer,
   and `.vy-reveal` collapses to fully-visible under `prefers-reduced-motion`
   in CSS — so content is never hidden from anyone (including crawlers: the
   base state is CSS-only and this component renders children on the server). */

import { useEffect, useRef } from "react";

export function Reveal({
  as: Tag = "div",
  className = "",
  delay = 0,
  children,
}: {
  as?: "div" | "section" | "li" | "article";
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add("is-in");
          observer.disconnect();
        }
      },
      { rootMargin: "-60px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow tag union, single ref
      ref={ref as any}
      className={`vy-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

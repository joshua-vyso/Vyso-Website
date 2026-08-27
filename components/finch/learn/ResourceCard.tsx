"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import type { Resource } from "@/lib/marketing/resources";

/* ── The page-flip card ──────────────────────────────────────────────────────
   `/resources`'s signature visual, and the only place on the site it appears.
   On hover the card tips 6° about its bottom edge, as if the top of a page has
   been lifted, 200ms, ease-out.

   Three details make it read as paper rather than as a tilting rectangle:

   - `transformOrigin: bottom` — a page is hinged at the far edge, not through
     its middle. Rotating about the centre reads as a card flipping, which is
     a different (and, at 6°, slightly seasick) gesture.
   - `transformPerspective: 1000` — without it `rotateX` is an orthographic
     squash and the top edge simply gets shorter.
   - the border deepens to `--vy-line-2` on the same 200ms, so the lifted edge
     has somewhere to lift away from. No shadow: plan §4 keeps every card flat
     except the hero demo and window-chrome mockups.

   Reduced motion → no rotation at all; the border still responds, which is
   the static end state the rest of the site uses for hovers.

   `.ai/plan_vyso_redesign_2026.md` §7.6: repainted from `--fn-*` to `--vy-*`.
   Only this component and `/resources/page.tsx` import it. */

export function ResourceCard({ resource }: { resource: Resource }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.article
      className="h-full [transform-style:preserve-3d]"
      style={{ transformPerspective: 1000, transformOrigin: "bottom center" }}
      whileHover={reduceMotion ? undefined : { rotateX: 6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <Link
        href={`/resources/${resource.slug}`}
        className="group flex h-full flex-col rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[24px] py-[24px] transition-colors duration-200 ease-out hover:border-[color:var(--vy-line-2)]"
      >
        <span className="vy-label mb-[14px] text-[color:var(--vy-ink-3)]">
          {resource.eyebrow.toUpperCase()}
        </span>
        <h3 className="m-0 mb-[10px] text-[21px] font-medium leading-[1.2] tracking-[-0.015em] text-[color:var(--vy-ink)] transition-colors duration-150 group-hover:text-[color:var(--vy-ink-2)]">
          {resource.shortName}
        </h3>
        <p className="vy-small m-0 mb-[20px] text-[color:var(--vy-ink-3)] text-pretty">
          {resource.summary}
        </p>
        <span className="mt-auto flex items-center gap-[7px] text-[13.5px] font-medium text-[color:var(--vy-ink-2)]">
          Preview &amp; request
          <span
            aria-hidden="true"
            className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
          >
            →
          </span>
        </span>
        <span className="vy-label mt-[14px] block border-t border-[color:var(--vy-line-2)] pt-[12px] text-[color:var(--vy-ink-3)]">
          {resource.preview.length} SECTIONS · SENT BY EMAIL
        </span>
      </Link>
    </motion.article>
  );
}

export default ResourceCard;

"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import type { Resource } from "@/lib/marketing/resources";

/* ── The page-flip card ──────────────────────────────────────────────────────
   `/resources`'s signature visual, and the only place on the site it appears.
   On hover the card tips 6° about its bottom edge, as if the top of a page has
   been lifted — 200ms, ease-out, per `.ai/vyso_v2.md` §2.3.

   Three details make it read as paper rather than as a tilting rectangle:

   - `transformOrigin: bottom` — a page is hinged at the far edge, not through
     its middle. Rotating about the centre reads as a card flipping, which is
     a different (and, at 6°, slightly seasick) gesture.
   - `transformPerspective: 1000` — without it `rotateX` is an orthographic
     squash and the top edge simply gets shorter.
   - the shadow deepens on the same 200ms, so the lifted edge has somewhere to
     lift away from.

   Reduced motion → no rotation at all; the border and shadow still respond,
   which is the static end state the rest of the site uses for hovers.        */

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
        className="group flex h-full flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[24px] shadow-[var(--fn-shadow-card)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card-hover)]"
      >
        <span className="mb-[14px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
          {resource.eyebrow.toUpperCase()}
        </span>
        <h3 className="m-0 mb-[10px] font-fn-serif text-[21px] font-medium leading-[1.2] tracking-[-0.015em] transition-colors duration-150 group-hover:text-fn-orange-deep">
          {resource.shortName}
        </h3>
        <p className="m-0 mb-[20px] text-[14px] leading-[1.6] text-fn-ink-3 text-pretty">
          {resource.summary}
        </p>
        <span className="mt-auto flex items-center gap-[7px] text-[13.5px] font-medium text-fn-ink-2">
          Preview &amp; request
          <span
            aria-hidden="true"
            className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
          >
            →
          </span>
        </span>
        <span className="mt-[14px] block border-t border-fn-line-2 pt-[12px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
          {resource.preview.length} SECTIONS · SENT BY EMAIL
        </span>
      </Link>
    </motion.article>
  );
}

export default ResourceCard;

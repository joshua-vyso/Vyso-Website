"use client";

import { Fragment } from "react";
import { motion } from "motion/react";
import { useStaticMotion } from "@/components/finch/motion-preference";
import { STATEMENT_CLASS } from "./statement-class";

/* ── The Statement ───────────────────────────────────────────────────────────
   The one big line a dark band exists to say. STIX 500 at 72/1.0 on desktop,
   52 on mobile, five words at most, one of them optionally italic — the same
   editorial voice the rest of the site uses, at the size a band-sized claim
   needs.

   `SplitReveal` is built in rather than bolted on (§4.4): words rise 10px on a
   30ms stagger over 500ms when the band enters, once. Two things make that safe
   to ship rather than a hydration hazard:

   - **Transform only, never opacity.** An `opacity: 0` initial state serialises
     into the server HTML, so a headline would ship invisible and stay invisible
     for anyone whose JS never runs. Words that start 10px low and never move
     are still a readable headline. (`FindingDeck` refused the same trade for
     the same reason.)
   - **The split is on whitespace, not characters.** Per-letter animation is
     ruled out by §4's "never" list, and a word-level split leaves the text
     selectable and readable to a screen reader as one string.               */

export type StatementProps = {
  children: string;
  /** One word to set in italic — the editorial emphasis the brand uses. */
  italicWord?: string;
  /** Which ground it sits on, so the colour comes from the band not the caller. */
  tone?: "paper" | "blue" | "ink";
  /** Off for a statement that is already visible on load (a hero). */
  reveal?: boolean;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  id?: string;
};

const TONE: Record<NonNullable<StatementProps["tone"]>, string> = {
  paper: "text-fn-ink",
  blue:  "text-fn-blue-text",
  ink:   "text-fn-ink-text",
};

/** 30ms stagger, 500ms ease-out (§4.4). The ease is the site's standard
    `[0.22, 1, 0.36, 1]`, so a Statement entering next to a `FindingDeck`
    straightening reads as one movement. */
const EASE = [0.22, 1, 0.36, 1] as const;

export function SplitReveal({
  text,
  italicWord,
  reveal = true,
  className = "",
}: {
  text: string;
  italicWord?: string;
  reveal?: boolean;
  className?: string;
}) {
  const reduceMotion = useStaticMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const still = reduceMotion || !reveal;

  return (
    <span className={className}>
      {words.map((word, i) => {
        /* Strip trailing punctuation before comparing, so `italicWord="own"`
           still matches `own.` at the end of a line. */
        const bare = word.replace(/[.,;:!?—–]+$/u, "");
        const italic = italicWord !== undefined && bare.toLowerCase() === italicWord.toLowerCase();
        return (
          /* The space sits between the word wrappers, never inside one: inside
             an `inline-block` it stops being a line-break opportunity and a
             five-word Statement refuses to wrap at 375px. */
          <Fragment key={`${word}-${i}`}>
            <span className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em]">
              {/* `initial` is the same on both paths, and `still` only changes
                  the *duration*. Dropping `initial` under reduced motion would
                  leave the server's `translateY(10px)` on the element with
                  nothing left to animate it away — the words would sit 10px low
                  forever. Zero-duration is the static form. */}
              <motion.span
                className={"inline-block " + (italic ? "italic" : "")}
                initial={{ y: 10 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={still ? { duration: 0 } : { duration: 0.5, ease: EASE, delay: i * 0.03 }}
              >
                {word}
              </motion.span>
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </span>
  );
}

/** The Statement's typography, so a heading that carries a `WaveText` instead
    of a `SplitReveal` (§4.1's wave-riding statement) is the same size, weight
    and tracking without restating five utilities.

    Re-exported, not declared: it now lives in `./statement-class`, a module
    with no `"use client"` directive, because a **server** component importing
    it from here would receive a client reference rather than the string. That
    file has the full account. Client components may keep importing it from
    here; server components must not. */
export { STATEMENT_CLASS };

export function Statement({
  children,
  italicWord,
  tone = "ink",
  reveal = true,
  as: Tag = "h2",
  className = "",
  id,
}: StatementProps) {
  return (
    <Tag
      id={id}
      className={[STATEMENT_CLASS, TONE[tone], className].filter(Boolean).join(" ")}
    >
      <SplitReveal text={children} italicWord={italicWord} reveal={reveal} />
    </Tag>
  );
}

export default Statement;

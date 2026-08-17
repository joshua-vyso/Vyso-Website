"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import {
  CHECKLIST_COPY,
  SOLUTIONS,
  SYMPTOMS,
  checklistObservation,
} from "@/lib/marketing/solutions";
import {
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";

/* ── The symptom checklist that writes a finding card ─────────────────────────
   `/solutions`'s signature visual, and the only widget on it. Tick what sounds
   like your week; the card beside the list types the observation back at you,
   counts the ticks as its evidence chip, and offers the pages those symptoms
   point at.

   Three rules it keeps:
   1. **No invented rand.** Ten checkboxes cannot produce a number, so the
      impact line is the generic-but-true one from the data file. Every other
      card on the site that shows a figure is captioned ILLUSTRATIVE EXAMPLE;
      this one shows no figure at all.
   2. **Typing is a DOM write, not React state.** The observation types at
      40ms/char straight onto a text node (see `useTypedText`), so a ten-word
      sentence costs zero re-renders. Screen readers get the finished string
      from a `sr-only` live region instead of a character-by-character crawl.
   3. **Reduced motion → instant.** No typing, no stamp; the same end state
      appears immediately. The server also renders the empty-state card in
      full, so there is no CLS and nothing pops in on hydration.              */

/* ── The typewriter ──────────────────────────────────────────────────────────
   The span's React children are frozen at mount (`initialText`), so React
   never touches the text node again after the first paint and can't fight the
   interval for it. Every later value is written here. Nothing in this effect
   calls setState — the repo's ESLint errors on `react-hooks/set-state-in-effect`,
   and a per-character re-render would be wasted work regardless.             */
function useTypedText(text: string, reduceMotion: boolean) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [initialText] = useState(text);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // First run is the SSR string already in the DOM — leave it alone.
    if (previous.current === null) {
      previous.current = text;
      return;
    }
    previous.current = text;

    if (reduceMotion) {
      el.textContent = text;
      return;
    }

    let i = 0;
    el.textContent = "";
    const id = window.setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) window.clearInterval(id);
    }, 40);

    return () => window.clearInterval(id);
  }, [text, reduceMotion]);

  return { ref, initialText };
}

/* ── One checkbox row ─────────────────────────────────────────────────────────
   A real `<input type="checkbox">`, visually hidden and re-drawn: keyboard,
   focus ring and screen-reader semantics come free, and the box is blue when
   ticked because a ticked symptom is evidence, the same blue the card's
   evidence chip uses.                                                        */
function SymptomRow({
  id,
  label,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <label
      htmlFor={`symptom-${id}`}
      className="group flex cursor-pointer items-start gap-[12px] border-b border-fn-line-2 py-[13px] last:border-b-0"
    >
      <input
        id={`symptom-${id}`}
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(id)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={
          "mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 " +
          "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#C9DEF7] " +
          (checked
            ? "border-fn-blue-deep bg-fn-blue-deep"
            : "border-fn-line-3 bg-fn-surface group-hover:border-fn-line-hover")
        }
      >
        <svg viewBox="0 0 12 12" className="h-[10px] w-[10px]" style={{ opacity: checked ? 1 : 0 }}>
          <path
            d="M2.5 6.2 L4.8 8.5 L9.5 3.6"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        className={
          "text-[14.5px] leading-[1.5] transition-colors duration-150 " +
          (checked ? "text-fn-ink" : "text-fn-ink-3 group-hover:text-fn-ink-2")
        }
      >
        {label}
      </span>
    </label>
  );
}

export function SymptomChecklist() {
  const reduceMotion = useReducedMotion() ?? false;
  const [ticked, setTicked] = useState<readonly string[]>([]);

  const onToggle = useCallback((id: string) => {
    setTicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);

  /* Everything the card shows is derived, in the checklist's own order rather
     than click order — the card should read the same whichever way round you
     tick two symptoms. */
  const { observation, matches } = useMemo(() => {
    const chosen = SYMPTOMS.filter((s) => ticked.includes(s.id));

    // Rank the solutions by how many ticked symptoms point at them; ties keep
    // the data file's order, which puts the most relevant page first.
    const score = new Map<string, number>();
    for (const symptom of chosen) {
      symptom.solutions.forEach((slug, i) => {
        score.set(slug, (score.get(slug) ?? 0) + (i === 0 ? 2 : 1));
      });
    }
    const ranked = [...score.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([slug]) => SOLUTIONS[slug]);

    return {
      observation: checklistObservation(chosen.map((s) => s.finding)),
      matches: ranked,
    };
  }, [ticked]);

  const count = ticked.length;
  const { ref, initialText } = useTypedText(observation, reduceMotion);

  const stamp = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, scale: 1.12 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };

  return (
    <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[1fr_460px] lg:items-start lg:gap-[56px]">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-[14px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
          TICK WHAT SOUNDS LIKE YOUR WEEK
        </legend>
        <div className="rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[6px]">
          {SYMPTOMS.map((symptom) => (
            <SymptomRow
              key={symptom.id}
              id={symptom.id}
              label={symptom.label}
              checked={ticked.includes(symptom.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      </fieldset>

      <div className="lg:sticky lg:top-[110px]">
        <FindingCardFrame state={count > 0 ? "new" : "in-progress"} className="max-w-[460px]">
          <FindingHeader agent={CHECKLIST_COPY.agent} state={count > 0 ? "new" : "in-progress"} />

          <FindingObservation>
            {/* The typed node. `aria-hidden` because a live region that fires
                once per character is unusable; the real announcement is the
                `sr-only` sibling below, which updates once per tick. */}
            <span ref={ref} aria-hidden="true">
              {initialText}
            </span>
            <span className="sr-only" role="status">
              {observation}
            </span>
          </FindingObservation>

          {count > 0 ? (
            <motion.div key="impact" {...stamp}>
              <FindingImpact>{CHECKLIST_COPY.impact}</FindingImpact>
            </motion.div>
          ) : (
            /* Reserve the impact line's height so the card doesn't jump the
               first time something is ticked. */
            <div aria-hidden="true" className="mb-[12px] h-[30px]" />
          )}

          <FindingEvidence
            evidence={`${count} symptom${count === 1 ? "" : "s"} ticked`}
            meta={matches.length > 0 ? matches.map((s) => s.shortName).join(" · ").toUpperCase() : undefined}
          />

          {/* Real links, so the card's actions are the actions. `FindingActions`
              renders labels; these rows copy its classes exactly.

              Two rows rather than one wrapping row: at 460px the matched pages
              plus the CTA never fit on a line, and a wrap put a separator "·"
              at the start of the second line. The CTA is the primary action
              anyway, so it earns its own row. */}
          <div className="border-t border-fn-line-2 pt-[13px]">
            {matches.length > 0 ? (
              <div className="mb-[8px] flex flex-wrap items-center gap-x-[6px] gap-y-[4px] max-[399px]:gap-x-[14px]">
                {matches.map((solution, i) => (
                  <span key={solution.slug} className="inline-flex items-center gap-[6px]">
                    {i > 0 ? (
                      <span className="text-[12px] text-fn-line-3 max-[399px]:hidden">·</span>
                    ) : null}
                    <Link
                      href={`/solutions/${solution.slug}`}
                      className="rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium text-fn-ink-2 transition-all duration-[120ms] hover:bg-[#F5F2EA] hover:text-fn-ink"
                    >
                      {solution.shortName}
                    </Link>
                  </span>
                ))}
              </div>
            ) : null}
            <Link
              href="/operations-audit"
              className="group inline-flex items-center gap-[6px] rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium text-fn-orange-deep transition-all duration-[120ms] hover:bg-[#F5F2EA]"
            >
              {CHECKLIST_COPY.emptyActions}
              <span
                aria-hidden="true"
                className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
              >
                →
              </span>
            </Link>
          </div>
        </FindingCardFrame>

        <div className="mt-[12px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
          NO FIGURE IS ESTIMATED FROM A CHECKLIST
        </div>
      </div>
    </div>
  );
}

export default SymptomChecklist;

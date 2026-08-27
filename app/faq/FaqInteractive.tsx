"use client";

import { useEffect, useRef } from "react";

import { track } from "@/lib/analytics";

/* ── Progressive-enhancement filter ───────────────────────────────────────
   The server renders every group and question in full — the page is a
   complete, working FAQ with JavaScript off. This wrapper hydrates around
   that static markup and, on input, walks the DOM directly (no React state,
   no re-render of ~25 accordion items) to hide non-matching questions and
   collapse groups that end up with nothing showing. `data-faq-item` /
   `data-faq-text` / `data-faq-group` are the only contract with the server
   markup below.

   Restyled to `--vy-*` for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md`
   §7.6) — the DOM contract and every `track()` call are unchanged, so this is
   a class-name swap, not a rewrite of the logic. */
export function FaqFilter({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* `faq_open {id}` — one delegated listener rather than one per `<details>`,
     matching the DOM-first approach the rest of this file already takes. The
     `toggle` event does not bubble in every browser still in the field, so
     this listens on the CAPTURE phase: capture fires on the way down from the
     root to the target regardless of whether the event itself bubbles back
     up, which is what makes delegation work here. Only opens are tracked
     (`details.open` is already `true` by the time `toggle` fires), never
     closes. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onToggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement) || !details.open) return;
      if (!details.id) return;
      track("faq_open", { id: details.id });
    };
    root.addEventListener("toggle", onToggle, true);
    return () => root.removeEventListener("toggle", onToggle, true);
  }, []);

  function handleChange(value: string) {
    const root = rootRef.current;
    if (!root) return;
    const query = value.trim().toLowerCase();

    const groupHasMatch = new Map<string, boolean>();
    const items = root.querySelectorAll<HTMLElement>("[data-faq-item]");
    items.forEach((item) => {
      const haystack = item.dataset.faqText ?? "";
      const matches = query === "" || haystack.includes(query);
      item.style.display = matches ? "" : "none";
      const groupId = item.dataset.faqGroup ?? "";
      groupHasMatch.set(groupId, (groupHasMatch.get(groupId) ?? false) || matches);
    });

    const groups = root.querySelectorAll<HTMLElement>("[data-faq-group-section]");
    groups.forEach((group) => {
      const id = group.dataset.faqGroupSection ?? "";
      group.style.display = groupHasMatch.get(id) === false ? "none" : "";
    });
  }

  return (
    <div>
      <label htmlFor="faq-search" className="mb-[24px] block lg:mb-[32px]">
        <span className="sr-only">Search the FAQ</span>
        <span className="relative block max-w-[420px]">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="pointer-events-none absolute left-[14px] top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[color:var(--vy-ink-4)]"
          >
            <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11 L14.5 14.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            id="faq-search"
            type="search"
            placeholder="Search the FAQ"
            onChange={(event) => handleChange(event.currentTarget.value)}
            className="w-full rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] py-[11px] pl-[38px] pr-[14px] text-[14.5px] text-[color:var(--vy-ink)] placeholder:text-[color:var(--vy-ink-4)] outline-none transition-colors duration-150 focus:border-[color:var(--vy-ink-3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vy-focus)]"
          />
        </span>
      </label>
      <div ref={rootRef}>{children}</div>
    </div>
  );
}

/* ── Deep-link open + flash ───────────────────────────────────────────────
   `/faq#some-question-id` should land on an already-open `<details>` (native
   behaviour: a fragment matching an element id scrolls to it, but does not
   open a closed `<details>`) and flash to mark which one. Pure DOM writes —
   no state, so nothing here trips the `react-hooks/set-state-in-effect`
   rule. Runs once per mount; the FAQ page never changes its hash client-side
   after load, so no hashchange listener is needed. */
export function FaqDeepLinkHandler() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    if (target instanceof HTMLDetailsElement) {
      target.open = true;
    }

    const flashEl = target instanceof HTMLDetailsElement ? target : (target.closest("details") ?? target);
    flashEl.style.transition = "none";
    flashEl.style.backgroundColor = "var(--vy-surface-2)";

    const raf = requestAnimationFrame(() => {
      flashEl.style.transition = "background-color 600ms ease-out";
      flashEl.style.backgroundColor = "transparent";
    });
    const cleanupTimer = window.setTimeout(() => {
      flashEl.style.transition = "";
      flashEl.style.backgroundColor = "";
    }, 650);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cleanupTimer);
    };
  }, []);

  return null;
}

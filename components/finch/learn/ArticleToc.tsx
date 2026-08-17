"use client";

import { useEffect, useState } from "react";

/* ── The article table of contents ───────────────────────────────────────────
   Sticky from `lg` up, a plain list below it. The current-heading highlight is
   the only reason this is a client component.

   The observer watches a band across the top third of the viewport
   (`rootMargin` bottom −68%) rather than the whole screen: with a 720px
   reading column, two or three headings are usually on screen at once, and
   "the topmost heading that has reached the reading position" is the one a
   reader would call current. Ties are broken by document position, so a fast
   scroll that reveals several at once still lands on the right one.

   No `setState` runs in the effect body — only inside the observer callback —
   because the repo's ESLint errors on `react-hooks/set-state-in-effect`. The
   first item is the initial state instead, which is also what is correct
   before any scrolling has happened.                                          */

export type TocItem = { id: string; label: string };

export function ArticleToc({ items }: { items: readonly TocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  /* Depend on a string, not the array: the parent is a server component and
     re-serialises `items` on every render, which would tear the observer down
     and rebuild it each time if the array itself were the dependency. */
  const idKey = items.map((item) => item.id).join("|");

  useEffect(() => {
    const ids = idKey.split("|").filter(Boolean);
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -68% 0px", threshold: 0 },
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [idKey]);

  return (
    <nav aria-label="On this page" className="lg:sticky lg:top-[32px]">
      <div className="mb-[12px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted">
        ON THIS PAGE
      </div>
      <ol className="m-0 flex list-none flex-col gap-[2px] border-l border-fn-line p-0">
        {items.map((item) => {
          const current = item.id === activeId;
          return (
            <li key={item.id} className="relative">
              {/* The active marker is a 1px rule sitting on the list's own
                  hairline — the same structural language the rest of the page
                  uses, rather than a coloured pill. */}
              <span
                aria-hidden="true"
                className={`absolute left-[-1px] top-[6px] bottom-[6px] w-px transition-colors duration-150 ${
                  current ? "bg-fn-ink" : "bg-transparent"
                }`}
              />
              <a
                href={`#${item.id}`}
                aria-current={current ? "true" : undefined}
                className={`block py-[6px] pl-[14px] pr-[8px] text-[13.5px] leading-[1.45] transition-colors duration-150 hover:text-fn-orange-deep ${
                  current ? "font-medium text-fn-ink" : "text-fn-ink-3"
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ArticleToc;

/* Visually hidden until focused: the first tab stop on every marketing page,
   letting keyboard/screen-reader users jump straight past the nav to
   `#main`. Mounted once in `app/layout.tsx`, above `.finch-site`, so it works
   the same way on every route. Pure CSS (`sr-only` + `focus:` overrides) —
   no client JS needed for a same-page anchor. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-[100] rounded-[8px] bg-fn-ink px-[16px] py-[10px] font-fn-sans text-[14px] font-semibold text-white focus:not-sr-only focus:fixed focus:left-[16px] focus:top-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fn-orange-cta"
    >
      Skip to content
    </a>
  );
}

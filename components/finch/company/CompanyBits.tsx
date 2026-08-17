import Link from "next/link";

/* ── Shared small bits for the company cluster ───────────────────────────────
   `/founding-client`, `/case-studies`, `/case-studies/turn-n-slice` and
   `/south-africa` all open the same way: a mono breadcrumb trail (the UI twin
   of each page's `BreadcrumbList` JSON-LD) and a mono eyebrow above the
   `<h1>`. Same shape as `components/finch/compare/CompareBits.tsx`'s
   `Breadcrumb`/`Eyebrow` — kept as this workstream's own copy rather than a
   cross-tree import, per the plan's "shared small bits allowed within this
   workstream only" rule. Both server components; nothing here needs JS. */

export type Crumb = { label: string; href: string };

export function Breadcrumb({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-[18px]">
      <ol className="m-0 flex list-none flex-wrap items-center gap-[7px] p-0 font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-muted">
        {trail.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center gap-[7px]">
            {i > 0 ? <span className="text-fn-line-3">/</span> : null}
            {i === trail.length - 1 ? (
              <span aria-current="page" className="text-fn-ink-3">
                {crumb.label.toUpperCase()}
              </span>
            ) : (
              <Link href={crumb.href} className="transition-colors duration-150 hover:text-fn-orange-deep">
                {crumb.label.toUpperCase()}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
      {children}
    </p>
  );
}

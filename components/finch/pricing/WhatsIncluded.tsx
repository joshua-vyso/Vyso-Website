import Link from "next/link";
import { RAIL } from "../ground/Band";
import { INCLUDED_GROUPS, type IncludedItem } from "./pricing-data";

/* Native `<details>`/`<summary>`: the accordion works with JavaScript off, the
   browser gives us the expanded/collapsed semantics for free, and the only
   moving part — the chevron — is a CSS transform driven by the `open`
   attribute. No client component, no state, no hydration cost. */

function Chevron() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="ml-[16px] h-[11px] w-[11px] shrink-0 text-fn-muted transition-transform duration-150 ease-out group-open:rotate-90"
    >
      <path
        d="M4 2.5 L8 6 L4 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Item({ item }: { item: IncludedItem }) {
  return (
    <li className="relative pl-[16px] text-[14.5px] leading-[1.55] text-fn-ink-2">
      <span className="absolute left-0 top-[8px] h-[5px] w-[5px] rounded-full bg-fn-faint" />
      <span className="font-medium">{item.label}</span>
      {item.chip ? (
        <span className="ml-[8px] inline-block translate-y-[-1px] rounded-[4px] border border-fn-line px-[5px] py-[1px] align-middle font-fn-mono text-[9px] tracking-[0.1em] text-fn-muted">
          {item.chip}
        </span>
      ) : null}{" "}
      — {item.note}
    </li>
  );
}

/* ── The custom row ──────────────────────────────────────────────────────────
   Round 3 (Josh: "have a custom bullet point — custom modules, custom agents,
   custom integrations"): one final row per honest group, deliberately not
   just another `Item`. The orange 6px dot is the agent-activity colour used
   everywhere else on the site something is live or in motion (`AgentsOnShift`,
   `BriefPhone`, `DayCard`) — here it marks "this is built for you", not "this
   is on the shelf". The `CUSTOM` chip gets the orange-tinted border/text
   instead of the grey `Item` chip for the same reason: a catalogue entry and a
   bespoke-scope promise should not look like the same kind of fact. A dashed
   top rule and full-width span (`md:col-span-2`) separate it from the two-
   column list above rather than letting it read as one more grid cell. */
function CustomRow({ item }: { item: IncludedItem }) {
  return (
    <li className="relative border-t border-dashed border-fn-line pl-[16px] pt-[14px] text-[14.5px] leading-[1.55] text-fn-ink-2 md:col-span-2">
      <span className="absolute left-0 top-[22px] h-[6px] w-[6px] rounded-full bg-fn-orange" />
      <span className="font-medium">{item.label}</span>
      {item.chip ? (
        <span className="ml-[8px] inline-block translate-y-[-1px] rounded-[4px] border border-fn-orange-tint px-[5px] py-[1px] align-middle font-fn-mono text-[9px] tracking-[0.12em] text-fn-orange-deep">
          {item.chip}
        </span>
      ) : null}{" "}
      — {item.note}
    </li>
  );
}

/* The 1160 rail, with the accordion's own 860 reading measure **inside** it and
   left-aligned, so this section's left edge is the same left edge as the ink
   hero's, the blue band's and the Academy card's. Before the fix it centred an
   860 column of its own, which put its content 150px to the right of the blue
   band below it — the "nothing lines up" half of Josh's review.

   The bottom padding is new and is what stops the "Full FAQ →" link reading as
   an orphan: it used to be the last thing before a hard cut to a blue band, so
   it looked like it belonged to the band rather than to the accordion. */
export function WhatsIncluded() {
  return (
    <section
      id="whats-included"
      className={`${RAIL} pt-[64px] pb-[64px] lg:pt-[96px] lg:pb-[96px]`}
    >
      <div className="max-w-[860px]">
        <h2 className="m-0 mb-[8px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
          What&rsquo;s included
        </h2>
        <p className="m-0 mb-[24px] text-[15.5px] text-fn-ink-3 lg:mb-[32px]">
          One price. Here is exactly what it buys.
        </p>

        <div className="border-t border-fn-line">
          {INCLUDED_GROUPS.map((group, index) => (
            <details
              key={group.id}
              /* The first group opens on load so the section never reads as an
               empty list of closed rows. */
              open={index === 0}
              className="group border-b border-fn-line"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between py-[22px] font-fn-serif text-[18px] font-medium text-fn-ink transition-colors duration-150 hover:text-fn-orange-deep [&::-webkit-details-marker]:hidden">
                {group.title}
                {/* 6b: the row's count fades in on hover — 150ms, mono, right of
                  the title and left of the chevron. Opacity only, and the span
                  is always in the layout, so the row never reflows and the
                  chevron never shifts. It is also always in the DOM for a
                  screen reader, which is the right answer: "10 modules" is
                  information, and hiding information behind a pointer state is
                  only acceptable because it is *also* the length of the list
                  directly below it. */}
                <span className="ml-auto flex items-center">
                  <span className="font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100">
                    {group.items.length} {group.countNoun}
                  </span>
                  <Chevron />
                </span>
              </summary>

              <ul className="m-0 grid list-none grid-cols-1 gap-x-[36px] gap-y-[10px] p-0 pb-[24px] md:grid-cols-2">
                {group.items.map((item) => (
                  <Item key={item.label} item={item} />
                ))}
                {group.customRow ? <CustomRow item={group.customRow} /> : null}
              </ul>

              {group.footnote ? (
                <p className="m-0 pb-[24px] text-[13.5px] leading-[1.55] text-fn-muted">
                  {group.footnote}
                </p>
              ) : null}
            </details>
          ))}
        </div>

        {/* Under the accordion, left-aligned, 24px below it — where a "more of
          this list" link belongs. */}
        <Link
          href="/faq"
          className="mt-[24px] inline-block text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
        >
          Full FAQ →
        </Link>
      </div>
    </section>
  );
}

export default WhatsIncluded;

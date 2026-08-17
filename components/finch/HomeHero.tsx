import { CyclingFinding } from "./CyclingFinding";
import { Glow } from "./ground/Glow";
import { SeamHairline } from "./ground/SeamHairline";
import { CursorDrift } from "./text/CursorDrift";
import { MagneticButton } from "./text/MagneticButton";
import { SplitReveal } from "./text/Statement";
import { HOME_HERO_CYCLE } from "@/lib/marketing/findings";

/* ── The hero ────────────────────────────────────────────────────────────────
   Paper ground, and §1.1's rule holds: **one device**. A soft orange glow
   drifting behind the left column at 18%, and nothing else in the background —
   no grid, no facets, no wave. That is the entire motion budget Linear, Vercel
   and Attio spend on a hero, and this hero already carries a card that changes
   by itself, which is the second of §3's two moving things.

   What is new in 6b, in the order a reader meets it:

   - **The card cycles** (`CyclingFinding`, `HOME_HERO_CYCLE`). The old static
     `<FindingCard />` was the butternut card, and the butternut card was on
     every hero on the site — which quietly said "this is the finding Finch
     produces". Three cards in three agents' voices say the true thing: the
     roster is set per business, in the audit.
   - **The headline splits and rises** (`SplitReveal`, 10px, 30ms stagger). It
     is in view on load, so it plays once as the page settles.
   - **The two planes drift against the pointer** (`CursorDrift`, 3px): the card
     toward it, the glow away from it, so the gap between them opens as the
     mouse crosses the hero. §4.5, and the reason the glow is inside a drift
     wrapper rather than sitting loose in the background.
   - **The CTA is magnetic** (`MagneticButton`, ≤ 10px within 120px).

   Still a server component. Every client piece above is a leaf, so the
   headline, the paragraph and the mono line are plain HTML in the response.

   The finding card only appears from `lg` up — on phones it is the payoff of
   the mobile storyboard further down (Mobile.dc.html), not hero furniture.    */
export function HomeHero() {
  return (
    /* `isolate`: the glow sits at `-z-10`, and without a stacking context here
       a negative z-index escapes the header entirely and paints *behind*
       `.finch-site`'s own background — i.e. invisibly. */
    <header className="relative isolate mx-auto grid max-w-[1160px] grid-cols-1 items-center gap-[64px] px-[20px] pt-[44px] pb-[40px] lg:grid-cols-[1.05fr_0.95fr] lg:px-[40px] lg:pt-[72px] lg:pb-[110px]">
      {/* The glow is positioned against the *hero*, not the copy column, and
          sits at `-z-10` so it never paints over the headline. Left third and
          slightly high — behind the first two lines of the H1, where §3.4 wants
          a light source rather than a shape. */}
      <CursorDrift
        direction={-1}
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <Glow tone="orange" size={320} className="left-[14%] top-[34%] h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2" />
      </CursorDrift>

      <div>
        {/* The rule above the headline was already an orange→blue gradient bar;
            6b makes it *draw* on enter (§4.4), which is the page's one
            hairline. Same graphic, same 52px, 500ms of scaleX. */}
        <SeamHairline className="mb-[22px] w-[44px] lg:mb-[28px] lg:w-[52px]" />
        <h1 className="mb-[18px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[24px] lg:text-[62px] lg:leading-[1.06] lg:tracking-[-0.025em]">
          <SplitReveal text="Meet Finch. Your company’s own COO — at a tenth of the cost." />
        </h1>
        <p className="mb-[24px] max-w-[520px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:mb-[32px] lg:text-[17px]">
          Your business runs on WhatsApp, spreadsheets and gut feel. Finch&rsquo;s AI agents watch your
          invoices, stock, suppliers and margins — catch money leaking, and tell you what to do about
          it. Built by Vyso for South African food businesses. R6,000 per location, everything
          included.
        </p>
        <div className="lg:flex lg:items-center lg:gap-[18px]">
          <MagneticButton
            href="/operations-audit"
            event="book_audit_click"
            eventProps={{ page: "home" }}
            className="w-full text-[16px] lg:w-auto lg:text-[15.5px]"
          >
            Book your audit
          </MagneticButton>
          <span className="mt-[12px] block text-center font-fn-mono text-[10.5px] tracking-[0.06em] text-fn-muted lg:mt-0 lg:inline lg:text-left lg:text-[11.5px]">
            ONE-WEEK OPERATIONS AUDIT · R2,000
          </span>
        </div>
      </div>

      <div className="hidden lg:block">
        <CursorDrift>
          <CyclingFinding ids={HOME_HERO_CYCLE} />
        </CursorDrift>
        <div className="mt-[12px] text-right font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
          ILLUSTRATIVE EXAMPLE
        </div>
      </div>
    </header>
  );
}

export default HomeHero;

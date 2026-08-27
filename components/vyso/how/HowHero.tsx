import { Button } from "@/components/vyso/Button";

/* ── /how-it-works, the hero ─────────────────────────────────────────────────
   Plan §7.2. The page a reader lands on when the homepage worked and they now
   want the mechanism, so the hero owes them the answer in prose rather than a
   second demo: the picture is on the homepage, and the timeline further down
   this page runs a DIFFERENT morning (`HowProactive`).

   The lead is the page's AEO direct answer (plan §8): two sentences that stand
   on their own if an answer engine lifts them out of the document, and that say
   what the company is before they say what it does.

   Written as a hand-rolled section for the same reason `HomeHero` is: the
   headline sits in its own measure with the CTAs under it, and `Section` would
   stack a header above children that do not exist here. It repeats `Section`'s
   rhythm constants rather than inventing new ones, and carries no divider,
   because a rule with nothing above it is a rule drawn under the nav. */

const EYEBROW = "How it works";

const LEAD =
  "Vyso is an AI operations company. We build tailored operational systems for South " +
  "African businesses: software that handles the repetitive work automatically, connects " +
  "the information already moving through your business, and tells you when something " +
  "needs your attention.";

const SECOND =
  "This page is the whole mechanism, in order: what we are, what we are not, how the " +
  "automation works, how it knows when to speak up, how it sits alongside the systems you " +
  "already run, and how a project is scoped and priced.";

export function HowHero() {
  return (
    <section className="px-[var(--vy-gutter)] pt-[44px] pb-[64px] md:px-[40px] md:pt-[72px] md:pb-[96px]">
      <div className="mx-auto w-full max-w-[var(--vy-content)]">
        <p className="vy-label mb-[20px] text-[color:var(--vy-ink-3)]">{EYEBROW}</p>

        {/* The page's single h1, in the system's two-tier construction. */}
        <h1 className="vy-h1 max-w-[880px] text-[color:var(--vy-ink)]">
          We automate the work.{" "}
          <span className="text-[color:var(--vy-ink-3)]">Then we watch what happens next.</span>
        </h1>

        <div className="mt-[26px] grid grid-cols-1 gap-[20px] lg:grid-cols-2 lg:gap-[48px]">
          <p className="vy-body-lg text-[color:var(--vy-ink-3)]">{LEAD}</p>
          <p className="vy-body text-[color:var(--vy-ink-3)] lg:pt-[6px]">{SECOND}</p>
        </div>

        <div className="mt-[34px] flex flex-col items-start gap-[12px] sm:flex-row sm:items-center sm:gap-[26px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "how-it-works-hero" }}
          >
            Get your free operations audit
          </Button>
          <Button href="#pricing" variant="quiet" size="lg">
            How projects are priced
          </Button>
        </div>
      </div>
    </section>
  );
}

export default HowHero;

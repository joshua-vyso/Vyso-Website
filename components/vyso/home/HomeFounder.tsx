import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";

/* ── The founder ─────────────────────────────────────────────────────────────
   Plan §7.1.8 and brief §19. The one warm section on the page, said once, in a
   narrow measure and in plain prose. Warmth is the brand here, NOT the
   technical differentiation (plan §2), which is why this section carries no
   demo, no card grid and no number: everything around it argues, and this one
   just says why the company exists.

   ── The "365 hours" line is cut ─────────────────────────────────────────────
   Plan §14.4 left the decision to whoever built the section. The brief's own
   note answers it: "focus on the meaning of the time, not the maths." An hour a
   day multiplied out to 365 turns a sentence about someone's father into a
   savings calculation, and it is the one line in this section that would read
   as a pitch. The meaning stays; the arithmetic goes.

   No photograph. There is no photograph of Josh in the repo, an invented one
   would be an invented person, and a stock face under a story about someone's
   father is worse than no face at all. */

const STORY: readonly string[] = [
  "Vyso began inside a wholesale business. Its founder grew up in his father's: early mornings, endless WhatsApp messages, spreadsheets, invoices, stock problems, supplier prices, and a day that was never finished until the admin was.",
  "Most of what mattered existed somewhere. It was just scattered, and the decisions that shaped the week got made because somebody happened to remember something at the right moment.",
  "The question that started this company was a small one: could technology give some of that time back? Not to a corporate. To an owner. It is still the question we build against, for the parents, founders, partners and operators who carry a business on their own memory.",
];

export function HomeFounder() {
  return (
    <Section
      id="founder"
      eyebrow="Why Vyso exists"
      heading="Your business should give you a life."
      continuation="Not consume one."
      width="narrow"
      divider
    >
      <Reveal>
        <div className="flex flex-col gap-[20px]">
          {STORY.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="vy-body-lg text-[color:var(--vy-ink-2)] text-pretty">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-[32px] flex flex-wrap items-center gap-x-[24px] gap-y-[12px] border-t border-[color:var(--vy-line)] pt-[24px]">
          <span className="vy-label text-[color:var(--vy-ink-3)]">
            Josh Moreira, founder, Johannesburg
          </span>
          <Button href="/about" variant="quiet" className="ml-auto">
            More about Vyso
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}

export default HomeFounder;

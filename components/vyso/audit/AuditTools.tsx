import Link from "next/link";

import { Card } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";
import { CALCULATOR_PATH, SCORE_PATH } from "@/components/vyso/audit/audit-content";

/* ── The two tools ───────────────────────────────────────────────────────────
   Plan §7.3: this page links to `/operations-audit/score` and
   `/operations-audit/calculator`, and the two of them stay live. Their own
   pages are UNTOUCHED by this phase (they still render the Finch shell; Phase 5
   restyles them), so this section is a doorway rather than an embed.

   Both descriptions are honest about the same thing the tools themselves say on
   screen: neither one is the audit. A self-scored questionnaire and an estimate
   built from numbers you typed are both useful and neither is a diagnosis, and
   a page that implied otherwise would be selling the free thing short.

   The whole card is the link, so `Card` gets `interactive` and the anchor is
   what takes focus (the component does not make the card focusable itself). */

const TOOLS: readonly { href: string; label: string; title: string; body: string }[] = [
  {
    href: SCORE_PATH,
    label: "One minute",
    title: "Score your operation yourself",
    body: "Ten questions about how the work moves today, scored out of a hundred, with the one thing worth looking at first. Nothing is sent anywhere and nobody sees the answer but you.",
  },
  {
    href: CALCULATOR_PATH,
    label: "Your own numbers",
    title: "Estimate what manual work costs you",
    body: "Put in your hours, your headcount and what gets wasted, and see what the manual reporting and procurement side of the month is plausibly costing. An estimate from your figures, not a quote.",
  },
];

export function AuditTools() {
  return (
    <Section
      id="before-you-book"
      eyebrow="Before you book"
      heading="Two ways to look at your own operation first."
      lead="Neither of these is the audit, and neither asks for your email address. They are here because a reader who wants a number before a conversation should be able to get one."
      divider
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-2 md:gap-[24px]">
        {TOOLS.map((tool, i) => (
          <Reveal key={tool.href} as="li" delay={stagger(i)}>
            {/* `relative` so the heading link's `after:inset-0` overlay covers
                the whole card: one anchor, one focus stop, the entire card as
                its hit area. */}
            <Card padding="lg" interactive className="relative h-full">
              <span className="vy-label block text-[color:var(--vy-ink-4)]">{tool.label}</span>
              <h3 className="vy-h3 mt-[14px] text-[color:var(--vy-ink)]">
                <Link
                  href={tool.href}
                  className="after:absolute after:inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vy-focus)]"
                >
                  {tool.title}
                </Link>
              </h3>
              <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
                {tool.body}
              </p>
              <span
                aria-hidden="true"
                className="vy-small mt-[16px] inline-block font-medium text-[color:var(--vy-ink-2)]"
              >
                Open it →
              </span>
            </Card>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

export default AuditTools;

import Image from "next/image";

import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";

/* ── The tools ───────────────────────────────────────────────────────────────
   Plan §7.1.5. One quiet grid, once on the page, and then the honest sentence
   underneath it — because a wall of logos is the single easiest place on a
   marketing site to imply something that is not true.

   ── What is claimed here, and what is checked ───────────────────────────────
   Copy rule §3.6 forbids a false integration claim, so the two statements below
   are grounded in `lib/marketing/integrations.ts`, which grounded itself in the
   running product:

     - Xero            a real OAuth connection, connected during onboarding
     - WhatsApp Business  a real signed webhook, connected during onboarding
     - everything else roadmap or import-only

   So the page says exactly that: two connect directly today, the rest are
   designed around, tool by tool. The logos are marks of tools a South African
   SME actually runs, not a claim that each one is wired up. The grid carries
   each tool's NAME as real text under its mark for the same reason a demo is
   DOM text rather than a canvas: the claim has to be readable by something
   that cannot see.

   The eleven marks in `public/finch/integrations/` include `claude`, `gpt` and
   `n8n`, which are Vyso's own build stack rather than the customer's tools, and
   `notion`, which is Vyso's internal system of record. They are left out: this
   grid answers "will it work with what I run", and answering it with our own
   toolchain would be answering a different question. */

const TOOLS: readonly { slug: string; name: string }[] = [
  { slug: "whatsapp", name: "WhatsApp" },
  { slug: "xero", name: "Xero" },
  { slug: "sage", name: "Sage" },
  { slug: "quickbooks", name: "QuickBooks" },
  { slug: "gmail", name: "Gmail" },
  { slug: "outlook", name: "Outlook" },
  { slug: "loyverse", name: "Loyverse" },
  { slug: "yoco", name: "Yoco" },
  { slug: "simplepay", name: "SimplePay" },
];

const HONESTY =
  "Xero and WhatsApp Business connect directly today. Everything else we design systems around, " +
  "tool by tool: spreadsheets, email attachments, PDFs, supplier portals, POS systems and " +
  "internal databases are all normal inputs.";

export function HomeTools() {
  return (
    <Section
      id="tools"
      eyebrow="Your tools"
      heading="Keep the tools your team already understands."
      lead="Vyso connects the systems around your business instead of forcing your business around another piece of software."
      divider
    >
      <Reveal>
        <ul className="m-0 grid list-none grid-cols-3 gap-px overflow-hidden rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-line)] p-0 md:grid-cols-9">
          {TOOLS.map((tool) => (
            <li
              key={tool.slug}
              className="flex flex-col items-center justify-center gap-[10px] bg-[color:var(--vy-surface)] px-[8px] py-[22px]"
            >
              <Image
                src={`/finch/integrations/${tool.slug}.svg`}
                alt=""
                width={26}
                height={26}
                /* Greyscale, not faded: the marks are furniture on this page,
                   and a second dimming step takes the lighter logos (Sage)
                   below the point where they read at all. */
                className="h-[26px] w-[26px] object-contain grayscale"
              />
              <span className="vy-label text-[10px] text-[color:var(--vy-ink-3)]">{tool.name}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-[28px] flex flex-col items-start gap-[18px] md:flex-row md:items-end md:justify-between md:gap-[48px]">
        <p className="vy-body max-w-[620px] text-[color:var(--vy-ink-3)] text-pretty">{HONESTY}</p>
        <Button href="/integrations" variant="quiet" className="shrink-0">
          See what connects today
        </Button>
      </div>
    </Section>
  );
}

export default HomeTools;

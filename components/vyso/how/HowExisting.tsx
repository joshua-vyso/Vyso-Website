import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { stagger } from "@/components/vyso/stagger";

/* ── Working with what you already run ───────────────────────────────────────
   Plan §7.2, and the plan's honesty rule (§3.6) is the whole design of this
   section: no false integration claims, and "we design systems around tools
   like…" for anything that is not a real connection.

   Two groups, and the split is grounded in `lib/marketing/integrations.ts`,
   which was checked against the running product rather than against the
   marketing roster: Xero and WhatsApp Business are real OAuth and webhook
   connections today. Everything else on that page is designed around, which is
   a different and smaller claim, and this section makes it in those words.

   The three columns are not a feature grid. They answer the only three
   questions an owner has here: does it read the thing I use, does it write back
   into the thing I use, and do I have to change anything. */

const GROUPS: readonly { label: string; heading: string; body: string; items: string }[] = [
  {
    label: "Connected today",
    heading: "Two real connections",
    body: "Xero and WhatsApp Business connect directly. Those are live connections in the product, set up during onboarding, not a plan to build one.",
    items: "XERO · WHATSAPP BUSINESS",
  },
  {
    label: "Designed around",
    heading: "Everything else your team opens",
    body: "For the rest we design the system around the tool: reading the file it exports, the email it sends, the sheet your team keeps, the PDF a supplier attaches. It works, and it is honest about how.",
    items: "EXCEL · GOOGLE SHEETS · GMAIL · OUTLOOK · SAGE · QUICKBOOKS · POS · SUPPLIER PORTALS",
  },
  {
    label: "What you change",
    heading: "As little as possible",
    body: "If your buyer places orders on WhatsApp at half past five in the morning, the system meets him there. A tool nobody adopts saves nobody anything, and the fastest way to build one is to make the team learn a new place to type.",
    items: "NO NEW HABITS TO TEACH",
  },
];

export function HowExisting() {
  return (
    <Section
      id="existing-systems"
      eyebrow="Your existing systems"
      heading="Keep the tools your team already understands."
      lead="Vyso connects the systems around your business instead of forcing your business around another piece of software. Some of those connections are direct. For the rest we build around the tool, and we say which is which."
      divider
    >
      <ul className="m-0 grid list-none grid-cols-1 gap-[32px] p-0 md:grid-cols-3 md:gap-[36px]">
        {GROUPS.map((group, i) => (
          <Reveal key={group.label} as="li" delay={stagger(i)}>
            <div className="border-t border-[color:var(--vy-line-2)] pt-[18px]">
              <span className="vy-label block text-[color:var(--vy-ink-3)]">{group.label}</span>
              <h3 className="vy-h3 mt-[14px] text-[color:var(--vy-ink)]">{group.heading}</h3>
              <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
                {group.body}
              </p>
              <p className="vy-label mt-[16px] text-[10.5px] leading-[1.7] text-[color:var(--vy-ink-3)]">
                {group.items}
              </p>
            </div>
          </Reveal>
        ))}
      </ul>

      <div className="mt-[36px] border-t border-[color:var(--vy-line)] pt-[28px]">
        <Button href="/integrations" variant="quiet">
          See what connects, and how
        </Button>
      </div>
    </Section>
  );
}

export default HowExisting;

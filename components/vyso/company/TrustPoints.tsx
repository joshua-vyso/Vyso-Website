import { Card } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { stagger } from "@/components/vyso/stagger";

/* ── Trust points ────────────────────────────────────────────────────────────
   Shared between `/about` (§7.6: "trust section: POPIA awareness, plain
   language data handling, humans approve actions") and `/south-africa`
   (the same three facts, local context). One component rather than two
   copies of the same three sentences, so the two pages can never say this
   differently. Grounded in the same facts `lib/marketing/faq.ts`'s "trust"
   group states: Vyso is not a compliance product, and it does not claim to
   make a business POPIA compliant on its own; it is aware of POPIA in how it
   builds, explains data handling in plain language, and keeps a human
   approving anything that touches money or a customer. */

const TRUST_POINTS: readonly { title: string; body: string }[] = [
  {
    title: "POPIA, taken seriously",
    body: "We're aware of our obligations under POPIA and build with them in mind: access scoped to your organisation, and only to the roles that need it. Vyso doesn't claim to make a business POPIA compliant on its own. That still depends on how your business collects, uses and protects information.",
  },
  {
    title: "Plain language, not fine print",
    body: "We can explain what a system reads, where the information goes and who can see it, in plain language, before you commit to anything. If a question doesn't have a straight answer, we say so rather than talk around it.",
  },
  {
    title: "Humans approve actions",
    body: "Vyso surfaces findings, drafts and recommendations. Actions that affect your money or your customers, an invoice, a supplier query, are reviewed and approved by your team before they happen.",
  },
];

export function TrustPoints({ className = "" }: { className?: string }) {
  return (
    <ul
      className={`m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-3 ${className}`.trim()}
    >
      {TRUST_POINTS.map((point, i) => (
        <Reveal key={point.title} as="li" delay={stagger(i)}>
          <Card padding="lg" className="h-full">
            <h3 className="vy-h3 mb-[10px] text-[color:var(--vy-ink)]">{point.title}</h3>
            <p className="vy-body text-[color:var(--vy-ink-3)] text-pretty">{point.body}</p>
          </Card>
        </Reveal>
      ))}
    </ul>
  );
}

export default TrustPoints;

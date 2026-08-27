import type { SolutionFaq } from "@/lib/marketing/solutions";

/* ── The FAQ list ─────────────────────────────────────────────────────────────
   A `<dl>`, because a question and its answer are a definition pair, not a
   heading outline — the same reasoning `Section`'s two-tier heading uses for
   itself. `buildSolutionSchema`'s `FAQPage` node in `solutions-jsonld.ts`
   mirrors this list exactly, so the two can never disagree about what a page
   answers. */

export function SolutionFaqs({ faqs }: { faqs: readonly SolutionFaq[] }) {
  return (
    <dl className="m-0 flex flex-col">
      {faqs.map((faq) => (
        <div key={faq.question} className="border-t border-[color:var(--vy-line)] py-[22px] first:border-t-0 first:pt-0">
          <dt className="vy-h3 text-[18px] text-[color:var(--vy-ink)]">{faq.question}</dt>
          <dd className="vy-body m-0 mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
            {faq.answer}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default SolutionFaqs;

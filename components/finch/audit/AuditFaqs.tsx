import { RAIL } from "@/components/finch/ground/Band";

import { AUDIT_FAQS } from "./audit-content";

/* Four questions, answered in the first sentence. A `<dl>` — these are
   term/definition pairs, not headings — and the strings are the exact ones the
   FAQPage entities carry, because they come from the same module. */
export function AuditFaqs() {
  return (
    <section className={`${RAIL} pt-[64px] lg:pt-[100px]`}>
      {/* The site's section lockup: mono eyebrow at 10/11px .14em, then the
          serif H2 at 28/38. This section used to open on a bare 24/28 H2, which
          made the page's last section read as a footnote. */}
      <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
        COMMON QUESTIONS
      </div>
      <h2 className="m-0 mb-[24px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:mb-[32px] lg:text-[38px]">
        Straight answers
      </h2>

      <dl className="m-0 grid max-w-[900px] grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
        {AUDIT_FAQS.map(({ question, answer }) => (
          <div key={question}>
            <dt className="mb-[7px] font-fn-serif text-[17px] font-medium text-fn-ink">{question}</dt>
            <dd className="m-0 text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default AuditFaqs;

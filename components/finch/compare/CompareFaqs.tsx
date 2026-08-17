import type { CompareFaq } from "@/lib/marketing/compare";

import { Eyebrow } from "./CompareBits";

/* The four questions each comparison ends on. A `<dl>` rather than heading
   pairs — these are term/definition, and it keeps the page to one `<h1>` and
   one `<h2>` per section with nothing skipped. The same strings are the
   `FAQPage` entities in `compare-jsonld.ts`, so the schema mirrors the visible
   text exactly (§7.4: never a hidden Q&A).

   Each `<dt>` carries the question's id so `/faq`-style deep links work into
   this page too. */
export function CompareFaqs({
  eyebrow = "COMMON QUESTIONS",
  title,
  faqs,
}: {
  eyebrow?: string;
  title:    string;
  faqs:     readonly CompareFaq[];
}) {
  return (
    <section
      id="faq"
      className="mx-auto max-w-[860px] scroll-mt-[80px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[110px]"
    >
      <div className="border-t border-fn-line pt-[40px] lg:pt-[56px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="m-0 mb-[28px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:mb-[36px] lg:text-[36px]">
          {title}
        </h2>
        <dl className="m-0 grid grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
          {faqs.map(({ id, question, answer }) => (
            <div key={id} id={id} className="scroll-mt-[100px]">
              <dt className="mb-[7px] font-fn-serif text-[17px] font-medium text-fn-ink">
                {question}
              </dt>
              <dd className="m-0 text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">{answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export default CompareFaqs;

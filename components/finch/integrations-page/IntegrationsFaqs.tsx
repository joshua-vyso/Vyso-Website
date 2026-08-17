import { INTEGRATIONS_FAQS } from "@/lib/marketing/integrations";

/* Native `<details>`/`<summary>` accordion — same pattern as `/pricing`'s
   `WhatsIncluded` and `/faq`'s question list: works with JavaScript off, the
   chevron is a CSS transform keyed off the `open` attribute, no client
   component needed. The four questions here are exactly `INTEGRATIONS_FAQS`,
   mirrored into `integrations-jsonld.ts`'s FAQPage entity. */

function Chevron() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="ml-[16px] h-[11px] w-[11px] shrink-0 text-fn-muted transition-transform duration-150 ease-out group-open:rotate-90"
    >
      <path
        d="M4 2.5 L8 6 L4 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IntegrationsFaqs() {
  return (
    <section className="mx-auto max-w-[860px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[88px]">
      <h2 className="m-0 mb-[24px] font-fn-serif text-[24px] font-medium tracking-[-0.02em] lg:mb-[32px] lg:text-[28px]">
        Integration FAQ
      </h2>
      <div className="border-t border-fn-line">
        {INTEGRATIONS_FAQS.map(({ id, question, answer }, index) => (
          <details key={id} open={index === 0} className="group border-b border-fn-line py-[18px]">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15.5px] font-medium text-fn-ink marker:content-none [&::-webkit-details-marker]:hidden">
              {question}
              <Chevron />
            </summary>
            <p className="m-0 mt-[12px] max-w-[720px] text-[14.5px] leading-[1.6] text-fn-ink-3">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default IntegrationsFaqs;

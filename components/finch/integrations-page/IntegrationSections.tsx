import Image from "next/image";
import { INTEGRATION_DETAILS, type IntegrationStatus } from "@/lib/marketing/integrations";

/* ── Per-tool sections ────────────────────────────────────────────────────────
   One `<dl>` per integration: what Finch reads, what it can do with that,
   status, setup, and the "you ask Finch" example prompt (the exact string
   from `components/finch/integrations.ts` — reused as data, not as the
   `IntegrationPrompt` widget, which is `Senses.tsx`'s and stays there per the
   no-repeated-widget rule).

   Server component throughout — nothing here needs the client. */

const STATUS_STYLE: Record<IntegrationStatus, string> = {
  "CONNECTED IN ONBOARDING": "border-fn-line text-fn-ink-2",
  "LIMITED ROLLOUT": "border-fn-line text-fn-ink-2",
  "ROADMAP": "border-fn-line-2 text-fn-faint",
};

export function IntegrationSections() {
  return (
    <div className="border-t border-fn-line">
      {INTEGRATION_DETAILS.map((integration) => (
        <article
          key={integration.slug}
          id={integration.slug}
          className="scroll-mt-[100px] border-b border-fn-line-2 py-[32px] lg:py-[40px]"
        >
          <div className="mb-[18px] flex flex-wrap items-center gap-[12px] lg:mb-[22px]">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-fn-line bg-fn-surface">
              <Image
                src={`/finch/integrations/${integration.slug}.svg`}
                alt=""
                width={19}
                height={19}
                className="object-contain"
              />
            </span>
            <h3 className="m-0 font-fn-serif text-[20px] font-medium tracking-[-0.01em] text-fn-ink lg:text-[22px]">
              {integration.name}
            </h3>
            <span
              className={
                "rounded-[99px] border px-[10px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] " +
                STATUS_STYLE[integration.status]
              }
            >
              {integration.status}
            </span>
          </div>

          <dl className="m-0 grid grid-cols-1 gap-[20px] md:grid-cols-3 md:gap-[32px]">
            <div>
              <dt className="mb-[6px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted">
                WHAT FINCH READS
              </dt>
              <dd className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-2">{integration.reads}</dd>
            </div>
            <div>
              <dt className="mb-[6px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted">
                WHAT FINCH CAN DO WITH IT
              </dt>
              <dd className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-2">{integration.canDo}</dd>
            </div>
            <div>
              <dt className="mb-[6px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted">
                SETUP
              </dt>
              <dd className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-2">{integration.setup}</dd>
            </div>
          </dl>

          <div className="mt-[20px] flex items-start gap-[10px] border-t border-fn-line-2 pt-[16px] lg:mt-[24px]">
            <span className="mt-[2px] shrink-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-muted">
              YOU ASK
            </span>
            <p className="m-0 font-fn-serif text-[15.5px] italic leading-[1.5] text-fn-ink-3">
              {integration.prompt}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default IntegrationSections;

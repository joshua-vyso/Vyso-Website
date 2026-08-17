import Link from "next/link";
import { DONT_SEE_YOUR_TOOL } from "@/lib/marketing/integrations";

/* "Don't see your tool?" — the expanded-mandates line (verbatim source fact:
   `components/finch/pricing/pricing-data.ts` / `lib/marketing/faq.ts`, both
   say "expanded mandates, priced on scope") plus a way to say so. */
export function DontSeeYourTool() {
  return (
    <section className="mx-auto max-w-[860px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[88px]">
      <div className="rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[28px] lg:px-[32px] lg:py-[32px]">
        <h2 className="m-0 mb-[10px] font-fn-serif text-[20px] font-medium tracking-[-0.01em] text-fn-ink lg:text-[22px]">
          Don&rsquo;t see your tool?
        </h2>
        <p className="m-0 mb-[18px] text-[14.5px] leading-[1.6] text-fn-ink-3">{DONT_SEE_YOUR_TOOL}</p>
        <div className="flex flex-wrap items-center gap-[16px]">
          <Link
            href="/operations-audit"
            className="rounded-[8px] bg-fn-orange-cta px-[16px] py-[10px] text-[13.5px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange-deep hover:text-white"
          >
            Book your audit
          </Link>
          <a
            href="mailto:joshua@vyso.co.za"
            className="text-[13.5px] font-medium text-fn-ink-2 underline decoration-fn-line-3 underline-offset-4 transition-colors duration-150 hover:text-fn-orange-deep"
          >
            or tell us directly — joshua@vyso.co.za
          </a>
        </div>
      </div>
    </section>
  );
}

export default DontSeeYourTool;

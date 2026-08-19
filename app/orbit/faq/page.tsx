import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { Glow } from "@/components/finch/ground/Glow";
import { Breadcrumb, FaqList, StatusNote, WaitlistBand } from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { breadcrumbNode, faqNode, jsonLd, orbitGraph, webPageNode } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ALL_ORBIT_FAQS, ORBIT_FAQ_GROUPS } from "@/lib/orbit/faq";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/faq` ────────────────────────────────────────────────────────────
   Twenty-two answers, written first-sentence-first (see `lib/orbit/faq.ts`),
   grouped, in native `<details>` so every answer is in the HTML whether or not
   JavaScript ran.

   No filter box and no sticky rail. `/faq` on the Finch side has both, and both
   earn their keep across sixty-odd questions; twenty-two fits on a page and a
   search field over twenty-two items is furniture. The group headings and the
   browser's own find-in-page do the job.

   `FAQPage` JSON-LD over the full set, built from the same array the page
   renders — the schema cannot state an answer the page does not show.          */

const TITLE = "Orbit FAQ — WhatsApp invoicing for trades";
const DESCRIPTION =
  "Answers about Orbit: what it is, which trades it suits, whether you need an app, VAT and invoices, your data, languages and when it launches.";
const URL = `${ORBIT.url}/faq`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit/faq" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function buildSchema() {
  return orbitGraph([
    webPageNode(URL, TITLE, DESCRIPTION),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["FAQ", "/orbit/faq"],
    ]),
    faqNode(URL, ALL_ORBIT_FAQS),
  ]);
}

export default function OrbitFaqPage() {
  return (
    <OrbitShell active="faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[44px] lg:pt-[36px] lg:pb-[64px]"
        device={<Glow tone="blue" size={340} className="left-[26%] top-[46%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["FAQ", "/orbit/faq"]]} />
        <h1 className="m-0 mb-[18px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.025em] text-ob-text lg:text-[56px]">
          Orbit, answered.
        </h1>
        <p className="m-0 mb-[26px] max-w-[600px] text-[15.5px] leading-[1.68] text-ob-text-2 lg:text-[17.5px]">
          {ALL_ORBIT_FAQS.length} questions, each answered in the first sentence. If yours is not
          here,{" "}
          <Link
            href="/contact"
            className="underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
          >
            ask us directly
          </Link>
          .
        </p>
        <StatusNote />
      </Band>

      <Band ground="ink" className="bg-ob-bg-2" paddingClassName="pt-[44px] pb-[64px] lg:pt-[64px] lg:pb-[96px]">
        <div className="grid grid-cols-1 gap-y-[52px] lg:grid-cols-[190px_1fr] lg:gap-x-[56px] lg:gap-y-0">
          <nav aria-label="FAQ sections" className="hidden lg:sticky lg:top-[100px] lg:block lg:self-start">
            <ul className="m-0 list-none space-y-[4px] p-0">
              {ORBIT_FAQ_GROUPS.map((group) => (
                <li key={group.id}>
                  <a
                    href={`#${group.id}`}
                    className="block rounded-[6px] px-[10px] py-[7px] text-[13.5px] font-medium text-ob-text-2 transition-colors duration-150 hover:bg-white/[0.06] hover:text-ob-text"
                  >
                    {group.eyebrow}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-[56px] lg:gap-[72px]">
            {ORBIT_FAQ_GROUPS.map((group) => (
              <section key={group.id} id={group.id} aria-labelledby={`${group.id}-heading`} className="scroll-mt-[100px]">
                <p className="m-0 mb-[8px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
                  {group.eyebrow}
                </p>
                <h2
                  id={`${group.id}-heading`}
                  className="m-0 mb-[20px] font-fn-serif text-[25px] font-medium tracking-[-0.02em] text-ob-text lg:text-[30px]"
                >
                  {group.title}
                </h2>
                <FaqList items={group.questions} />
              </section>
            ))}
          </div>
        </div>
      </Band>

      <WaitlistBand />
    </OrbitShell>
  );
}

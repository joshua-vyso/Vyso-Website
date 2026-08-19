import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import {
  Breadcrumb,
  Claim,
  CompareTable,
  Eyebrow,
  FaqList,
  SectionHeading,
  StatusNote,
  WaitlistBand,
  WaitlistCta,
} from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import {
  breadcrumbNode,
  faqNode,
  jsonLd,
  orbitGraph,
  orbitProductNode,
  pricingProductNode,
  webPageNode,
} from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { getOrbitFaq } from "@/lib/orbit/faq";
import { AGAINST_THE_NOTEBOOK, ORBIT_PLAN, PRICING_FAQ_IDS } from "@/lib/orbit/pricing";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/pricing` ────────────────────────────────────────────────────────
   One number, at the size a single-price page should show it (§7's pricing
   composition: "the price is the drama"). An ink hero with an orange dot grid
   behind a 92px figure, and everything else on the page arranged around
   answering "what do I get for it" and "what is it *not*".

   The "not yet" list is on this page deliberately and not buried in the FAQ. A
   pricing page that lists only what is included is how a reader ends up
   discovering an absence after paying — and Orbit has not even opened yet, so
   there is no excuse for being coy about the first release's scope.

   Two schema nodes carry the price: the `SoftwareApplication` (the subsite's
   product node, same `@id` as `/orbit`) and a `Product`, because a pricing page
   is where a shopping surface looks for one. Both say `PreOrder`.              */

const TITLE = "Orbit pricing — R99 per month";
const DESCRIPTION =
  "Orbit costs R99 per tradesperson per month. One plan, everything in it, no per-invoice fee. Orbit is in development — the waitlist locks founding pricing.";
const URL = `${ORBIT.url}/pricing`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit/pricing" },
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

const PRICING_FAQS = PRICING_FAQ_IDS.map(getOrbitFaq);

function buildSchema() {
  return orbitGraph([
    orbitProductNode(),
    pricingProductNode(URL),
    webPageNode(URL, TITLE, DESCRIPTION),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["Pricing", "/orbit/pricing"],
    ]),
    faqNode(URL, PRICING_FAQS),
  ]);
}

export default function OrbitPricingPage() {
  return (
    <OrbitShell active="pricing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      {/* ── The price ────────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[56px] lg:pt-[36px] lg:pb-[96px]"
        device={<OscillatingGrid mode="dots" color="--fn-orange" colorFallback="#FF7727" opacity={0.24} pitch={24} />}
      >
        <Breadcrumb trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["Pricing", "/orbit/pricing"]]} />
        <h1 className="m-0 mb-[8px] font-fn-serif text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-ob-text lg:text-[42px]">
          Orbit pricing.
        </h1>
        <p className="m-0 flex flex-wrap items-baseline gap-x-[14px] gap-y-[4px]">
          <span className="font-fn-serif text-[76px] font-medium leading-[1] tracking-[-0.035em] text-ob-text lg:text-[128px]">
            {ORBIT.price.display}
          </span>
          <span className="text-[17px] text-ob-text-2 lg:text-[20px]">{ORBIT_PLAN.cadence}</span>
        </p>
        {/* Not `ORBIT.price.unit` — it reads "per tradesperson, per month" and
            the cadence is already set beside the figure above. */}
        <p className="m-0 mt-[12px] text-[15px] text-ob-text-2 lg:text-[16.5px]">
          Per tradesperson. Everything included.
        </p>
        <p className="m-0 mt-[6px] font-fn-mono text-[10.5px] tracking-[0.1em] text-ob-mono uppercase">
          {ORBIT.price.vatNote}
        </p>
        <div className="mt-[28px]">
          <StatusNote />
        </div>
        <WaitlistCta className="mt-[24px]" secondary={{ href: "/orbit/how-it-works", label: "How it works" }} />
      </Band>

      {/* ── The direct answer ────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2" paddingClassName="py-[44px] lg:py-[64px]">
        <p className="m-0 max-w-[820px] text-[17px] leading-[1.7] text-ob-text lg:text-[19px]">
          {ORBIT_PLAN.directAnswer}
        </p>
      </Band>

      {/* ── What's included / what isn't ─────────────────────────────────── */}
      <Band ground="blue" device={<FacetPlane />}>
        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-2 lg:gap-[64px]">
          <div>
            <Eyebrow>In the plan</Eyebrow>
            <h2 className="m-0 mb-[20px] font-fn-serif text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-fn-blue-text lg:text-[32px]">
              Everything Orbit does, for one price.
            </h2>
            <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
              {ORBIT_PLAN.included.map((item) => (
                <li key={item} className="flex gap-[11px] text-[14.5px] leading-[1.6] text-fn-blue-text-2">
                  <span aria-hidden className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-orange" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Not in the first release</Eyebrow>
            <h2 className="m-0 mb-[20px] font-fn-serif text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-fn-blue-text lg:text-[32px]">
              And what you would be waiting for.
            </h2>
            <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
              {ORBIT_PLAN.notIncluded.map((item) => (
                <li key={item} className="flex gap-[11px] text-[14.5px] leading-[1.6] text-fn-blue-mono">
                  <span aria-hidden className="mt-[9px] h-[1.5px] w-[9px] shrink-0 bg-fn-blue-mono" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-[20px] max-w-[420px] text-[13.5px] leading-[1.6] text-fn-blue-text-2">
              Listed here rather than in a footnote, because the absence of a feature is a fact a
              price page owes you before you plan around it.
            </p>
          </div>
        </div>
      </Band>

      {/* ── Against the alternative ──────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg">
        <SectionHeading
          eyebrow="What it replaces"
          title="R99 against a notebook, WhatsApp and a bank statement."
          lead="Not against a competitor — against the way most one-person trade businesses actually run today, which is the real alternative."
          className="mb-[32px]"
        />
        <CompareTable columns={["", "Notebook + WhatsApp + bank statement", "Orbit"]} rows={AGAINST_THE_NOTEBOOK} />
        <p className="m-0 mt-[20px] max-w-[720px] text-[13.5px] leading-[1.6] text-ob-mono">
          The left column describes a way of working, not a product. Orbit is in development, so
          the right column describes intent — see{" "}
          <Link href="/orbit/faq" className="underline decoration-ob-line underline-offset-[4px] hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink">
            the FAQ
          </Link>{" "}
          for what is roadmap and what is planned for the first release.
        </p>
      </Band>

      {/* ── Founding pricing ─────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2">
        <div className="max-w-[760px]">
          <Eyebrow>The waitlist</Eyebrow>
          <Claim>Nothing is charged today.</Claim>
          <p className="m-0 mt-[22px] max-w-[600px] text-[15.5px] leading-[1.7] text-ob-text-2 lg:text-[17px]">
            {ORBIT_PLAN.waitlistNote}
          </p>
          <p className="m-0 mt-[18px] max-w-[600px] text-[13.5px] leading-[1.65] text-ob-mono">
            There is no free month, no discount code and no trial being offered here, because none
            has been decided. When there is one, this page will say so.
          </p>
          <WaitlistCta className="mt-[26px]" />
        </div>
      </Band>

      {/* ── Billing questions ────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--ob-blue" colorFallback="#0369FD" opacity={0.24} pitch={26} />}
      >
        <SectionHeading eyebrow="Billing" title="Questions about the money." className="mb-[28px]" />
        <div className="max-w-[860px]">
          <FaqList items={PRICING_FAQS} />
          <p className="m-0 mt-[22px]">
            <Link
              href="/orbit/faq"
              className="text-[14.5px] font-medium text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
            >
              Every question about Orbit →
            </Link>
          </p>
        </div>
      </Band>

      <WaitlistBand />
    </OrbitShell>
  );
}

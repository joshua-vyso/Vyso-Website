import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { Glow } from "@/components/finch/ground/Glow";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import {
  Breadcrumb,
  Claim,
  Eyebrow,
  FaqList,
  SectionHeading,
  StatusNote,
  TradeStrip,
  WaitlistBand,
  WaitlistCta,
} from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { WhatsAppPhone } from "@/components/orbit/WhatsAppPhone";
import { breadcrumbNode, faqNode, jsonLd, orbitGraph, webPageNode } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ORBIT } from "@/lib/orbit/site";
import { TRADES, getTrade } from "@/lib/orbit/trades";

/* ── `/orbit/for/[trade]` ────────────────────────────────────────────────────
   Ten statically generated pages, each rendering one entry of
   `lib/orbit/trades.ts`. The layout is shared; **none of the copy is.** That
   file's header explains why at length — ten pages of the same words with a
   noun swapped is the doorway-page pattern, and it is both a spam-policy
   problem and a useless page.

   `generateStaticParams` returns all ten, so every trade page is prerendered
   at build time and appears in the build output — which is also how a missing
   slug gets caught here rather than in production.

   Each page carries its own four-question `FAQPage`. Ten pages × four
   questions is forty distinct Q&As across the subsite, none of them repeated
   from `/orbit/faq`, which is what makes them worth marking up rather than a
   way of claiming the same rich result eleven times.                          */

export function generateStaticParams() {
  return TRADES.map((trade) => ({ trade: trade.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ trade: string }>;
}): Promise<Metadata> {
  const { trade: slug } = await params;
  const trade = getTrade(slug);
  if (!trade) return {};

  const url = `${ORBIT.url}/for/${trade.slug}`;
  return {
    title: trade.metaTitle,
    description: trade.metaDescription,
    alternates: { canonical: `/orbit/for/${trade.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: trade.metaTitle,
      description: trade.metaDescription,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: { card: "summary_large_image", title: trade.metaTitle, description: trade.metaDescription },
  };
}

export default async function OrbitTradePage({ params }: { params: Promise<{ trade: string }> }) {
  const { trade: slug } = await params;
  const trade = getTrade(slug);
  if (!trade) notFound();

  const url = `${ORBIT.url}/for/${trade.slug}`;
  const schema = orbitGraph([
    webPageNode(url, trade.metaTitle, trade.metaDescription),
    breadcrumbNode(url, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["By trade", "/orbit/for"],
      [trade.name, `/orbit/for/${trade.slug}`],
    ]),
    faqNode(url, trade.faqs),
  ]);

  return (
    <OrbitShell active="for">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[52px] lg:pt-[36px] lg:pb-[88px]"
        device={<Glow tone="blue" size={380} className="left-[24%] top-[42%] h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb
          trail={[
            ["Vyso", "/"],
            ["Orbit", "/orbit"],
            ["By trade", "/orbit/for"],
            [trade.name, `/orbit/for/${trade.slug}`],
          ]}
        />
        <div className="grid grid-cols-1 items-center gap-[44px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-[64px]">
          <div>
            <h1 className="m-0 mb-[20px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.025em] text-balance text-ob-text lg:text-[54px]">
              {trade.h1}
            </h1>
            <p className="m-0 mb-[24px] max-w-[560px] text-[16px] leading-[1.68] text-ob-text-2 lg:text-[18px]">
              {trade.lead}
            </p>
            <StatusNote className="mb-[26px]" />
            <WaitlistCta note={`${ORBIT.price.display} / month`} secondary={{ href: "/orbit/how-it-works", label: "How it works" }} />
          </div>
          <div className="flex flex-col items-center gap-[14px] lg:items-end">
            <WhatsAppPhone script={trade.chat} />
            <p className="m-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-ob-mono uppercase">{trade.chat.caption}</p>
          </div>
        </div>
      </Band>

      {/* ── Where the money goes ─────────────────────────────────────────── */}
      <Band ground="blue" device={<FacetPlane />}>
        <SectionHeading
          eyebrow="Where it goes"
          title={`What costs ${trade.singular} money after the job.`}
          className="mb-[36px] lg:mb-[48px]"
        />
        <ul className="m-0 grid list-none grid-cols-1 gap-[28px] p-0 md:grid-cols-3 md:gap-[36px]">
          {trade.pains.map((pain) => (
            <li key={pain.title} className="border-t border-white/20 pt-[16px]">
              <h3 className="m-0 mb-[9px] text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-fn-blue-text">
                {pain.title}
              </h3>
              <p className="m-0 text-[14.5px] leading-[1.62] text-fn-blue-text-2">{pain.body}</p>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── What Orbit is being built to do about it ─────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--ob-blue" colorFallback="#0369FD" opacity={0.26} pitch={24} />}
      >
        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-[1.15fr_0.85fr] lg:gap-[64px]">
          <div className="max-w-[640px]">
            <Eyebrow>What Orbit does about it</Eyebrow>
            <Claim as="h2">One message, at the end of the job.</Claim>
            <div className="mt-[24px] flex flex-col gap-[18px]">
              {trade.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="m-0 text-[15.5px] leading-[1.72] text-ob-text-2 lg:text-[16.5px]">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          <div>
            <p className="m-0 mb-[14px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
              What it keeps for you
            </p>
            <ul className="m-0 flex list-none flex-col gap-[11px] p-0">
              {trade.keeps.map((item) => (
                <li key={item} className="flex gap-[11px] border-t border-ob-line pt-[11px] text-[14.5px] leading-[1.55] text-ob-text-2">
                  <span aria-hidden className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-orange" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-[18px] font-fn-mono text-[10.5px] tracking-[0.1em] text-ob-mono uppercase">
              {ORBIT.draftsOnly}
            </p>
          </div>
        </div>
      </Band>

      {/* ── FAQs ─────────────────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2">
        <SectionHeading eyebrow="Questions" title={`${trade.name} ask us this.`} className="mb-[28px]" />
        <div className="max-w-[860px]">
          <FaqList items={trade.faqs.map((faq, i) => ({ id: `${trade.slug}-q${i + 1}`, ...faq }))} />
          <p className="m-0 mt-[22px]">
            <Link
              href="/orbit/faq"
              className="text-[14.5px] font-medium text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
            >
              The full Orbit FAQ →
            </Link>
          </p>
        </div>
      </Band>

      {/* ── The other trades ─────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg" paddingClassName="py-[48px] lg:py-[72px]">
        <p className="m-0 mb-[18px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
          Orbit for other trades
        </p>
        <TradeStrip exclude={trade.slug} />
      </Band>

      <WaitlistBand claim={`Orbit for ${trade.name.toLowerCase()}.`} />
    </OrbitShell>
  );
}

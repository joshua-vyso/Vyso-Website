import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Band } from "@/components/finch/ground/Band";
import { Glow } from "@/components/finch/ground/Glow";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import {
  Breadcrumb,
  Claim,
  CompareTable,
  Eyebrow,
  StatusNote,
  WaitlistBand,
  WaitlistCta,
} from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { WhatsAppPhone } from "@/components/orbit/WhatsAppPhone";
import { breadcrumbNode, jsonLd, orbitGraph, webPageNode } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ORBIT_COMPARISONS, getOrbitComparison } from "@/lib/orbit/compare";
import { JOB_TO_INVOICE } from "@/lib/orbit/sequences";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/compare/[slug]` ─────────────────────────────────────────────────
   Two pages, one route. The plan names both URLs explicitly
   (`orbit-vs-job-management-apps`, `orbit-vs-spreadsheets`) and
   `generateStaticParams` produces exactly those two — a dynamic segment with a
   closed list is the same set of built pages as two hand-written files, with
   one copy of the layout instead of two that drift.

   The content rules live in `lib/orbit/compare.ts`: no competitor is named, no
   rival's pricing is quoted, and the "when the other one is right" section is
   not optional. A comparison page that cannot say when you should buy the
   other thing is an advert with a table in it.                                 */

export function generateStaticParams() {
  return ORBIT_COMPARISONS.map((comparison) => ({ slug: comparison.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const comparison = getOrbitComparison(slug);
  if (!comparison) return {};

  const url = `${ORBIT.url}/compare/${comparison.slug}`;
  return {
    title: comparison.metaTitle,
    description: comparison.metaDescription,
    alternates: { canonical: `/orbit/compare/${comparison.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: comparison.metaTitle,
      description: comparison.metaDescription,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: comparison.metaTitle,
      description: comparison.metaDescription,
    },
  };
}

export default async function OrbitComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comparison = getOrbitComparison(slug);
  if (!comparison) notFound();

  const url = `${ORBIT.url}/compare/${comparison.slug}`;
  const other = ORBIT_COMPARISONS.find((c) => c.slug !== comparison.slug);
  const schema = orbitGraph([
    webPageNode(url, comparison.metaTitle, comparison.metaDescription),
    breadcrumbNode(url, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["Compare", `/orbit/compare/${comparison.slug}`],
    ]),
  ]);

  return (
    <OrbitShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[48px] lg:pt-[36px] lg:pb-[80px]"
        device={<Glow tone="blue" size={380} className="left-[24%] top-[44%] h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb
          trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["Compare", `/orbit/compare/${comparison.slug}`]]}
        />
        <h1 className="m-0 mb-[20px] max-w-[820px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.025em] text-balance text-ob-text lg:text-[54px]">
          {comparison.h1}
        </h1>
        <p className="m-0 mb-[26px] max-w-[720px] text-[16px] leading-[1.7] text-ob-text-2 lg:text-[18px]">
          {comparison.answer}
        </p>
        <StatusNote />
      </Band>

      {/* ── The table ────────────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2">
        <Eyebrow>Side by side</Eyebrow>
        <CompareTable columns={comparison.columns} rows={comparison.rows} />
      </Band>

      {/* ── The argument ─────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--ob-blue" colorFallback="#0369FD" opacity={0.24} pitch={24} />}
      >
        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-[1.15fr_0.85fr] lg:gap-[64px]">
          <div className="max-w-[660px]">
            <Claim as="h2">The difference is when the record gets made.</Claim>
            <div className="mt-[24px] flex flex-col gap-[18px]">
              {comparison.body.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="m-0 text-[15.5px] leading-[1.72] text-ob-text-2 lg:text-[16.5px]">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <WhatsAppPhone script={JOB_TO_INVOICE} />
          </div>
        </div>
      </Band>

      {/* ── When it isn't us ─────────────────────────────────────────────── */}
      <Band ground="blue">
        <div className="max-w-[760px]">
          <Eyebrow>Being straight about it</Eyebrow>
          <h2 className="m-0 mb-[18px] font-fn-serif text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-fn-blue-text lg:text-[34px]">
            {comparison.whenNot.title}
          </h2>
          <p className="m-0 text-[15.5px] leading-[1.72] text-fn-blue-text-2 lg:text-[17px]">
            {comparison.whenNot.body}
          </p>
          <div className="mt-[26px]">
            <WaitlistCta note={`${ORBIT.price.display} / month`} />
          </div>
        </div>
      </Band>

      {other ? (
        <Band ground="ink" className="bg-ob-bg-2" paddingClassName="py-[44px] lg:py-[64px]">
          <p className="m-0 mb-[10px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
            The other comparison
          </p>
          <Link
            href={`/orbit/compare/${other.slug}`}
            className="font-fn-serif text-[24px] font-medium tracking-[-0.02em] text-ob-text transition-colors duration-150 hover:text-fn-orange-on-ink lg:text-[30px]"
          >
            {other.h1} →
          </Link>
        </Band>
      ) : null}

      <WaitlistBand />
    </OrbitShell>
  );
}

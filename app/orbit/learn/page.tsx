import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { Glow } from "@/components/finch/ground/Glow";
import { Breadcrumb, StatusNote, WaitlistBand } from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { breadcrumbNode, jsonLd, orbitGraph, webPageNode } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ORBIT_ARTICLES } from "@/lib/orbit/articles";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/learn` ──────────────────────────────────────────────────────────
   Three articles and an index. The index is not in the plan's page list — the
   plan says "`/orbit/learn/*` — 3 launch articles" — and it exists for the same
   reason `/orbit/for` does: three leaf pages with no parent are three orphans
   in the link graph, and `/orbit/learn` typed by hand should not 404. Recorded
   as a deviation in `.ai/implementation.md`.                                   */

const TITLE = "Orbit guides for South African trades";
const DESCRIPTION =
  "Practical guides for South African tradespeople: tracking jobs on WhatsApp, what a South African invoice must say, and where trade businesses lose money.";
const URL = `${ORBIT.url}/learn`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit/learn" },
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
    webPageNode(URL, TITLE, DESCRIPTION, {
      "@type": "CollectionPage",
      mainEntity: {
        "@type": "ItemList",
        itemListElement: ORBIT_ARTICLES.map((article, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: article.title,
          url: `${ORBIT.url}/learn/${article.slug}`,
        })),
      },
    }),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["Guides", "/orbit/learn"],
    ]),
  ]);
}

export default function OrbitLearnIndexPage() {
  return (
    <OrbitShell active="learn">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[44px] lg:pt-[36px] lg:pb-[64px]"
        device={<Glow tone="blue" size={340} className="left-[26%] top-[46%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["Guides", "/orbit/learn"]]} />
        <h1 className="m-0 mb-[18px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.025em] text-ob-text lg:text-[56px]">
          Guides.
        </h1>
        <p className="m-0 mb-[26px] max-w-[620px] text-[15.5px] leading-[1.68] text-ob-text-2 lg:text-[17.5px]">
          Three pieces about the part of a trade business that happens after the work: the record,
          the invoice and the money. All of them are useful whether or not you ever use Orbit.
        </p>
        <StatusNote />
      </Band>

      <Band ground="ink" className="bg-ob-bg-2">
        <ul className="m-0 flex list-none flex-col gap-[20px] p-0">
          {ORBIT_ARTICLES.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/orbit/learn/${article.slug}`}
                className="flex flex-col rounded-[12px] border border-ob-line bg-ob-surface p-[22px] transition-colors duration-150 hover:border-fn-orange-on-ink lg:p-[28px]"
              >
                <span className="mb-[10px] font-fn-mono text-[10px] tracking-[0.12em] text-ob-mono uppercase">
                  {article.readingMinutes} min read
                </span>
                <h2 className="m-0 mb-[10px] max-w-[760px] font-fn-serif text-[24px] font-medium leading-[1.2] tracking-[-0.02em] text-ob-text lg:text-[30px]">
                  {article.title}
                </h2>
                <p className="m-0 max-w-[760px] text-[14.5px] leading-[1.65] text-ob-text-2 lg:text-[15.5px]">
                  {article.standfirst}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </Band>

      <WaitlistBand />
    </OrbitShell>
  );
}

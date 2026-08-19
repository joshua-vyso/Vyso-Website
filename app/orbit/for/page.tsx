import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { Glow } from "@/components/finch/ground/Glow";
import { Breadcrumb, StatusNote, WaitlistBand } from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { breadcrumbNode, jsonLd, orbitGraph, webPageNode } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ORBIT } from "@/lib/orbit/site";
import { TRADES } from "@/lib/orbit/trades";

/* ── `/orbit/for` ────────────────────────────────────────────────────────────
   The hub for the ten trade pages, and a decision the plan did not spell out:
   `.ai/plan_orbit_site.md` lists `/orbit/for/[trade]` and a "For trades ▾" nav
   item, but no hub. A dropdown with no destination is a nav item that 404s the
   moment somebody types the parent path, and ten leaf pages with no shared
   parent are ten orphans as far as an internal link graph is concerned. So the
   hub exists, it is one screen long, and it is recorded as a deviation in
   `.ai/implementation.md`.

   `CollectionPage` with an `ItemList` rather than a second `SoftwareApplication`
   — this page lists pages; it does not describe the product again.            */

const TITLE = "Orbit by trade — ten South African trades";
const DESCRIPTION =
  "Orbit for plumbers, electricians, tilers, painters, builders, handymen, carpenters, roofers, solar installers and landscapers. R99 a month.";
const URL = `${ORBIT.url}/for`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit/for" },
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
        itemListElement: TRADES.map((trade, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `Orbit for ${trade.name.toLowerCase()}`,
          url: `${ORBIT.url}/for/${trade.slug}`,
        })),
      },
    }),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["By trade", "/orbit/for"],
    ]),
  ]);
}

export default function OrbitTradesHubPage() {
  return (
    <OrbitShell active="for">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[44px] lg:pt-[36px] lg:pb-[64px]"
        device={<Glow tone="blue" size={360} className="left-[26%] top-[46%] h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["By trade", "/orbit/for"]]} />
        <h1 className="m-0 mb-[18px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-ob-text lg:text-[56px]">
          Orbit, by trade.
        </h1>
        <p className="m-0 mb-[26px] max-w-[620px] text-[15.5px] leading-[1.68] text-ob-text-2 lg:text-[17.5px]">
          The same product, ten different weeks. A roofer&rsquo;s job is stopped by rain and
          restarted; a handyman&rsquo;s is over in forty minutes and never gets billed. Each page
          below is written for the way that trade actually loses money.
        </p>
        <StatusNote />
      </Band>

      <Band ground="ink" className="bg-ob-bg-2">
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 lg:grid-cols-3">
          {TRADES.map((trade) => (
            <li key={trade.slug}>
              <Link
                href={`/orbit/for/${trade.slug}`}
                className="flex h-full flex-col rounded-[12px] border border-ob-line bg-ob-surface p-[20px] transition-colors duration-150 hover:border-fn-orange-on-ink"
              >
                <h2 className="m-0 mb-[8px] font-fn-serif text-[21px] font-medium tracking-[-0.015em] text-ob-text">
                  {trade.name}
                </h2>
                <p className="m-0 text-[14px] leading-[1.6] text-ob-text-2">{trade.pains[0].title}</p>
                <span aria-hidden className="mt-[16px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-orange-on-ink uppercase">
                  Read →
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="m-0 mt-[28px] max-w-[720px] text-[13.5px] leading-[1.65] text-ob-mono">
          Not on the list? Orbit is being built around jobs, costs and invoices rather than around
          any one trade, so most site-based work fits. Choose &ldquo;Something else&rdquo; on the{" "}
          <Link href="/orbit/waitlist" className="underline decoration-ob-line underline-offset-[4px] hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink">
            waitlist form
          </Link>{" "}
          and tell us what you do.
        </p>
      </Band>

      <WaitlistBand />
    </OrbitShell>
  );
}

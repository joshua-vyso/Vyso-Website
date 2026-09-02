import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, PageHead, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import { INDUSTRY_PAGES } from "@/components/site/industries-content";
import { INDUSTRY_ROWS } from "@/components/vx/content";
import { Arrow, Reveal } from "@/components/vx/primitives";
import { SITE } from "@/lib/marketing/site";

const DESCRIPTION =
  "The operations Vyso knows by name: food and hospitality, where its production systems run today, plus construction and insurance. Each page shows the workflows we automate and what stays under human control.";

export const metadata: Metadata = {
  title: "Industries — AI automation for food, construction and insurance",
  description: DESCRIPTION,
  alternates: { canonical: "/industries" },
};

const ANSWER =
  "Vyso builds AI automation systems for three kinds of operation: food and hospitality businesses (in production today), construction companies, and insurance brokerages. The systems are the same five; the workflow that goes first changes per industry.";

export default function IndustriesPage() {
  return (
    <VxShell closing={{ line: "Your industry", em: "next." }}>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Industries", "/industries"]])} />
      <JsonLd data={webPage({ path: "/industries", name: "Industries", description: DESCRIPTION, type: "CollectionPage" })} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          "@id": `${SITE.url}/industries#list`,
          itemListElement: INDUSTRY_PAGES.map((industry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: industry.name,
            url: `${SITE.url}/industries/${industry.slug}`,
          })),
        }}
      />
      <PageHead eyebrow="Industries" title="Operations we know" em="by name." answer={ANSWER} />

      <section className="vx-on-ink" style={{ padding: "clamp(40px, 6vw, 96px) 0" }} aria-label="Industries">
        <div className="vx-wrap">
          <ul className="vx-rows" role="list">
            {INDUSTRY_ROWS.map((row, i) => {
              const page = INDUSTRY_PAGES.find((p) => p.slug === row.slug)!;
              return (
                <Reveal as="li" key={row.slug} delay={i * 80}>
                  <Link href={`/industries/${row.slug}`} className="vx-row" data-cursor-label="Open">
                    <span className="n">
                      {row.num} · {row.status}
                    </span>
                    <span className="t">{row.title}</span>
                    <span className="p">{page.lead.split(". ")[0]}.</span>
                    <span className="a" aria-hidden="true">
                      <Arrow />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>
    </VxShell>
  );
}

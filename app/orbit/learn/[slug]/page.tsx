import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Band } from "@/components/finch/ground/Band";
import { Glow } from "@/components/finch/ground/Glow";
import { Breadcrumb, Eyebrow, StatusNote, WaitlistBand } from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { articleNode, breadcrumbNode, jsonLd, orbitGraph } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ORBIT_ARTICLES, getOrbitArticle } from "@/lib/orbit/articles";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/learn/[slug]` ───────────────────────────────────────────────────
   A 720px reading column, a table of contents built from the article's own
   section headings, and `Article` JSON-LD.

   Two small rules worth naming, both from `lib/orbit/articles.ts`:

   - **A paragraph beginning "- " is a list item.** Three articles do not
     justify a markdown pipeline or an MDX dependency (and this repo takes no
     new dependencies), but they do have lists, and a `paragraphs: string[]`
     with one convention in it is the smallest thing that works. Consecutive
     list items are grouped into one `<ul>` below rather than each becoming its
     own single-item list.
   - **`sources` renders where the article claims a fact about the world.** The
     invoicing piece cites the VAT Act; a reader acting on what it says is
     entitled to know where it came from.                                      */

export function generateStaticParams() {
  return ORBIT_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getOrbitArticle(slug);
  if (!article) return {};

  const url = `${ORBIT.url}/learn/${article.slug}`;
  return {
    title: article.metaTitle,
    description: article.metaDescription,
    alternates: { canonical: `/orbit/learn/${article.slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title: article.metaTitle,
      description: article.metaDescription,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "article",
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
    },
    twitter: { card: "summary_large_image", title: article.metaTitle, description: article.metaDescription },
  };
}

/** `"How to track jobs on WhatsApp"` → `"how-to-track-jobs-on-whatsapp"`, for
    the heading anchors the table of contents links to. */
function headingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Splits a section's paragraphs into runs of prose and runs of list items, so
    consecutive `- ` lines become one `<ul>`. */
function blocks(paragraphs: string[]): { kind: "p" | "ul"; items: string[] }[] {
  const out: { kind: "p" | "ul"; items: string[] }[] = [];
  for (const paragraph of paragraphs) {
    const isItem = paragraph.startsWith("- ");
    const text = isItem ? paragraph.slice(2) : paragraph;
    const last = out[out.length - 1];
    if (isItem && last?.kind === "ul") last.items.push(text);
    else out.push({ kind: isItem ? "ul" : "p", items: [text] });
  }
  return out;
}

export default async function OrbitArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getOrbitArticle(slug);
  if (!article) notFound();

  const url = `${ORBIT.url}/learn/${article.slug}`;
  const schema = orbitGraph([
    articleNode(url, article),
    breadcrumbNode(url, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["Guides", "/orbit/learn"],
      [article.title, `/orbit/learn/${article.slug}`],
    ]),
  ]);

  const published = new Date(article.datePublished).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <OrbitShell active="learn">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[40px] lg:pt-[36px] lg:pb-[56px]"
        device={<Glow tone="blue" size={320} className="left-[24%] top-[50%] h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb
          trail={[
            ["Vyso", "/"],
            ["Orbit", "/orbit"],
            ["Guides", "/orbit/learn"],
            [article.title, `/orbit/learn/${article.slug}`],
          ]}
        />
        <article className="max-w-[760px]">
          <p className="m-0 mb-[14px] font-fn-mono text-[10.5px] tracking-[0.14em] text-ob-mono uppercase">
            Guide · {article.readingMinutes} min read
          </p>
          <h1 className="m-0 mb-[20px] font-fn-serif text-[34px] font-medium leading-[1.12] tracking-[-0.025em] text-balance text-ob-text lg:text-[50px]">
            {article.title}
          </h1>
          <p className="m-0 text-[16.5px] leading-[1.65] text-ob-text-2 lg:text-[19px]">{article.standfirst}</p>
          <p className="m-0 mt-[20px] font-fn-mono text-[10.5px] tracking-[0.1em] text-ob-mono uppercase">
            Vyso · <time dateTime={article.datePublished}>{published}</time>
          </p>
        </article>
      </Band>

      <Band ground="ink" className="bg-ob-bg-2" paddingClassName="pt-[44px] pb-[64px] lg:pt-[64px] lg:pb-[96px]">
        <div className="grid grid-cols-1 gap-y-[44px] lg:grid-cols-[220px_1fr] lg:gap-x-[64px] lg:gap-y-0">
          <nav aria-label="On this page" className="lg:sticky lg:top-[100px] lg:self-start">
            <p className="m-0 mb-[12px] font-fn-mono text-[10px] tracking-[0.14em] text-ob-mono uppercase">
              On this page
            </p>
            <ul className="m-0 flex list-none flex-col gap-[8px] p-0">
              {article.sections.map((section) => (
                <li key={section.heading}>
                  <a
                    href={`#${headingId(section.heading)}`}
                    className="text-[13px] leading-[1.45] text-ob-text-2 transition-colors duration-150 hover:text-fn-orange-on-ink"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="max-w-[760px]">
            {article.sections.map((section) => (
              <section key={section.heading} id={headingId(section.heading)} className="mb-[40px] scroll-mt-[100px]">
                <h2 className="m-0 mb-[16px] font-fn-serif text-[25px] font-medium leading-[1.22] tracking-[-0.02em] text-ob-text lg:text-[31px]">
                  {section.heading}
                </h2>
                {blocks(section.paragraphs).map((block, i) =>
                  block.kind === "ul" ? (
                    <ul key={`ul-${i}`} className="m-0 mb-[16px] flex list-none flex-col gap-[9px] p-0">
                      {block.items.map((item) => (
                        <li key={item} className="flex gap-[11px] text-[16px] leading-[1.72] text-ob-text-2 lg:text-[17px]">
                          <span aria-hidden className="mt-[11px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-orange" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p key={`p-${i}`} className="m-0 mb-[16px] text-[16px] leading-[1.75] text-ob-text-2 lg:text-[17px]">
                      {block.items[0]}
                    </p>
                  ),
                )}
              </section>
            ))}

            {article.sources ? (
              <section className="mb-[40px] rounded-[12px] border border-ob-line bg-ob-surface p-[20px] lg:p-[24px]">
                <Eyebrow>Sources</Eyebrow>
                <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
                  {article.sources.map((source) => (
                    <li key={source.label}>
                      <p className="m-0 text-[14.5px] font-medium text-ob-text">{source.label}</p>
                      <p className="m-0 text-[13.5px] leading-[1.6] text-ob-text-2">{source.note}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="mb-[32px]">
              <StatusNote />
            </div>

            <div className="border-t border-ob-line pt-[22px]">
              <p className="m-0 mb-[12px] font-fn-mono text-[10px] tracking-[0.14em] text-ob-mono uppercase">
                Read next
              </p>
              <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
                {article.related.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Band>

      <WaitlistBand />
    </OrbitShell>
  );
}

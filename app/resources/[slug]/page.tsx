import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ContactForm from "@/components/ContactForm";
import { Button } from "@/components/vyso/Button";
import { Shell } from "@/components/vyso/Shell";
import { ArrowLink, Breadcrumb, Eyebrow, H2, LEAD, SECTION } from "@/components/finch/learn/LearnBits";
import { buildResourceSchema } from "@/components/finch/learn/learn-jsonld";
import { RESOURCES, getResource } from "@/lib/marketing/resources";
import { SITE } from "@/lib/marketing/site";

export function generateStaticParams() {
  return RESOURCES.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) return {};

  const url = `${SITE.url}/resources/${slug}`;
  return {
    title: resource.title,
    description: resource.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: resource.title,
      description: resource.description,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: resource.title,
      description: resource.description,
    },
  };
}

/* `/resources/[slug]` — the preview content is kept exactly as it was (it is
   the real table of contents of a real document). The request form is
   `ContactForm`'s existing `general` variant, not a new one: the plan is
   explicit about that, and the ask is genuinely the same four fields the
   general form already sends. The framing does the work: the section is
   headed "Send me the <resource>" and the message field is pre-explained
   rather than re-labelled.

   `.ai/plan_vyso_redesign_2026.md` §7.6: chrome swap onto the vyso `Shell`
   (`active="insights"`). The CTA button moved to `components/vyso/Button`
   (solid ink, plan §4 — no orange CTA), and "Finch" is gone from the two
   spots that named it ("what Finch fixes" / "how Finch approaches"). */
export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) notFound();

  return (
    <Shell active="insights">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildResourceSchema(resource)).replace(/</g, "\\u003c"),
        }}
      />

      <header className="mx-auto max-w-[1160px] px-[var(--vy-gutter)] pt-[36px] lg:px-[40px] lg:pt-[56px]">
        <Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Resources", href: "/resources" },
            { label: resource.shortName, href: `/resources/${resource.slug}` },
          ]}
        />
        <div className="max-w-[820px]">
          <Eyebrow>{resource.eyebrow.toUpperCase()}</Eyebrow>
          <h1 className="vy-h1 m-0 mb-[18px] text-pretty text-[color:var(--vy-ink)] lg:mb-[22px]">
            {resource.heroPlain} <span className="text-[color:var(--vy-ink-3)]">{resource.heroAccent}</span>
          </h1>
          <p className="vy-body-lg m-0 mb-[26px] max-w-[720px] text-pretty text-[color:var(--vy-ink-2)]">
            {resource.summary}
          </p>
          <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[8px]">
            <Button
              href="#request"
              event="resource_request"
              eventProps={{ slug: resource.slug }}
            >
              Send me the {resource.shortName.toLowerCase()}
            </Button>
            <span className="vy-label text-[color:var(--vy-ink-3)]">
              FREE · {resource.preview.length} SECTIONS · NO NEWSLETTER
            </span>
          </div>
        </div>
      </header>

      <section className={SECTION} aria-labelledby="fit-heading">
        <Eyebrow>WHO IT&rsquo;S FOR</Eyebrow>
        <h2 id="fit-heading" className={H2}>
          Built for a specific job, not everyone.
        </h2>
        <div className="mt-[28px] grid grid-cols-1 gap-[40px] md:grid-cols-2 md:gap-[64px] lg:mt-[40px]">
          <p className="vy-body m-0 text-pretty text-[color:var(--vy-ink-2)]">
            {resource.whoItsFor}
          </p>
          <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
            {resource.whatItHelps.map((point) => (
              <li
                key={point.slice(0, 40)}
                className="vy-small border-l border-[color:var(--vy-line)] pl-[16px] text-pretty text-[color:var(--vy-ink-3)]"
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="preview-heading">
        <Eyebrow>PREVIEW</Eyebrow>
        <h2 id="preview-heading" className={H2}>
          What&rsquo;s actually inside.
        </h2>
        <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>
          This is the real content, not a teaser. Asking for it gets you the same thing in a
          format you can use directly with your team.
        </p>

        <ol className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 lg:grid-cols-3">
          {resource.preview.map((section, index) => (
            <li
              key={section.heading}
              className="rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[22px] py-[22px]"
            >
              <span className="vy-label mb-[10px] block text-[color:var(--vy-ink-3)]">
                SECTION {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="m-0 mb-[12px] text-[18px] font-medium tracking-[-0.015em] text-[color:var(--vy-ink)]">
                {section.heading}
              </h3>
              <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
                {section.items.map((item) => (
                  <li
                    key={item.slice(0, 40)}
                    className="border-l border-[color:var(--vy-line-2)] pl-[13px] text-[13.5px] leading-[1.55] text-[color:var(--vy-ink-3)] text-pretty"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className={SECTION} aria-labelledby="request-heading" id="request">
        <Eyebrow>REQUEST IT</Eyebrow>
        <h2 id="request-heading" className={H2}>
          Send me the {resource.shortName.toLowerCase()}.
        </h2>
        <div className="mt-[28px] grid grid-cols-1 gap-[40px] lg:mt-[40px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-[64px]">
          <div>
            <p className="vy-body m-0 mb-[16px] text-pretty text-[color:var(--vy-ink-2)]">
              Tell us where to send it and we&rsquo;ll get the{" "}
              {resource.shortName.toLowerCase()} to you directly. Use the message field to say
              what is actually breaking down: we read it, and the reply is a person&rsquo;s
              rather than a drip sequence.
            </p>
            <ul className="vy-label m-0 flex list-none flex-col gap-[8px] p-0 text-[color:var(--vy-ink-3)]">
              <li>NO NEWSLETTER SIGN-UP</li>
              <li>NO AUTOMATED FOLLOW-UP SEQUENCE</li>
              <li>ONE REPLY, WITHIN A BUSINESS DAY</li>
            </ul>
          </div>
          <div className="rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[22px] py-[24px] lg:px-[28px] lg:py-[28px]">
            <ContactForm variant="general" />
          </div>
        </div>
      </section>

      <section className={SECTION} aria-labelledby="related-heading">
        <Eyebrow>KEEP EXPLORING</Eyebrow>
        <h2 id="related-heading" className={H2}>
          The problem behind the document.
        </h2>
        <div className="mt-[32px] grid grid-cols-1 gap-[40px] border-t border-[color:var(--vy-line)] pt-[28px] md:grid-cols-2 md:gap-[64px] lg:mt-[44px]">
          <div>
            <Eyebrow>WHAT VYSO BUILDS</Eyebrow>
            <p className="vy-small m-0 mb-[14px] max-w-[420px] text-pretty text-[color:var(--vy-ink-3)]">
              {resource.shortName} maps most directly onto how Vyso approaches{" "}
              {resource.relatedSolutionName.toLowerCase()}.
            </p>
            <ArrowLink href={`/solutions/${resource.relatedSolutionSlug}`}>
              {resource.relatedSolutionName}
            </ArrowLink>
          </div>
          <div>
            <Eyebrow>BACKGROUND READING</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
              {resource.relatedArticles.map((article) => (
                <li key={article.href}>
                  <ArrowLink href={article.href}>{article.title}</ArrowLink>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-[16px] text-[14px] text-[color:var(--vy-ink-3)]">
              <ArrowLink href="/resources">All three resources</ArrowLink>
            </p>
          </div>
        </div>
      </section>
    </Shell>
  );
}

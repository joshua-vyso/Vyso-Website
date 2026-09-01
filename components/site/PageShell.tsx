import { SiteFooter, SiteNav } from "@/components/site/SiteChrome";
import { SITE } from "@/lib/marketing/site";

/* ── Shared shell + JSON-LD helpers for the agency pages ───────────────────── */

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="vy-site">
      <SiteNav />
      <main id="main" className="pt-28 md:pt-36">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
}) {
  return (
    <header className="mx-auto max-w-[1200px] px-6 pb-16 md:pb-20">
      <p className="vy-eyebrow text-ink-3">{eyebrow}</p>
      <h1 className="mt-5 max-w-[840px] text-balance text-[clamp(2.2rem,5vw,3.8rem)] font-semibold leading-[1.04] tracking-[-0.02em] text-ink">
        {title}
      </h1>
      {lead ? (
        <p className="mt-6 max-w-[620px] text-pretty text-lg leading-relaxed text-ink-2">{lead}</p>
      ) : null}
    </header>
  );
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function breadcrumbs(items: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: `${SITE.url}${path}`,
    })),
  };
}

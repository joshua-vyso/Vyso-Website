import { Cursor } from "./Cursor";
import { Nav } from "./Nav";
import { Preloader } from "./Preloader";
import { Closing } from "./Footer";
import { SITE } from "@/lib/marketing/site";

/* ── Page shell for every marketing route ────────────────────────────────────
   `.vx` scopes the design system; the platform never sees it. The preloader
   plays on the homepage only (inner pages must load instantly). */

export function VxShell({
  children,
  preload = false,
  closing,
}: {
  children: React.ReactNode;
  preload?: boolean;
  closing?: { line?: string; em?: string; hideCta?: boolean };
}) {
  return (
    <div className="vx">
      {preload ? <Preloader /> : null}
      <Cursor />
      <Nav />
      <main id="main">{children}</main>
      <Closing {...closing} />
    </div>
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

/** WebPage node with a `speakable` pointer at the page's answer capsule, so
    answer engines lift the definition sentence rather than the nav. */
export function webPage({
  path,
  name,
  description,
  type = "WebPage",
}: {
  path: string;
  name: string;
  description: string;
  type?: "WebPage" | "AboutPage" | "FAQPage" | "CollectionPage" | "ContactPage";
}) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${SITE.url}${path}#webpage`,
    url: `${SITE.url}${path}`,
    name,
    description,
    inLanguage: "en-ZA",
    isPartOf: { "@id": `${SITE.url}/#website` },
    about: { "@id": `${SITE.url}/#organization` },
    speakable: { "@type": "SpeakableSpecification", cssSelector: [".vx-answer", "h1"] },
  };
}

/** Inner page header: eyebrow, display headline, answer capsule, lead. */
export function PageHead({
  eyebrow,
  title,
  em,
  answer,
  lead,
  aside,
}: {
  eyebrow: string;
  title: string;
  em?: string;
  answer: string;
  lead?: string;
  aside?: React.ReactNode;
}) {
  return (
    <header className="vx-wrap vx-page-head">
      <p className="vx-eyebrow">{eyebrow}</p>
      <h1 className="vx-display vx-h1" style={{ marginTop: 22 }}>
        {title} {em ? <em className="vx-em">{em}</em> : null}
      </h1>
      <div className="vx-page-head-grid" style={{ marginTop: 36 }}>
        <div>
          <p className="vx-answer">{answer}</p>
          {lead ? (
            <p className="vx-lead" style={{ marginTop: 18 }}>
              {lead}
            </p>
          ) : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </div>
    </header>
  );
}

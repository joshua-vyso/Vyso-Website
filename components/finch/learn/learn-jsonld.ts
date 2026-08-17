import { GLOSSARY_ALPHABETICAL, GLOSSARY_HUB, firstSentence, type GlossaryTerm } from "@/lib/marketing/glossary";
import { LEARN_ARTICLES, type LearnArticle } from "@/lib/marketing/learn-articles";
import { RESOURCES, type Resource } from "@/lib/marketing/resources";
import { SITE } from "@/lib/marketing/site";

/* ── Structured data for /learn, /learn/glossary and /resources ──────────────
   Every builder reads the same objects the pages render, so the schema cannot
   claim something the page doesn't say — the rule `solutions-jsonld.ts` and
   `integrations-jsonld.ts` already follow.

   Two `@id`s from the root layout's sitewide graph are referenced rather than
   redeclared: `#organization` (publisher) and `#josh` (the founder Person,
   which is who `ARTICLE_AUTHOR` names). Nothing here mints a second Person or
   Organization node for the same entity.

   Server-only by construction: the three data modules import no client code. */

const ORG = { "@id": `${SITE.url}/#organization` };
const AUTHOR = { "@id": `${SITE.url}/#josh` };

const LEARN_URL = `${SITE.url}/learn`;
const GLOSSARY_URL = `${SITE.url}/learn/glossary`;
const RESOURCES_URL = `${SITE.url}/resources`;

type Crumb = { name: string; item: string };

function breadcrumbs(url: string, trail: readonly Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumbs`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
      ...trail.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: crumb.name,
        item: crumb.item,
      })),
    ],
  };
}

/* ── /learn ───────────────────────────────────────────────────────────────── */

export function buildLearnHubSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(LEARN_URL, [{ name: "Learn", item: LEARN_URL }]),
      {
        "@type": "ItemList",
        "@id": `${LEARN_URL}#articles`,
        name: "Vyso Learn articles",
        itemListElement: LEARN_ARTICLES.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: article.title,
          url: `${LEARN_URL}/${article.slug}`,
        })),
      },
    ],
  };
}

/* ── /learn/[slug] ────────────────────────────────────────────────────────────
   `Article`, not `BlogPosting`: these are reference pieces on one operational
   problem each, not dated posts in a stream. `about` is the article's own
   `about` string; `mentions` names the glossary terms the page links to, which
   is the same set the "Terms in this article" block renders.                 */

export function buildArticleSchema(article: LearnArticle) {
  const url = `${LEARN_URL}/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(url, [
        { name: "Learn", item: LEARN_URL },
        { name: article.title, item: url },
      ]),
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        datePublished: article.datePublished,
        dateModified: article.dateModified,
        inLanguage: "en-ZA",
        articleSection: article.category,
        author: AUTHOR,
        publisher: ORG,
        mainEntityOfPage: url,
        about: { "@type": "Thing", name: article.about },
        mentions: article.keyTerms.map((slug) => ({
          "@type": "DefinedTerm",
          "@id": `${GLOSSARY_URL}/${slug}#term`,
        })),
      },
    ],
  };
}

/* ── /learn/glossary ──────────────────────────────────────────────────────────
   One `DefinedTermSet` holding twelve `DefinedTerm`s. Each term's `@id` is the
   one its own page declares, so the hub and the term page describe the same
   node rather than two copies of it.                                         */

export function buildGlossaryHubSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(GLOSSARY_URL, [
        { name: "Learn", item: LEARN_URL },
        { name: "Glossary", item: GLOSSARY_URL },
      ]),
      {
        "@type": "DefinedTermSet",
        "@id": `${GLOSSARY_URL}#set`,
        name: GLOSSARY_HUB.title,
        description: GLOSSARY_HUB.description,
        url: GLOSSARY_URL,
        inLanguage: "en-ZA",
        publisher: ORG,
        hasDefinedTerm: GLOSSARY_ALPHABETICAL.map((term) => ({
          "@type": "DefinedTerm",
          "@id": `${GLOSSARY_URL}/${term.slug}#term`,
          name: term.term,
          description: firstSentence(term.definition[0]),
          url: `${GLOSSARY_URL}/${term.slug}`,
        })),
      },
    ],
  };
}

export function buildGlossaryTermSchema(term: GlossaryTerm) {
  const url = `${GLOSSARY_URL}/${term.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(url, [
        { name: "Learn", item: LEARN_URL },
        { name: "Glossary", item: GLOSSARY_URL },
        { name: term.term, item: url },
      ]),
      {
        "@type": "DefinedTerm",
        "@id": `${url}#term`,
        name: term.term,
        /* The full definition, not a trimmed one: the page's first block is
           the whole `description`, so an engine quoting the schema quotes what
           a reader sees. */
        description: term.definition.join(" "),
        url,
        inLanguage: "en-ZA",
        ...(term.aka && term.aka.length > 0 ? { alternateName: [...term.aka] } : {}),
        inDefinedTermSet: { "@id": `${GLOSSARY_URL}#set` },
      },
    ],
  };
}

/* ── /resources ───────────────────────────────────────────────────────────── */

export function buildResourcesHubSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(RESOURCES_URL, [{ name: "Resources", item: RESOURCES_URL }]),
      {
        "@type": "ItemList",
        "@id": `${RESOURCES_URL}#list`,
        name: "Vyso operations resources",
        itemListElement: RESOURCES.map((resource, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: resource.shortName,
          url: `${RESOURCES_URL}/${resource.slug}`,
        })),
      },
    ],
  };
}

/* `CreativeWork`, not `Offer` or `Product`: the resource is a document, it is
   free, and it is sent by a person rather than downloaded — so there is no
   price, no `availability` and deliberately no download URL to claim. */
export function buildResourceSchema(resource: Resource) {
  const url = `${RESOURCES_URL}/${resource.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbs(url, [
        { name: "Resources", item: RESOURCES_URL },
        { name: resource.shortName, item: url },
      ]),
      {
        "@type": "CreativeWork",
        "@id": `${url}#resource`,
        name: resource.shortName,
        description: resource.summary,
        url,
        inLanguage: "en-ZA",
        isAccessibleForFree: true,
        author: ORG,
        publisher: ORG,
      },
    ],
  };
}

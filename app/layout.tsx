import type { Metadata } from "next";
import { Barlow_Condensed, DM_Sans, IBM_Plex_Mono, Inter, Instrument_Sans, Space_Grotesk, STIX_Two_Text } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NavGround } from "@/components/finch/NavGround";
import { RouteFade } from "@/components/finch/RouteFade";
import { SkipLink } from "@/components/finch/SkipLink";
import { SmoothScroll } from "@/components/finch/SmoothScroll";
import { SITE } from "@/lib/marketing/site";
import "./globals.css";

/* ── Heading font: Barlow Condensed ──────────────────────────────────────── */
const barlowCondensed = Barlow_Condensed({
  variable: "--font-sans",    // kept as --font-sans for existing component compat
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700", "900"],
  display:  "swap",
});

/* ── Body font: DM Sans ───────────────────────────────────────────────────── */
const dmSans = DM_Sans({
  variable: "--font-body",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

/* ── Platform font: Inter (scoped to /login and /app via --font-inter) ─────── */
const inter = Inter({
  variable: "--font-inter",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

/* ── OrderFlow font pair: Instrument Sans (UI) + Space Grotesk (numerals) ──── */
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  display:  "swap",
});

// Space Grotesk only ever renders through `.of-num` / `.of-display` (globals.css).
// Every call site there is plain, font-medium or font-semibold — nothing bold —
// so 700 was downloaded on every page for no glyphs.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets:  ["latin"],
  weight:   ["400", "500", "600"],
  display:  "swap",
});

/* ── Finch marketing pair: STIX Two Text (editorial headings) + IBM Plex Mono ──
   (data/metadata labels). Loaded here rather than in the page so the variables
   sit on <html> alongside the others; only the `.finch-site` subtree reads them. */
const stixTwoText = STIX_Two_Text({
  variable: "--font-stix",
  subsets:  ["latin"],
  weight:   ["400", "500"],
  style:    ["normal", "italic"],
  display:  "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets:  ["latin"],
  weight:   ["400", "500"],
  display:  "swap",
});

/* Root metadata for the whole site. `title.template` means every page's own
   `title: "…"` string gets ` | Vyso` appended automatically — a page that
   wants a different final title (or already spells out "| Vyso" itself) must
   set `title: { absolute: "…" }` instead — `/finch` and `/operations-audit`
   are the pages that do. */
export const metadata: Metadata = {
  /* `.ai/plan_home_only.md`, change 2: the default title is the entity plus the
     category and the country, because `/` is the page that has to answer
     "AI automation agency South Africa" and the old default carried one
     product's headline. The template is unchanged, so every other page still
     appends " | Vyso". */
  title: {
    default: "Vyso, AI automation agency in South Africa",
    template: "%s | Vyso",
  },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  alternates: {
    canonical: "/",
    languages: {
      "en-ZA": "/",
      "x-default": "/",
    },
  },
  openGraph: {
    title: "Vyso, AI automation agency in South Africa",
    description: SITE.description,
    url:      SITE.url,
    siteName: SITE.name,
    locale:   "en_ZA",
    type:     "website",
    /* No `images` here, and none in any page's metadata either. `app/
       opengraph-image.tsx` and the per-segment generators under it produce the
       og:image tags through Next's file convention, which resolves the nearest
       image to the route being rendered — a hard-coded `images` array would
       override all of them with the one stale "Operations, connected." PNG.
       See `lib/og/render.tsx`. */
  },
  twitter: {
    card: "summary_large_image",
    title: "Vyso, AI automation agency in South Africa",
    description: SITE.description,
    /* Same reason: the file convention emits `twitter:image` too. */
  },
  /* Search Console / Bing Webmaster ownership tokens, read from env
     (`.ai/vyso_v2.md` §7.7 — "verified via metadata.verification").
     `.env.example` documents both. Omitted entirely (not emitted as an empty
     `content=""` meta tag) whichever one isn't set yet, rather than publish a
     verification tag with nothing to verify. */
  verification: {
    ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION
      ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION }
      : {}),
    ...(process.env.NEXT_PUBLIC_BING_VERIFICATION
      ? { other: { "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION } }
      : {}),
  },
};

/* ── Structured data graph ────────────────────────────────────────────────
   Four nodes: Organization (with its founder as a Person), WebSite, the
   ProfessionalService that says what kind of company this is, and the
   Operations Audit Service.

   `.ai/plan_vyso_redesign_2026.md` §8: the Finch `SoftwareApplication` node was
   removed here and the `ProfessionalService` took its place. Nothing public
   names Finch any more, and Vyso is a company that builds operational systems
   rather than a product with a page.

   `.ai/plan_home_only.md`, change 3: this graph used to read its figures from
   `components/finch/pricing/pricing-data.ts`, the constants `/pricing`'s own
   JSON-LD read. `/pricing` is deleted, and there are no monetary offers left
   in the site's structured data: the audit is genuinely free and says so with
   a zero-price `Offer`, and everything else is quoted per customer and per
   scope after that audit, which is not a number schema.org should be given.

   Pages that emit their own graph (`/operations-audit`) reference
   `#organization` rather than redeclaring it; no `@id` collides with this
   one. No address beyond Johannesburg/ZA (no street exists to publish) and
   no ratings, per the phase-1 decision. `sameAs` is included only once
   `SITE.sameAs` actually has entries — an empty array would misrepresent an
   absence of public profiles as a checked-and-empty list. */
const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      /* The category, said in the one field a knowledge panel reads it from.
         `description` says it in prose; `alternateName` is what an engine
         matches the category against when it is looking for an entity rather
         than a sentence. Repositioned with the site
         (`.ai/plan_vyso_redesign_2026.md` §2): Vyso is an AI operations
         company, not an automation agency and not a SaaS platform. */
      alternateName: "Vyso AI operations company",
      url: SITE.url,
      logo: `${SITE.url}/icon.svg`,
      description: SITE.description,
      email: SITE.email,
      founder: {
        "@type": "Person",
        "@id": `${SITE.url}/#josh`,
        name: SITE.founder.name,
        jobTitle: SITE.founder.jobTitle,
      },
      ...(SITE.sameAs.length > 0 ? { sameAs: SITE.sameAs } : {}),
      address: {
        "@type": "PostalAddress",
        addressLocality: SITE.address.addressLocality,
        addressCountry: SITE.address.addressCountry,
      },
      areaServed: {
        "@type": "Country",
        name: "South Africa",
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "sales",
        email: SITE.email,
        url: `${SITE.url}/contact`,
        areaServed: "ZA",
        availableLanguage: "en-ZA",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      inLanguage: "en-ZA",
      publisher: {
        "@id": `${SITE.url}/#organization`,
      },
    },
    {
      /* `.ai/plan_vyso_redesign_2026.md` §8. This node replaces the Finch
         `SoftwareApplication` that stood here: Vyso is not a software product
         with a page, it is a company that builds operational systems, and the
         schema type for that is `ProfessionalService`. Nothing public names
         Finch any more, so a `SoftwareApplication` node would have described an
         entity with no page behind it.

         `ProfessionalService` is a `LocalBusiness`, so it carries the same
         locality and country the Organization does rather than referring to
         them; `parentOrganization` is the link back, and the `@id` is distinct
         so nothing collides. No `priceRange`: the site publishes no fees, and
         inventing a band for a rich result is exactly the kind of number plan
         §3.1 forbids. */
      "@type": "ProfessionalService",
      "@id": `${SITE.url}/#professional-service`,
      name: "Vyso",
      url: SITE.url,
      email: SITE.email,
      description:
        "An AI operations company in Johannesburg: tailored operational systems that automate repetitive work, connect business data and flag what needs attention.",
      serviceType: "AI operations and automation",
      parentOrganization: { "@id": `${SITE.url}/#organization` },
      address: {
        "@type": "PostalAddress",
        addressLocality: SITE.address.addressLocality,
        addressCountry: SITE.address.addressCountry,
      },
      areaServed: {
        "@type": "Country",
        name: "South Africa",
      },
    },
    {
      /* The audit is free, so this is a real zero-price `Offer` rather than an
         omitted one: "free" is a claim worth making in structured data, and
         `price: "0"` is the valid way to make it. `priceCurrency` stays the ISO
         code "ZAR" because schema.org requires one alongside a price; the
         visible copy never says "ZAR". */
      "@type": "Service",
      "@id": `${SITE.url}/#audit`,
      name: "Free operations audit",
      serviceType: "AI automation consulting",
      description:
        "About an hour with a South African business owner, free: we find where money and time leak, then quote a fixed price per scope privately.",
      provider: { "@id": `${SITE.url}/#organization` },
      areaServed: "ZA",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "ZAR",
        availability: "https://schema.org/InStock",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZA"
      data-scroll-behavior="smooth"
      className={`${barlowCondensed.variable} ${dmSans.variable} ${inter.variable} ${instrumentSans.variable} ${spaceGrotesk.variable} ${stixTwoText.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* First tab stop on every page: jumps keyboard/screen-reader users
            past the nav to `#main` (each page's <main>). */}
        <SkipLink />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteSchema).replace(/</g, "\\u003c"),
          }}
        />
        {/* Phase 6a, `.ai/vyso_v3_design.md` §6/§8/§11 — three global mounts,
            all of them no-ops until something opts in:
            - `NavGround` watches for `data-ground` bands under the nav and
              inverts it. No page has a band yet (6b composes them), so it
              writes `paper` and nothing changes.
            - `RouteFade` fades the page in on navigation, first paint
              untouched.
            - `SmoothScroll` mounts Lenis. On by default since 2026-08-16
              (`localStorage["fn:lenis"] === "0"` is the opt-out the `/design`
              switch writes), and — since 2026-08-17 — MARKETING ROUTES ONLY.
              It is mounted here, above both surfaces, but it gates itself off
              under `/app/*`: the platform's scroller is a nested `<main>`, and
              a document-level Lenis ate the wheel event there and scrolled
              nothing. See that file's "Marketing only" docblock. */}
        <NavGround />
        <SmoothScroll />
        <RouteFade>{children}</RouteFade>
        {/* Phase 4, §7.7: Vercel Analytics + Speed Insights, site-wide. Both
            components are client-side and no-cookie-banner; `lib/analytics.ts`
            is the typed `track()` wrapper every custom event goes through. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

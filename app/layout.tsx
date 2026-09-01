import type { Metadata } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, Inter, Instrument_Sans, Space_Grotesk, STIX_Two_Text } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RouteFade } from "@/components/site/RouteFade";
import { SkipLink } from "@/components/site/SkipLink";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import { SITE } from "@/lib/marketing/site";
import "./globals.css";

/* ── Heading font: Barlow Condensed ──────────────────────────────────────── */
const barlowCondensed = Barlow_Condensed({
  variable: "--font-sans",    // kept as --font-sans for existing component compat
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700", "900"],
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
   set `title: { absolute: "…" }` instead. `/pricing` was the one page already
   shipping a self-contained "…| Vyso" title; it is trimmed to a plain string
   here so the template doesn't double the suffix (see that file's comment). */
export const metadata: Metadata = {
  title: {
    default: "Vyso — AI automation agency, Johannesburg",
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
    title: "Vyso — AI automation agency, Johannesburg",
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
    title: "Vyso — AI automation agency, Johannesburg",
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
   Agency repositioning (2026-09): Organization + WebSite + the agency's
   Service. The old SoftwareApplication (#finch) and Operations Audit Service
   nodes are gone with the product-first positioning — no prices are published
   anywhere on the site, so no Offer nodes either. Pages that emit their own
   graph reference `#organization` rather than redeclaring it. `sameAs` is
   included only once `SITE.sameAs` actually has entries. */
const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      description: SITE.description,
      url: SITE.url,
      logo: `${SITE.url}/icon.svg`,
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
        url: `${SITE.url}/about`,
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
      "@type": "Service",
      "@id": `${SITE.url}/#service`,
      name: "Custom AI automation",
      serviceType: "AI workflow automation",
      provider: { "@id": `${SITE.url}/#organization` },
      areaServed: "ZA",
      description:
        "Vyso maps a business's operation, finds the highest-value bottleneck, builds a custom AI workflow around the existing tools, and runs, monitors and improves it after launch — with human-approval steps on every outward action.",
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
      className={`${barlowCondensed.variable} ${inter.variable} ${instrumentSans.variable} ${spaceGrotesk.variable} ${stixTwoText.variable} ${ibmPlexMono.variable} h-full antialiased`}
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to THIS folder. Without this, a stray
  // ~/package-lock.json makes Next infer the home directory as the root, which
  // breaks module/path (@/*) resolution (see the "inferred workspace root" warning).
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Only pull the modules actually used from this large barrel-export package
    // (the animation runtime is on every marketing page). Must be a direct dep —
    // `framer-motion` is only a transitive dep of `motion` and is never imported
    // by name, so it's dropped. `lucide-react` and `@radix-ui/react-icons` were
    // dropped from this list in Phase 5 (`.ai/plan_phase5_deletions.md`) along
    // with the last files that imported them — see `.ai/implementation_phase5.md`.
    optimizePackageImports: ['motion'],
    // Client-side Router Cache lifetimes, in seconds. Defaults are dynamic: 0
    // (refetched on every navigation) and static: 300. Holding dynamic segments
    // for 30s makes back/forth between platform routes feel instant without
    // serving badly stale data; 180s on prefetched/static marketing pages is
    // shorter than the default so content edits surface sooner.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async redirects() {
    return [
      // Canonical host: redirect www.vyso.co.za → vyso.co.za (preserve path),
      // 308 permanent so search engines consolidate ranking on one domain.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.vyso.co.za" }],
        destination: "https://vyso.co.za/:path*",
        permanent: true,
      },
      // `/about` redirect removed (phase 3, Workstream C): the page is
      // rebuilt and returns again — see `app/about/page.tsx`.
      // `/platform` and its old product sub-pages consolidate onto the
      // homepage, which IS the product page (phase 1b). Exact-path sources
      // only — `/platform/modules*` is untouched and keeps its own tree.
      {
        source: "/platform",
        destination: "/",
        permanent: true,
      },
      {
        source: "/platform/finch",
        destination: "/",
        permanent: true,
      },
      {
        source: "/platform/vyso-for-smes",
        destination: "/",
        permanent: true,
      },
      // Old product codename slug.
      {
        source: "/platform/vyso-ai",
        destination: "/",
        permanent: true,
      },
      // `/finch` existed for one day in phase 1 and may have been shared; the
      // homepage absorbed it whole.
      {
        source: "/finch",
        destination: "/",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/platform/vyso-for-smes",
        permanent: true,
      },
      {
        source: "/services",
        destination: "/pricing",
        permanent: true,
      },
      // `/pricing-faq` content is absorbed into the "Pricing & terms" group
      // on `/faq` (group id `pricing` — see `lib/marketing/faq.ts`).
      {
        source: "/pricing-faq",
        destination: "/faq#pricing",
        permanent: true,
      },
      // The margin/time calculator lives under the audit page now. 6b sent this
      // to `/operations-audit#calculator`, an anchor two thirds of the way down
      // a booking page; 6b fixes r2 gave the tool a page of its own, so the
      // redirect points at the page rather than at a fragment. A 308 that lands
      // on a real URL is also the only version a search engine can consolidate.
      {
        source: "/roi-calculator",
        destination: "/operations-audit/calculator",
        permanent: true,
      },
      // The comparisons are named after the product now, not the company —
      // people search "Finch vs …", and Vyso is who invoices them. Content
      // ported page-for-page, so these are true equivalents (§3).
      {
        source: "/compare/vyso-vs-erp-systems",
        destination: "/compare/finch-vs-erp",
        permanent: true,
      },
      {
        source: "/compare/vyso-vs-spreadsheets",
        destination: "/compare/finch-vs-spreadsheets",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      // IndexNow key-file verification (`.ai/vyso_v2.md` §7.1): the protocol
      // requires the key published verbatim at `/{key}.txt`, which isn't a
      // real Next.js file convention and isn't knowable at build time (the
      // key is an env var, `INDEXNOW_KEY`). Rewritten to the API route rather
      // than a `[[...slug]]` catch-all, which would be far more invasive for
      // one file. Array rewrites are checked after the filesystem, so this
      // never shadows a real page (`/robots.txt`, `/llms.txt`, `/sitemap.xml`
      // all resolve first) — the route itself 404s on any `:key` that isn't
      // the configured `INDEXNOW_KEY`. See `app/api/indexnow/key/route.ts`.
      {
        source: "/:key.txt",
        destination: "/api/indexnow/key?key=:key",
      },
    ];
  },
};

export default nextConfig;

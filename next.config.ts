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
      // `.ai/plan_vyso_redesign_2026.md` §6/§11 (Phase 4): the full redirect
      // map for every route the 2026 redesign deletes. All permanent (308,
      // matching the rest of this file). No chains — every source below
      // resolves to a real, 200-returning page in one hop. Grouped in the
      // table's own order; see the plan for the full source-of-truth mapping.

      // `/finch`, `/platform*` and `/apps`: the old product/platform pages
      // consolidate onto `/how-it-works`, which explains the model and
      // absorbs the pricing-philosophy and compare-page intent (plan §7.2).
      {
        source: "/finch",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/platform",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/platform/finch",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/platform/vyso-for-smes",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/platform/vyso-ai",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/how-it-works",
        permanent: true,
      },
      // `/platform/modules` (the hub) also lands on `/how-it-works`; each
      // module codename below 301s to whichever new solution slug now covers
      // that capability (plan §6's per-module mapping).
      {
        source: "/platform/modules",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/platform/modules/orderflow",
        destination: "/solutions/whatsapp-order-automation",
        permanent: true,
      },
      {
        source: "/platform/modules/doc-u",
        destination: "/solutions/document-processing",
        permanent: true,
      },
      {
        source: "/platform/modules/procurepulse",
        destination: "/solutions/procurement-automation",
        permanent: true,
      },
      {
        source: "/platform/modules/pricepilot",
        destination: "/solutions/reduce-money-leakage",
        permanent: true,
      },
      {
        source: "/platform/modules/wastewatch",
        destination: "/solutions/reduce-money-leakage",
        permanent: true,
      },
      {
        source: "/platform/modules/supplysync",
        destination: "/solutions/inventory-automation",
        permanent: true,
      },
      {
        source: "/platform/modules/planwise",
        destination: "/solutions/reporting-automation",
        permanent: true,
      },
      {
        source: "/platform/modules/insightgen",
        destination: "/solutions/reporting-automation",
        permanent: true,
      },
      {
        source: "/platform/modules/shiftboard",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/platform/modules/serviceden",
        destination: "/how-it-works",
        permanent: true,
      },
      // `/pricing` is deleted. Nothing on the site publishes a price now:
      // pricing is per customer and per scope, quoted directly after the
      // free audit, so the page a visitor wants is the one that explains the
      // philosophy. `/services` and `/roi-calculator` are kept as they were.
      {
        source: "/pricing",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/services",
        destination: "/operations-audit",
        permanent: true,
      },
      // `/pricing-faq` content is absorbed into the "Pricing & terms" group
      // on `/faq` (group id `pricing` — see `lib/marketing/faq.ts`).
      {
        source: "/pricing-faq",
        destination: "/faq#pricing",
        permanent: true,
      },
      // The margin/time calculator lives under the audit page now.
      {
        source: "/roi-calculator",
        destination: "/operations-audit/calculator",
        permanent: true,
      },
      // `/founding-client`: the founding-cohort offer page is gone; the
      // audit is the conversion point now.
      {
        source: "/founding-client",
        destination: "/operations-audit",
        permanent: true,
      },
      // `/academy`: folded into Insights.
      {
        source: "/academy",
        destination: "/learn",
        permanent: true,
      },
      // `/compare` and all five variants (the two legacy `finch-vs-*` slugs
      // and the three `vyso-vs-*` aliases that used to chain through them)
      // now land directly on `/how-it-works`, which absorbs the compare-page
      // intent (plan §7.2) — no more two-hop chain through `/compare/finch-vs-*`.
      {
        source: "/compare",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/compare/finch-vs-hiring-a-coo",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/compare/finch-vs-spreadsheets",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/compare/finch-vs-erp",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/compare/vyso-vs-erp-systems",
        destination: "/how-it-works",
        permanent: true,
      },
      {
        source: "/compare/vyso-vs-spreadsheets",
        destination: "/how-it-works",
        permanent: true,
      },
      // The retired `/solutions/operations-dashboard` slug (Phase 2c) now
      // 301s to the slug that replaced it.
      {
        source: "/solutions/operations-dashboard",
        destination: "/solutions/reporting-automation",
        permanent: true,
      },
      // The five industry verticals trimmed in Phase 2d fold into whichever
      // of the three surviving verticals (or the hub) covers them.
      {
        source: "/industries/restaurants",
        destination: "/industries/hospitality",
        permanent: true,
      },
      {
        source: "/industries/catering-companies",
        destination: "/industries/hospitality",
        permanent: true,
      },
      {
        source: "/industries/farms",
        destination: "/industries/food-suppliers",
        permanent: true,
      },
      {
        source: "/industries/security-companies",
        destination: "/industries",
        permanent: true,
      },
      {
        source: "/industries/insurance-brokers",
        destination: "/industries",
        permanent: true,
      },
      // `/insights` is a nav LABEL only (plan §5) — the URLs stay `/learn/**`
      // for SEO equity, so a visitor who types the literal label lands there.
      {
        source: "/insights",
        destination: "/learn",
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

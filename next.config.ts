import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to THIS folder. Without this, a stray
  // ~/package-lock.json makes Next infer the home directory as the root, which
  // breaks module/path (@/*) resolution (see the "inferred workspace root" warning).
  turbopack: {
    root: __dirname,
    // The verified ThreeUI sources (`src/shaders/**`, see
    // `.ai/threeui_source_record.md`) import their sandboxed effect documents
    // as `./sources/*.html?raw` (Vite idiom). Turbopack 16.2 resolves the same
    // idiom natively via a `raw` module-type rule scoped to the `?raw` query.
    rules: {
      // Only the ThreeUI effect documents are ever imported as .html, always
      // with `?raw`. Loader form (raw-loader → JS module) — the `type: "raw"`
      // module-type form silently compiled these imports to `void 0` in
      // 16.2.7. Both glob keys are registered because the matcher's treatment
      // of the `?raw` query suffix differs across versions.
      // The label loader applies the site's CTA text to the registered plasma
      // source at build time (no-op for every other document) — see
      // scripts/vyso-plasma-label.loader.cjs.
      "*.html": {
        loaders: ["./scripts/vyso-plasma-label.loader.cjs", "raw-loader"],
        as: "*.js",
      },
      "*.html?raw": {
        loaders: ["./scripts/vyso-plasma-label.loader.cjs", "raw-loader"],
        as: "*.js",
      },
    },
  },
  webpack(config) {
    // Same `?raw` support for the webpack fallback (`npm run dev:webpack`),
    // including the plasma label transform.
    config.module.rules.push({
      resourceQuery: /raw/,
      type: "asset/source",
      use: ["./scripts/vyso-plasma-label.loader.cjs"],
    });
    return config;
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
      /* ── Agency redesign redirect map (2026-09) ──────────────────────────
         `.ai/positioning_agency_2026.md`. Every removed route lands on the
         closest surviving page; nothing 404s. Conversion-shaped pages → /join;
         explanation-shaped pages → /automations; company-shaped → /about.
         The Turn 'n Slice case study redirects to the food-business page per
         the removal protocol (no current-case-study claims anywhere). */
      { source: "/pricing", destination: "/join", permanent: true },
      { source: "/operations-audit", destination: "/join", permanent: true },
      { source: "/operations-audit/:path*", destination: "/join", permanent: true },
      { source: "/founding-client", destination: "/join", permanent: true },
      { source: "/academy", destination: "/join", permanent: true },
      { source: "/contact", destination: "/about", permanent: true },
      { source: "/south-africa", destination: "/about", permanent: true },
      { source: "/faq", destination: "/automations", permanent: true },
      { source: "/learn", destination: "/automations", permanent: true },
      { source: "/learn/:path*", destination: "/automations", permanent: true },
      { source: "/resources", destination: "/automations", permanent: true },
      { source: "/resources/:path*", destination: "/automations", permanent: true },
      { source: "/compare", destination: "/automations", permanent: true },
      { source: "/compare/:path*", destination: "/automations", permanent: true },
      { source: "/solutions", destination: "/industries", permanent: true },
      { source: "/solutions/:path*", destination: "/industries", permanent: true },
      { source: "/case-studies", destination: "/industries/food-hospitality", permanent: true },
      { source: "/case-studies/:path*", destination: "/industries/food-hospitality", permanent: true },
      { source: "/orbit/waitlist", destination: "/join", permanent: true },
      { source: "/orbit", destination: "/", permanent: true },
      { source: "/orbit/:path*", destination: "/", permanent: true },
      // Old per-vertical industry pages → the three new pages (or the hub).
      {
        source: "/industries/:slug(food-suppliers|farms|restaurants|catering-companies|wholesale|hospitality)",
        destination: "/industries/food-hospitality",
        permanent: true,
      },
      { source: "/industries/insurance-brokers", destination: "/industries/insurance", permanent: true },
      { source: "/industries/security-companies", destination: "/industries", permanent: true },
      { source: "/design", destination: "/", permanent: true },
      // `/about` redirect removed (phase 3, Workstream C): the page is
      // rebuilt and returns again — see `app/about/page.tsx`.
      { source: "/platform", destination: "/", permanent: true },
      { source: "/platform/:path*", destination: "/automations", permanent: true },
      // `/finch` existed for one day in phase 1 and may have been shared; the
      // homepage absorbed it whole.
      {
        source: "/finch",
        destination: "/",
        permanent: true,
      },
      {
        source: "/apps",
        destination: "/",
        permanent: true,
      },
      {
        source: "/services",
        destination: "/join",
        permanent: true,
      },
      // `/pricing-faq` content is absorbed into the "Pricing & terms" group
      // on `/faq` (group id `pricing` — see `lib/marketing/faq.ts`).
      {
        source: "/pricing-faq",
        destination: "/join",
        permanent: true,
      },
      // The margin/time calculator lives under the audit page now. 6b sent this
      // to `/operations-audit#calculator`, an anchor two thirds of the way down
      // a booking page; 6b fixes r2 gave the tool a page of its own, so the
      // redirect points at the page rather than at a fragment. A 308 that lands
      // on a real URL is also the only version a search engine can consolidate.
      {
        source: "/roi-calculator",
        destination: "/join",
        permanent: true,
      },
    ];
  },
  // PostHog's SDK strips trailing slashes from its own calls; without this the
  // host-level redirect breaks `/ingest` batching (PostHog reverse-proxy docs).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // PostHog EU reverse proxy — `instrumentation-client.ts` initialises the
      // SDK with `api_host: "/ingest"`; these two rewrites are its server half
      // (without them every capture 404s into the site's own routes).
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
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

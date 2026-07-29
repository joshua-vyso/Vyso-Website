import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to THIS folder. Without this, a stray
  // ~/package-lock.json makes Next infer the home directory as the root, which
  // breaks module/path (@/*) resolution (see the "inferred workspace root" warning).
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Only pull the modules actually used from these large barrel-export packages
    // (the animation runtime is on every marketing page, lucide-react ships ~1.5k
    // icon modules). Listed packages must be direct deps — `framer-motion` is only
    // a transitive dep of `motion` and is never imported by name, so it's dropped.
    optimizePackageImports: ['motion', 'lucide-react', '@radix-ui/react-icons'],
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
      // Retired marketing URLs now consolidate on their canonical replacements.
      {
        source: "/about",
        destination: "/platform",
        permanent: true,
      },
      // Finch rebrand (was "Vyso AI").
      {
        source: "/platform/vyso-ai",
        destination: "/platform/finch",
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
    ];
  },
};

export default nextConfig;

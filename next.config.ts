import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway runs the standalone server (see Dockerfile).
  output: "standalone",
  // Dev-only badge: keep it off the sidebar's user menu (bottom left).
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Off: on Next 16.4.6, with the saved Turbopack dev cache on, some `next dev`
    // restarts left pages reloading themselves in a loop (every HMR subscription
    // answered "restart"); with it off, restarts were clean. Costs a few seconds
    // of cold compile per dev start. Production builds are unaffected.
    turbopackFileSystemCacheForDev: false,
  },
  cacheComponents: true,
  // Analytics keeps each page's numbers and rendered HTML in memory, per range, for the day
  // (see lib/analytics/index.ts). The default 50 MB would evict them silently; /api/cron/warm
  // reports heap use so this can be checked against the real figure.
  cacheMaxMemorySize: 256 * 1024 * 1024,
  partialPrefetching: true,
  // Embedded Postgres for local development ships a WASM build; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  async redirects() {
    return [{ source: "/", destination: "/analytics", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

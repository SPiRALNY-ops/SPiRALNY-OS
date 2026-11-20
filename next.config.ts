import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Railway runs the standalone server (see Dockerfile).
  output: "standalone",
  cacheComponents: true,
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

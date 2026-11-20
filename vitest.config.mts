import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
      // `server-only` throws outside React Server Components; tests run plain Node.
      "server-only": path.join(import.meta.dirname, "test/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 30_000,
  },
});

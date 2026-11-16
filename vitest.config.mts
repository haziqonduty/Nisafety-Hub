import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Run through `npm test` (scripts/run-vitest.mjs), not `npx vitest`
// directly — see the note there about Windows drive letters.
const src = fileURLToPath(new URL("./src", import.meta.url));
const emptyModule = fileURLToPath(new URL("./tests/empty-module.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Only "@/…" (the app's path alias) — a bare "@" would also catch
      // scoped packages like @vitest/runner.
      { find: /^@\//, replacement: `${src}/` },
      // "server-only" throws outside a React Server Component build; the
      // modules under test are plain functions, so stub it out.
      { find: /^server-only$/, replacement: emptyModule },
    ],
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["src/**/*.test.ts"] },
      },
      {
        // Needs the app running (npm run build && npm start) — see tests/README.md.
        extends: true,
        test: { name: "security", include: ["tests/security/**/*.test.ts"], testTimeout: 20_000 },
      },
    ],
  },
});

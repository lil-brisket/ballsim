import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Test tiers (Phase 5):
 * - unit: milliseconds (default with integration in `npm test`)
 * - integration: seconds (one game / week / season-scale unit suites)
 * - regression: minutes (multi-year, economy, league-sanity) via `npm run test:regression`
 * - stress: opt-in via STRESS=1 inside specific files
 *
 * `npm run test:all` runs every project including regression.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/generated/**", "src/app/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
          ],
          exclude: [
            "tests/**/*.test.tsx",
            "tests/application/multi-year-simulation*.test.ts",
            "tests/persistence/migration-multi-year.test.ts",
            "tests/systems/economic-scenarios.test.ts",
            "tests/simulation/league-sanity/**",
            "tests/application/owner-vertical-slice.test.ts",
            "tests/systems/season-simulation.test.ts",
            "tests/systems/playoffs-integration.test.ts",
            "tests/systems/simulation/season-lifecycle.test.ts",
            "tests/systems/simulation/performance-budget.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: [
            "tests/systems/season-simulation.test.ts",
            "tests/systems/playoffs-integration.test.ts",
            "tests/systems/simulation/season-lifecycle.test.ts",
            "tests/systems/simulation/performance-budget.test.ts",
            "tests/application/owner-vertical-slice.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "regression",
          environment: "node",
          include: [
            "tests/application/multi-year-simulation*.test.ts",
            "tests/persistence/migration-multi-year.test.ts",
            "tests/systems/economic-scenarios.test.ts",
            "tests/simulation/league-sanity/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          environment: "jsdom",
          include: ["tests/**/*.test.tsx"],
        },
      },
    ],
  },
});

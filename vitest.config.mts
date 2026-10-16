import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Test tiers (Phase 5):
 * - unit: milliseconds (default with integration in `npm test`)
 * - integration: seconds (one game / week / season-scale unit suites)
 * - slow: any `*.slow.test.ts` under tests/, single tests that take minutes but must
 *   still gate PRs, via `npm run test:slow` (own PR CI job)
 * - regression: minutes (multi-year, economy, league-sanity) via `npm run test:regression`
 * - simulation: Lab 100-game / season-RNG batches via `npm run test:simulation` (PR CI)
 * - stress: opt-in via STRESS=1 inside specific files
 *
 * `npm test` excludes slow, simulation and regression. `npm run test:all` runs every project.
 * Keep unit tests under the 30s default; tests that need a longer timeout belong in another tier.
 */
export default defineConfig({
  plugins: [react()],
  // Native `@/*` alias resolution. Replaces the vite-tsconfig-paths plugin,
  // whose single stateful instance was shared (and reset) across every
  // project's Vite server (issue #96).
  resolve: { tsconfigPaths: true },
  test: {
    // Season/world pipeline tests take 3-8s under parallel load; 5s default flakes.
    testTimeout: 30_000,
    reporters: ["default", "./scripts/vitest-txt-reporter.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/generated/**", "src/app/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: [
            "tests/**/*.test.tsx",
            "tests/**/*.slow.test.ts",
            "tests/application/multi-year-simulation*.test.ts",
            "tests/persistence/migration-multi-year.test.ts",
            "tests/systems/economic-scenarios.test.ts",
            "tests/simulation/league-sanity/**",
            "tests/systems/season-simulation.test.ts",
            "tests/systems/playoffs-integration.test.ts",
            "tests/systems/simulation/season-lifecycle.test.ts",
            "tests/systems/simulation/performance-budget.test.ts",
            "tests/systems/trades/thirty-team-trade-invariants.test.ts",
            "tests/systems/player-generation.test.ts",
            "tests/systems/fantasy-draft/fantasy-draft.test.ts",
            "tests/systems/fantasy-draft/fantasy-draft-analysis.test.ts",
            "tests/systems/season-events/season-events-cycle.test.ts",
            "tests/systems/season-events/season-events-e2e.test.ts",
            "tests/systems/season-events/season-events-foundation.test.ts",
            "tests/systems/simulation/multi-year-calendar-driven.test.ts",
            "tests/application/time-advance-commit-guard.test.ts",
            "tests/simulation/lab/simulate-game-box-score-allocator.test.ts",
            "tests/simulation/lab/invariants-hard.test.ts",
            "tests/simulation/lab/fidelity-parity.test.ts",
            "tests/simulation/lab/season-fidelity.test.ts",
            "tests/simulation/lab/simulate-game-pbt.test.ts",
            "tests/simulation/lab/simulate-game-box-score-stats.test.ts",
            "tests/simulation/lab/season-rng-desync.test.ts",
            "tests/simulation/lab/long-horizon.test.ts",
            "tests/regression/**",
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
            "tests/systems/trades/thirty-team-trade-invariants.test.ts",
            "tests/systems/player-generation.test.ts",
            "tests/systems/fantasy-draft/fantasy-draft.test.ts",
            "tests/systems/fantasy-draft/fantasy-draft-analysis.test.ts",
            "tests/systems/season-events/season-events-cycle.test.ts",
            "tests/systems/season-events/season-events-e2e.test.ts",
            "tests/systems/season-events/season-events-foundation.test.ts",
            "tests/systems/simulation/multi-year-calendar-driven.test.ts",
            "tests/application/time-advance-commit-guard.test.ts",
            "tests/simulation/lab/simulate-game-box-score-allocator.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "slow",
          environment: "node",
          // Tests here may run for minutes. The world-pipeline RNG test takes
          // 22-40s on CI, so the 30s default timed it out.
          testTimeout: 120_000,
          include: ["tests/**/*.slow.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "regression",
          environment: "node",
          // Every file here simulates whole seasons on one core. At the default
          // (cores - 1) workers they starve each other and the multi-year suites
          // overrun their 600s timeouts (issue #87).
          maxWorkers: 4,
          include: [
            "tests/application/multi-year-simulation*.test.ts",
            "tests/persistence/migration-multi-year.test.ts",
            "tests/systems/economic-scenarios.test.ts",
            "tests/simulation/league-sanity/**/*.test.ts",
            "tests/regression/**/*.test.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "simulation",
          environment: "node",
          include: [
            "tests/simulation/lab/invariants-hard.test.ts",
            "tests/simulation/lab/fidelity-parity.test.ts",
            "tests/simulation/lab/season-fidelity.test.ts",
            "tests/simulation/lab/simulate-game-pbt.test.ts",
            "tests/simulation/lab/simulate-game-box-score-stats.test.ts",
            "tests/simulation/lab/season-rng-desync.test.ts",
            "tests/simulation/lab/long-horizon.test.ts",
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

/**
 * Soft performance regression budgets.
 * Warns (does not hard-fail) when timings exceed aspirational tiers by a wide margin.
 * Absolute ceilings use generous headroom for CI machine variance.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asGameId, asSeasonId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { generateValidationRosters } from "@/simulation/validation";
import { simulateGame } from "@/systems/game-simulation";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  createSimulationProfiler,
} from "@/systems/simulation/simulation-profiler";
import { bootstrapWorld } from "@/systems/world-pipeline";

/** Soft warn threshold: production game should be comfortably sub-second (Tier 1). */
const GAME_TIER1_MS = 1000;
/** Soft warn: regular season week (~7 days) should finish quickly after optimizations. */
const WEEK_SOFT_MS = 30_000;

describe("simulation performance budgets (soft)", () => {
  it(
    "production-length game stays under Tier 1 (sub-second) soft ceiling",
    () => {
      const rng = createSeededRng(42);
      const { homePlayers, awayPlayers } = generateValidationRosters(rng, 10);
      const game = createGame({
        competitionType: "regular_season",
        homeTeamSnapshot: null,
        awayTeamSnapshot: null,
        id: asGameId("perf_game"),
        seasonId: asSeasonId("perf_season"),
        homeTeamId: homePlayers[0]!.teamId!,
        awayTeamId: awayPlayers[0]!.teamId!,
        date: "2026-10-15",
        status: "scheduled",
        score: { home: 0, away: 0 },
        periodScores: [],
        events: [],
        playerStats: [],
      });

      const profiler = createSimulationProfiler();
      const start = performance.now();
      simulateGame(
        game,
        {
          homePlayers,
          awayPlayers,
          profiler,
        },
        rng,
      );
      const elapsed = performance.now() - start;
      const cost = profiler.snapshotGames()[0];

      // Soft regression: log when over aspirational Tier 2 (200ms)
      if (elapsed > 200) {
        console.warn(
          `[perf] production game ${elapsed.toFixed(1)}ms (Tier 2 target <200ms; cost=${JSON.stringify(cost)})`,
        );
      }

      expect(elapsed).toBeLessThan(GAME_TIER1_MS);
    },
    15_000,
  );

  it(
    "7-day CBL advance stays under soft week ceiling",
    () => {
      let state = createInitialGameState({
        saveId: "perf_week",
        rngSeed: 11,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      state = {
        ...state,
        meta: { ...state.meta, rngState: rng.getState() },
      };

      // Jump calendar to first scheduled game date when available
      const firstGame = Object.values(state.competition.games).sort((a, b) =>
        a.date.localeCompare(b.date),
      )[0];
      if (firstGame) {
        state = {
          ...state,
          world: {
            ...state.world,
            calendar: {
              ...state.world.calendar,
              currentDate: firstGame.date,
              lastSimulatedDate: null,
            },
          },
          competition: {
            ...state.competition,
            season: {
              ...state.competition.season,
              phase: "regular",
            },
          },
        };
      }

      const start = performance.now();
      const result = advanceSimulation(state, rng, { days: 7 });
      const elapsed = performance.now() - start;

      if (elapsed > WEEK_SOFT_MS * 0.5) {
        console.warn(
          `[perf] 7-day advance ${elapsed.toFixed(0)}ms (games=${result.gamesSimulated})`,
        );
      }

      expect(elapsed).toBeLessThan(WEEK_SOFT_MS);
      expect(result.daysAdvanced).toBe(7);
    },
    60_000,
  );
});

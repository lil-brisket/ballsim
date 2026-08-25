/**
 * CLI: simulation performance benchmark + cost model.
 *
 * Usage:
 *   npx tsx scripts/benchmark-simulation.ts
 *   npx tsx scripts/benchmark-simulation.ts --season
 *   npx tsx scripts/benchmark-simulation.ts --games-only
 *   npx tsx scripts/benchmark-simulation.ts --until-phase
 */

import { createGame } from "@/domain/entities/game";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { generateValidationRosters } from "@/simulation/validation";
import { simulateGame } from "@/systems/game-simulation";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import {
  averageGameCost,
  createSimulationProfiler,
  formatGameCostModel,
  formatSeasonProfiler,
} from "@/systems/simulation/simulation-profiler";
import { bootstrapWorld } from "@/systems/world-pipeline";

function parseArgs(argv: string[]): {
  season: boolean;
  gameOnly: boolean;
  untilPhase: boolean;
} {
  const hasFlags =
    argv.includes("--season") ||
    argv.includes("--game-only") ||
    argv.includes("--until-phase");
  return {
    season: argv.includes("--season") || !hasFlags,
    gameOnly: argv.includes("--game-only"),
    untilPhase: argv.includes("--until-phase"),
  };
}

function scheduledGame(homeTeamId: ReturnType<typeof asTeamId>, awayTeamId: ReturnType<typeof asTeamId>) {
  return createGame({
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId("bench_game_1"),
    seasonId: asSeasonId("season_bench"),
    homeTeamId,
    awayTeamId,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

function runGameScaling(): void {
  const periods = [24, 120, 720] as const;

  console.log("\n=== Game cost model (period length scaling) ===\n");
  for (const periodSeconds of periods) {
    const profiler = createSimulationProfiler();
    const rng = createSeededRng(42);
    const { homePlayers, awayPlayers } = generateValidationRosters(rng, 10);
    simulateGame(
      scheduledGame(homePlayers[0]!.teamId!, awayPlayers[0]!.teamId!),
      {
        homePlayers,
        awayPlayers,
        config: {
          regulationPeriodSeconds: periodSeconds,
          overtimePeriodSeconds: Math.max(6, Math.floor(periodSeconds / 4)),
        },
        profiler,
      },
      rng,
    );
    const games = profiler.snapshotGames();
    const cost = games[0];
    if (cost == null) {
      continue;
    }
    console.log(`Period seconds: ${periodSeconds}`);
    console.log(formatGameCostModel(cost));
    console.log("");
  }
}

function runSeasonBenchmark(): void {
  console.log("\n=== Full CBL season (day-by-day advance) ===\n");
  let state = createInitialGameState({
    saveId: "bench_season",
    rngSeed: 42,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = {
    ...state,
    meta: { ...state.meta, rngState: rng.getState() },
  };

  const profiler = createSimulationProfiler();
  const startPhase = state.competition.season.phase;
  let days = 0;
  const maxDays = 500;
  const seasonStart = performance.now();
  let sawRegular = startPhase === "regular";
  let leftRegular = false;

  while (days < maxDays) {
    const phaseBefore = state.competition.season.phase;
    const result = advanceSimulation(state, rng, {
      days: 1,
      profiler,
    });
    state = result.state;
    days += 1;
    state = {
      ...state,
      meta: { ...state.meta, rngState: rng.getState() },
    };

    if (state.competition.season.phase === "regular") {
      sawRegular = true;
    }
    if (
      sawRegular &&
      phaseBefore === "regular" &&
      state.competition.season.phase !== "regular"
    ) {
      leftRegular = true;
    }
    // Stop once we have completed regular + playoffs into postseason/offseason
    if (
      leftRegular &&
      (state.competition.season.phase === "postseason" ||
        state.competition.season.phase === "offseason")
    ) {
      break;
    }
  }

  const wallMs = performance.now() - seasonStart;
  const season = profiler.snapshotSeason();
  console.log(formatSeasonProfiler({ ...season, totalMs: wallMs }));
  const avg = averageGameCost(profiler.snapshotGames());
  if (avg) {
    console.log("\nAverage game cost:");
    console.log(formatGameCostModel(avg));
  }
  console.log(`\nFinal phase: ${state.competition.season.phase}`);
  console.log(`Days advanced: ${days}`);
}

function runUntilPhaseAudit(): void {
  console.log("\n=== until_phase (days: 400) audit ===\n");
  let state = createInitialGameState({
    saveId: "bench_until",
    rngSeed: 99,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = {
    ...state,
    meta: { ...state.meta, rngState: rng.getState() },
  };

  const requested = 400;
  const identityBefore = `${state.competition.season.phase}|${state.competition.season.offseasonStage}|${state.competition.season.year}`;
  const start = performance.now();
  const result = advanceSimulation(state, rng, {
    days: requested,
    stopOnPhaseChange: true,
  });
  const elapsed = performance.now() - start;
  console.log(`Identity before: ${identityBefore}`);
  console.log(
    `Identity after:  ${result.state.competition.season.phase}|${result.state.competition.season.offseasonStage}|${result.state.competition.season.year}`,
  );
  console.log(`Requested days:  ${requested}`);
  console.log(`Actual days:     ${result.daysAdvanced}`);
  console.log(`Games simulated: ${result.gamesSimulated}`);
  console.log(`Elapsed:         ${(elapsed / 1000).toFixed(2)}s`);
  console.log(
    `Stopped early:   ${result.daysAdvanced < requested ? "yes" : "no"}`,
  );
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.gameOnly) {
    runGameScaling();
    return;
  }

  runGameScaling();
  if (args.untilPhase) {
    runUntilPhaseAudit();
  }
  if (args.season) {
    runSeasonBenchmark();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Benchmark failed: ${message}`);
  process.exitCode = 1;
}

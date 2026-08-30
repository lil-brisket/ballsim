/**
 * Multi-season injury simulation analysis for tuning.
 *
 * Usage: npx tsx scripts/injury-simulation-analysis.ts
 */

import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import type { GameState } from "@/state/game-state";

type Counters = {
  totalInjuries: number;
  bySeverity: Record<string, number>;
  byBodyPart: Record<string, number>;
  byExposure: Record<string, number>;
  reinjuries: number;
  aggravations: number;
  longTerm: number;
  gamesMissedTotal: number;
  teamGames: number;
  peakInjuredOnTeam: number;
  byAgeBracket: Record<string, number>;
  byDurabilityBracket: Record<string, number>;
};

function emptyCounters(): Counters {
  return {
    totalInjuries: 0,
    bySeverity: {},
    byBodyPart: {},
    byExposure: {},
    reinjuries: 0,
    aggravations: 0,
    longTerm: 0,
    gamesMissedTotal: 0,
    teamGames: 0,
    peakInjuredOnTeam: 0,
    byAgeBracket: {},
    byDurabilityBracket: {},
  };
}

function ageBracket(age: number): string {
  if (age < 23) return "19-22";
  if (age < 27) return "23-26";
  if (age < 31) return "27-30";
  if (age < 35) return "31-34";
  return "35+";
}

function durabilityBracket(d: number): string {
  if (d < 45) return "low";
  if (d < 65) return "mid";
  if (d < 80) return "high";
  return "elite";
}

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function snapshotInjuries(state: GameState, counters: Counters): void {
  for (const team of Object.values(state.world.teams)) {
    let injured = 0;
    for (const playerId of team.roster) {
      const player = state.world.players[playerId];
      if (player == null) continue;
      const active = player.activeInjuries ?? [];
      if (active.length > 0 || player.availability === "out") injured += 1;
    }
    counters.peakInjuredOnTeam = Math.max(counters.peakInjuredOnTeam, injured);
  }
}

function observeEvents(
  events: Array<{ type: string; payload: Record<string, unknown> }>,
  state: GameState,
  counters: Counters,
): void {
  for (const event of events) {
    if (event.type === "PlayerInjured") {
      counters.totalInjuries += 1;
      bump(counters.bySeverity, String(event.payload.severity ?? "unknown"));
      bump(counters.byBodyPart, String(event.payload.bodyPart ?? "unknown"));
      bump(
        counters.byExposure,
        String(event.payload.exposureSource ?? "unknown"),
      );
      if (event.payload.isReinjury === true) counters.reinjuries += 1;
      if (event.payload.isAggravation === true) counters.aggravations += 1;

      const playerId = String(event.payload.playerId ?? "");
      const player = state.world.players[playerId as never];
      if (player) {
        bump(counters.byAgeBracket, ageBracket(player.age));
        bump(
          counters.byDurabilityBracket,
          durabilityBracket(player.physical?.durability ?? 60),
        );
      }
    }
    if (event.type === "GameCompleted") {
      counters.teamGames += 1;
    }
  }
}

function countLongTerm(state: GameState, counters: Counters): void {
  for (const player of Object.values(state.world.players)) {
    for (const entry of player.injuryHistory ?? []) {
      if (entry.hadLongTermEffect) counters.longTerm += 1;
      counters.gamesMissedTotal += entry.gamesMissed;
    }
  }
}

function main(): void {
  const days = Number(process.env.INJURY_ANALYSIS_DAYS ?? 60);
  const seed = Number(process.env.INJURY_ANALYSIS_SEED ?? 2026);
  let state = createInitialGameState({
    rngSeed: seed,
    saveId: "injury_analysis",
  });
  state = {
    ...state,
    settings: {
      ...state.settings,
      injuryFrequency: "high",
    },
  };

  const rng = createSeededRng(state.meta.rngState);
  const counters = emptyCounters();

  for (let day = 0; day < days; day++) {
    const result = advanceSimulation(state, rng, { days: 1 });
    state = result.state;
    state = {
      ...state,
      meta: { ...state.meta, rngState: rng.getState() },
    };
    observeEvents(result.events, state, counters);
    snapshotInjuries(state, counters);
  }
  countLongTerm(state, counters);

  const perTeamGame =
    counters.teamGames > 0
      ? counters.totalInjuries / counters.teamGames
      : null;

  const report = {
    days,
    seed,
    totalInjuries: counters.totalInjuries,
    injuriesPerTeamGame: perTeamGame,
    bySeverity: counters.bySeverity,
    byBodyPart: counters.byBodyPart,
    byExposure: counters.byExposure,
    byAgeBracket: counters.byAgeBracket,
    byDurabilityBracket: counters.byDurabilityBracket,
    reinjuryPercentage:
      counters.totalInjuries > 0
        ? counters.reinjuries / counters.totalInjuries
        : 0,
    aggravationPercentage:
      counters.totalInjuries > 0
        ? counters.aggravations / counters.totalInjuries
        : 0,
    longTermCount: counters.longTerm,
    avgGamesMissed:
      counters.totalInjuries > 0
        ? counters.gamesMissedTotal / Math.max(1, counters.totalInjuries)
        : 0,
    peakInjuredOnTeam: counters.peakInjuredOnTeam,
    sanityFlags: {
      tooManyInjuredOnTeam: counters.peakInjuredOnTeam >= 9,
      zeroInjuries: counters.totalInjuries === 0,
    },
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
}

main();

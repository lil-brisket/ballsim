/**
 * Hierarchical timing helpers for simulation performance investigation.
 * Opt-in: production paths leave the profiler unset (zero overhead).
 */

export type GameSimCostModel = {
  possessions: number;
  events: number;
  playersInvolved: number;
  totalMs: number;
  validationMs: number;
  decisionSelectionMs: number;
  statsMs: number;
  resolutionMs: number;
  otherMs: number;
  msPerPossession: number;
  msPerEvent: number;
};

export type SeasonProfilerBuckets = {
  totalMs: number;
  days: number;
  gamesSimulated: number;
  gameSimMs: number;
  standingsMs: number;
  ownerGameplayMs: number;
  ticketsMs: number;
  mediaMs: number;
  narrativeMs: number;
  weeklyMs: number;
  monthlyMs: number;
  lifecycleMs: number;
  otherDayMs: number;
  playoffGames: number;
};

export type SimulationProfiler = {
  recordGame(cost: GameSimCostModel): void;
  addSeason(bucket: keyof Omit<SeasonProfilerBuckets, "totalMs" | "days" | "gamesSimulated" | "playoffGames">, ms: number): void;
  bumpDay(): void;
  bumpGames(count: number): void;
  bumpPlayoffGames(count: number): void;
  snapshotSeason(): SeasonProfilerBuckets;
  snapshotGames(): GameSimCostModel[];
};

function emptySeason(): SeasonProfilerBuckets {
  return {
    totalMs: 0,
    days: 0,
    gamesSimulated: 0,
    gameSimMs: 0,
    standingsMs: 0,
    ownerGameplayMs: 0,
    ticketsMs: 0,
    mediaMs: 0,
    narrativeMs: 0,
    weeklyMs: 0,
    monthlyMs: 0,
    lifecycleMs: 0,
    otherDayMs: 0,
    playoffGames: 0,
  };
}

export function createSimulationProfiler(): SimulationProfiler {
  const games: GameSimCostModel[] = [];
  const season = emptySeason();
  const startedAt = performance.now();

  return {
    recordGame(cost) {
      games.push(cost);
    },
    addSeason(bucket, ms) {
      season[bucket] += ms;
    },
    bumpDay() {
      season.days += 1;
    },
    bumpGames(count) {
      season.gamesSimulated += count;
    },
    bumpPlayoffGames(count) {
      season.playoffGames += count;
    },
    snapshotSeason() {
      return {
        ...season,
        totalMs: performance.now() - startedAt,
      };
    },
    snapshotGames() {
      return games.map((game) => ({ ...game }));
    },
  };
}

export function formatGameCostModel(cost: GameSimCostModel): string {
  return [
    "Game simulation",
    "----------------",
    `Possessions:         ${cost.possessions}`,
    `Events:              ${cost.events}`,
    `Players:             ${cost.playersInvolved}`,
    `Simulation:          ${cost.totalMs.toFixed(1)}ms`,
    `Validation:          ${cost.validationMs.toFixed(1)}ms`,
    `Decision selection:  ${cost.decisionSelectionMs.toFixed(1)}ms`,
    `Resolution:          ${cost.resolutionMs.toFixed(1)}ms`,
    `Stats:               ${cost.statsMs.toFixed(1)}ms`,
    `Other:               ${cost.otherMs.toFixed(1)}ms`,
    `ms/possession:       ${cost.msPerPossession.toFixed(3)}`,
    `ms/event:            ${cost.msPerEvent.toFixed(3)}`,
  ].join("\n");
}

export function formatSeasonProfiler(season: SeasonProfilerBuckets): string {
  const pct = (ms: number) =>
    season.totalMs > 0 ? ((ms / season.totalMs) * 100).toFixed(1) : "0.0";
  return [
    "Season",
    "------",
    `Total:               ${(season.totalMs / 1000).toFixed(2)}s`,
    `Days:                ${season.days}`,
    `Games:               ${season.gamesSimulated}`,
    `Playoff games:       ${season.playoffGames}`,
    `Game simulation:     ${(season.gameSimMs / 1000).toFixed(2)}s (${pct(season.gameSimMs)}%)`,
    `Standings:           ${(season.standingsMs / 1000).toFixed(2)}s (${pct(season.standingsMs)}%)`,
    `Owner gameplay:      ${(season.ownerGameplayMs / 1000).toFixed(2)}s (${pct(season.ownerGameplayMs)}%)`,
    `Tickets:             ${(season.ticketsMs / 1000).toFixed(2)}s (${pct(season.ticketsMs)}%)`,
    `Media:               ${(season.mediaMs / 1000).toFixed(2)}s (${pct(season.mediaMs)}%)`,
    `Narrative:           ${(season.narrativeMs / 1000).toFixed(2)}s (${pct(season.narrativeMs)}%)`,
    `Weekly pipeline:     ${(season.weeklyMs / 1000).toFixed(2)}s (${pct(season.weeklyMs)}%)`,
    `Monthly pipeline:    ${(season.monthlyMs / 1000).toFixed(2)}s (${pct(season.monthlyMs)}%)`,
    `Lifecycle:           ${(season.lifecycleMs / 1000).toFixed(2)}s (${pct(season.lifecycleMs)}%)`,
    `Other day work:      ${(season.otherDayMs / 1000).toFixed(2)}s (${pct(season.otherDayMs)}%)`,
  ].join("\n");
}

export function averageGameCost(games: readonly GameSimCostModel[]): GameSimCostModel | null {
  if (games.length === 0) {
    return null;
  }
  const sum: GameSimCostModel = {
    possessions: 0,
    events: 0,
    playersInvolved: 0,
    totalMs: 0,
    validationMs: 0,
    decisionSelectionMs: 0,
    statsMs: 0,
    resolutionMs: 0,
    otherMs: 0,
    msPerPossession: 0,
    msPerEvent: 0,
  };
  for (const game of games) {
    sum.possessions += game.possessions;
    sum.events += game.events;
    sum.playersInvolved += game.playersInvolved;
    sum.totalMs += game.totalMs;
    sum.validationMs += game.validationMs;
    sum.decisionSelectionMs += game.decisionSelectionMs;
    sum.statsMs += game.statsMs;
    sum.resolutionMs += game.resolutionMs;
    sum.otherMs += game.otherMs;
  }
  const n = games.length;
  const avgTotal = sum.totalMs / n;
  const avgPossessions = sum.possessions / n;
  const avgEvents = sum.events / n;
  return {
    possessions: Math.round(avgPossessions),
    events: Math.round(avgEvents),
    playersInvolved: Math.round(sum.playersInvolved / n),
    totalMs: avgTotal,
    validationMs: sum.validationMs / n,
    decisionSelectionMs: sum.decisionSelectionMs / n,
    statsMs: sum.statsMs / n,
    resolutionMs: sum.resolutionMs / n,
    otherMs: sum.otherMs / n,
    msPerPossession: avgPossessions > 0 ? avgTotal / avgPossessions : 0,
    msPerEvent: avgEvents > 0 ? avgTotal / avgEvents : 0,
  };
}

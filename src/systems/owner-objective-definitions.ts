import type {
  OwnerObjective,
  OwnerObjectiveCategory,
  OwnerObjectiveLifecycle,
  OwnerObjectiveType,
} from "@/domain/entities/owner-objective";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import {
  meanYoungRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import { objectiveAppliesCashConsequence } from "@/systems/owner-objectives-config";
import { getNetIncome, getFinancialStatement } from "@/systems/team-finances";
import { getTeamPayroll } from "@/systems/salary-cap";
import { getActiveOwnedFranchise } from "@/state/owner-context";

export type OwnerObjectiveDefinition = {
  type: OwnerObjectiveType;
  category: OwnerObjectiveCategory;
  defaultLifecycle: OwnerObjectiveLifecycle;
  appliesCashConsequence: boolean;
};

const DEFINITIONS: Record<OwnerObjectiveType, OwnerObjectiveDefinition> = {
  make_playoffs: {
    type: "make_playoffs",
    category: "competitive",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: true,
  },
  win_championship: {
    type: "win_championship",
    category: "competitive",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  minimum_win_total: {
    type: "minimum_win_total",
    category: "competitive",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: true,
  },
  improve_finances: {
    type: "improve_finances",
    category: "financial",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  develop_young_players: {
    type: "develop_young_players",
    category: "strategic",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  roster_direction: {
    type: "roster_direction",
    category: "strategic",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  playoff_round: {
    type: "playoff_round",
    category: "competitive",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  payroll_limit: {
    type: "payroll_limit",
    category: "financial",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: true,
  },
  franchise_value: {
    type: "franchise_value",
    category: "long_term",
    defaultLifecycle: "multi_season",
    appliesCashConsequence: false,
  },
  revenue_target: {
    type: "revenue_target",
    category: "financial",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  positive_cash: {
    type: "positive_cash",
    category: "financial",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  playoff_seed: {
    type: "playoff_seed",
    category: "competitive",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  attendance: {
    type: "attendance",
    category: "franchise",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  fan_sentiment: {
    type: "fan_sentiment",
    category: "franchise",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  awareness: {
    type: "awareness",
    category: "franchise",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  reputation: {
    type: "reputation",
    category: "franchise",
    defaultLifecycle: "seasonal",
    appliesCashConsequence: false,
  },
  arena_level: {
    type: "arena_level",
    category: "franchise",
    defaultLifecycle: "milestone",
    appliesCashConsequence: false,
  },
  championship_count: {
    type: "championship_count",
    category: "long_term",
    defaultLifecycle: "career",
    appliesCashConsequence: false,
  },
  playoff_count: {
    type: "playoff_count",
    category: "long_term",
    defaultLifecycle: "career",
    appliesCashConsequence: false,
  },
};

export function getOwnerObjectiveDefinition(
  type: OwnerObjectiveType,
): OwnerObjectiveDefinition {
  return DEFINITIONS[type];
}

export function definitionAppliesCashConsequence(
  type: OwnerObjectiveType,
): boolean {
  return (
    DEFINITIONS[type].appliesCashConsequence &&
    objectiveAppliesCashConsequence(type)
  );
}

/** Playoff seed for the controlled team, or null if not qualified. */
export function getTeamPlayoffSeed(
  state: GameState,
  teamId: TeamId,
): number | null {
  const seed = state.competition.playoffs.qualifiedTeams.find(
    (entry) => entry.teamId === teamId,
  );
  return seed?.seed ?? null;
}

export function countCareerChampionships(
  state: GameState,
  teamId: TeamId,
): number {
  const history = state.business.franchiseHistory[teamId];
  let count = 0;
  if (history) {
    for (const season of history.seasons) {
      if (season.championship) {
        count += 1;
      }
    }
  }
  if (state.competition.playoffs.championTeamId === teamId) {
    const year = state.competition.season.year;
    const already =
      history?.seasons.some(
        (season) => season.seasonYear === year && season.championship,
      ) ?? false;
    if (!already) {
      count += 1;
    }
  }
  return count;
}

export function countCareerPlayoffAppearances(
  state: GameState,
  teamId: TeamId,
): number {
  const history = state.business.franchiseHistory[teamId];
  let count = 0;
  if (history) {
    for (const season of history.seasons) {
      if (season.playoffResult !== "missed") {
        count += 1;
      }
    }
  }
  const qualified = state.competition.playoffs.qualifiedTeams.some(
    (seed) => seed.teamId === teamId,
  );
  if (qualified) {
    const year = state.competition.season.year;
    const already =
      history?.seasons.some(
        (season) =>
          season.seasonYear === year && season.playoffResult !== "missed",
      ) ?? false;
    if (!already) {
      count += 1;
    }
  }
  return count;
}

function readLastAttendanceFillRate(
  state: GameState,
  teamId: TeamId,
): number | null {
  const teamIdStr = String(teamId);
  for (let i = getActiveOwnedFranchise(state).eventLog.length - 1; i >= 0; i -= 1) {
    const event = getActiveOwnedFranchise(state).eventLog[i]!;
    if (
      event.type === "HomeGameDaySettled" &&
      String(event.payload.teamId) === teamIdStr
    ) {
      const attendance = Number(event.payload.attendance) || 0;
      const capacity = Number(event.payload.capacity) || 0;
      if (capacity <= 0) {
        return null;
      }
      return Math.round((attendance / capacity) * 100);
    }
  }
  return null;
}

function isTerminalSeasonPhase(phase: string): boolean {
  return phase === "postseason" || phase === "offseason";
}

function multiSeasonHorizonReached(
  objective: OwnerObjective,
  seasonYear: number,
): boolean {
  const horizon = objective.horizonYears ?? 1;
  return seasonYear >= objective.seasonYear + horizon - 1;
}

export function evaluateOwnerObjectiveMetric(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective {
  switch (objective.type) {
    case "minimum_win_total":
      return evaluateWins(objective, state, teamId);
    case "make_playoffs":
      return evaluateMakePlayoffs(objective, state, teamId);
    case "playoff_round":
      return evaluatePlayoffRound(objective, state, teamId);
    case "win_championship":
      return evaluateChampionship(objective, state, teamId);
    case "improve_finances":
      return evaluateImproveFinances(objective, state, teamId);
    case "payroll_limit":
      return evaluatePayrollLimit(objective, state, teamId);
    case "develop_young_players":
      return evaluateDevelopYoungPlayers(objective, state, teamId, seasonYear);
    case "roster_direction":
      return evaluateRosterDirection(objective, state, teamId, seasonYear);
    case "franchise_value":
      return evaluateFranchiseValue(objective, state, teamId, seasonYear);
    case "revenue_target":
      return evaluateRevenueTarget(objective, state, teamId);
    case "positive_cash":
      return evaluatePositiveCash(objective, state, teamId);
    case "playoff_seed":
      return evaluatePlayoffSeed(objective, state, teamId);
    case "attendance":
      return evaluateAttendance(objective, state, teamId);
    case "fan_sentiment":
      return evaluateFanSentiment(objective, state, teamId);
    case "awareness":
      return evaluateAwareness(objective, state, teamId);
    case "reputation":
      return evaluateReputation(objective, state, teamId);
    case "arena_level":
      return evaluateArenaLevel(objective, state, teamId);
    case "championship_count":
      return evaluateChampionshipCount(objective, state, teamId);
    case "playoff_count":
      return evaluatePlayoffCount(objective, state, teamId);
  }
}

function evaluateWins(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target;
  if (target === undefined) {
    return objective;
  }
  const wins = state.competition.standings.byTeamId[teamId]?.wins ?? 0;
  const progress = wins;
  if (wins >= target) {
    return { ...objective, progress, status: "completed" };
  }
  const phase = state.competition.season.phase;
  if (phase !== "preseason" && phase !== "regular") {
    return { ...objective, progress, status: "failed" };
  }
  return { ...objective, progress };
}

function evaluateMakePlayoffs(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const qualified = state.competition.playoffs.qualifiedTeams.some(
    (seed) => seed.teamId === teamId,
  );
  const progress = qualified ? 1 : 0;
  if (qualified) {
    return { ...objective, progress, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress, status: "failed" };
  }
  return { ...objective, progress };
}

function evaluatePlayoffRound(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target;
  if (target === undefined) {
    return objective;
  }

  let highestWon = -1;
  let eliminatedBeforeTarget = false;
  for (const series of state.competition.playoffs.series) {
    const participates =
      series.higherSeedTeamId === teamId || series.lowerSeedTeamId === teamId;
    if (!participates) {
      continue;
    }
    if (series.status === "complete" && series.winnerTeamId === teamId) {
      if (series.round > highestWon) {
        highestWon = series.round;
      }
    }
    if (
      series.status === "complete" &&
      series.winnerTeamId !== undefined &&
      series.winnerTeamId !== teamId &&
      series.round < target
    ) {
      eliminatedBeforeTarget = true;
    }
  }

  const progress = Math.max(0, highestWon);
  if (highestWon >= target) {
    return { ...objective, progress, status: "completed" };
  }
  if (
    eliminatedBeforeTarget ||
    state.competition.playoffs.status === "complete"
  ) {
    return { ...objective, progress, status: "failed" };
  }
  return { ...objective, progress };
}

function evaluateChampionship(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const champion = state.competition.playoffs.championTeamId;
  const progress = champion === teamId ? 1 : 0;
  if (champion === teamId) {
    return { ...objective, progress, status: "completed" };
  }
  if (state.competition.playoffs.status === "complete") {
    return { ...objective, progress, status: "failed" };
  }
  return { ...objective, progress };
}

function evaluateImproveFinances(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const netIncome = getNetIncome(state, teamId, objective.seasonYear);
  const progressive = netIncome > 0 ? netIncome : 0;
  if (netIncome > 0) {
    return { ...objective, progress: progressive, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: progressive, status: "failed" };
  }
  return { ...objective, progress: progressive };
}

function evaluatePayrollLimit(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target;
  if (target === undefined) {
    return objective;
  }
  const payroll = getTeamPayroll(teamId, objective.seasonYear, state);
  if (payroll > target) {
    return { ...objective, progress: payroll, status: "failed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: payroll, status: "completed" };
  }
  return { ...objective, progress: payroll };
}

function evaluateDevelopYoungPlayers(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective {
  const current = meanYoungRosterOverall(state, teamId);
  const baseline = objective.baseline ?? current;
  const target = objective.target ?? baseline + 3;
  const progress = Math.max(0, current);
  if (current >= target) {
    return { ...objective, progress, status: "completed", baseline };
  }
  if (
    objective.lifecycle === "multi_season" &&
    multiSeasonHorizonReached(objective, seasonYear)
  ) {
    return { ...objective, progress, status: "failed", baseline };
  }
  if (
    objective.lifecycle === "seasonal" &&
    isTerminalSeasonPhase(state.competition.season.phase)
  ) {
    return { ...objective, progress, status: "failed", baseline };
  }
  return { ...objective, progress, baseline };
}

function evaluateRosterDirection(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective {
  const share = youngRosterSharePct(state, teamId);
  const target = objective.target ?? 40;
  const progress = share;
  if (share >= target) {
    return { ...objective, progress, status: "completed" };
  }
  if (
    objective.lifecycle === "multi_season" &&
    multiSeasonHorizonReached(objective, seasonYear)
  ) {
    return { ...objective, progress, status: "failed" };
  }
  if (
    objective.lifecycle === "seasonal" &&
    isTerminalSeasonPhase(state.competition.season.phase)
  ) {
    return { ...objective, progress, status: "failed" };
  }
  return { ...objective, progress };
}

function evaluateFranchiseValue(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective {
  const value = calculateFranchiseValue(state, teamId);
  const baseline = objective.baseline ?? value;
  const target =
    objective.target ?? Math.round(baseline * 1.25);
  const progress = value;
  if (value >= target) {
    return { ...objective, progress, status: "completed", baseline };
  }
  if (
    (objective.lifecycle === "multi_season" ||
      objective.lifecycle === "career") &&
    objective.lifecycle === "multi_season" &&
    multiSeasonHorizonReached(objective, seasonYear)
  ) {
    return { ...objective, progress, status: "failed", baseline };
  }
  return { ...objective, progress, baseline };
}

function evaluateRevenueTarget(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target;
  if (target === undefined) {
    return objective;
  }
  const revenue = getFinancialStatement(state, teamId, objective.seasonYear)
    .revenue.total;
  const progress = revenue;
  if (revenue >= target) {
    return { ...objective, progress, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress, status: "failed" };
  }
  return { ...objective, progress };
}

function evaluatePositiveCash(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const cash = state.business.finances[teamId]?.businessFunds ?? 0;
  const progress = Math.max(0, cash);
  if (cash > 0) {
    if (isTerminalSeasonPhase(state.competition.season.phase)) {
      return { ...objective, progress, status: "completed" };
    }
    return { ...objective, progress };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: 0, status: "failed" };
  }
  return { ...objective, progress: 0 };
}

function evaluatePlayoffSeed(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target;
  if (target === undefined) {
    return objective;
  }
  const seed = getTeamPlayoffSeed(state, teamId);
  if (seed !== null && seed <= target) {
    return { ...objective, progress: seed, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return {
      ...objective,
      progress: seed ?? 99,
      status: "failed",
    };
  }
  return { ...objective, progress: seed ?? 0 };
}

function evaluateAttendance(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? 60;
  const fill = readLastAttendanceFillRate(state, teamId);
  if (fill === null) {
    if (isTerminalSeasonPhase(state.competition.season.phase)) {
      return { ...objective, progress: 0, status: "failed" };
    }
    return objective;
  }
  if (fill >= target) {
    return { ...objective, progress: fill, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: fill, status: "failed" };
  }
  return { ...objective, progress: fill };
}

function evaluateFanSentiment(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? 50;
  const value = state.business.franchiseOps[teamId]?.fanSentiment ?? 0;
  if (value >= target) {
    return { ...objective, progress: value, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: value, status: "failed" };
  }
  return { ...objective, progress: value };
}

function evaluateAwareness(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? 45;
  const value = state.business.franchiseOps[teamId]?.marketing.awareness ?? 0;
  if (value >= target) {
    return { ...objective, progress: value, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: value, status: "failed" };
  }
  return { ...objective, progress: value };
}

function evaluateReputation(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? 55;
  const value = state.world.teams[teamId]?.reputation ?? 0;
  if (value >= target) {
    return { ...objective, progress: value, status: "completed" };
  }
  if (isTerminalSeasonPhase(state.competition.season.phase)) {
    return { ...objective, progress: value, status: "failed" };
  }
  return { ...objective, progress: value };
}

function evaluateArenaLevel(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? (objective.baseline ?? 1) + 1;
  const level =
    state.business.franchiseOps[teamId]?.facilities.arena.level ?? 1;
  if (level >= target) {
    return { ...objective, progress: level, status: "completed" };
  }
  return { ...objective, progress: level };
}

function evaluateChampionshipCount(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? 3;
  const count = countCareerChampionships(state, teamId);
  if (count >= target) {
    return { ...objective, progress: count, status: "completed" };
  }
  return { ...objective, progress: count };
}

function evaluatePlayoffCount(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
): OwnerObjective {
  const target = objective.target ?? 5;
  const count = countCareerPlayoffAppearances(state, teamId);
  if (count >= target) {
    return { ...objective, progress: count, status: "completed" };
  }
  return { ...objective, progress: count };
}

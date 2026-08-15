import {
  createOwnerObjective,
  type OwnerObjective,
} from "@/domain/entities/owner-objective";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { asOwnerObjectiveId, type TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  OWNER_OBJECTIVE_MID_OVERALL,
  OWNER_OBJECTIVE_PAYROLL_LIMIT,
  OWNER_OBJECTIVE_STRONG_OVERALL,
  OWNER_OBJECTIVE_WIN_TARGET_MID,
  OWNER_OBJECTIVE_WIN_TARGET_WEAK,
} from "@/systems/owner-objectives-config";
import { getNetIncome } from "@/systems/team-finances";
import { getTeamPayroll } from "@/systems/salary-cap";

/**
 * Creates season objectives for the controlled team when none are active for
 * the current season year. Idempotent for the same seasonYear.
 */
export function generateOwnerObjectives(state: GameState): SystemResult {
  const seasonYear = state.competition.season.year;
  const hasActiveForYear = state.user.objectives.some(
    (objective) =>
      objective.seasonYear === seasonYear && objective.status === "active",
  );
  if (hasActiveForYear) {
    return systemResult(state);
  }

  const teamId = state.user.controlledTeamId;
  const meanOverall = meanRosterOverall(state, teamId);
  const generated: OwnerObjective[] = [];

  if (meanOverall >= OWNER_OBJECTIVE_STRONG_OVERALL) {
    generated.push(
      createOwnerObjective({
        id: asOwnerObjectiveId(`obj_${seasonYear}_make_playoffs`),
        type: "make_playoffs",
        description: "Make the playoffs",
        status: "active",
        seasonYear,
        progress: 0,
        consequenceApplied: false,
      }),
    );
  } else if (meanOverall >= OWNER_OBJECTIVE_MID_OVERALL) {
    generated.push(
      createOwnerObjective({
        id: asOwnerObjectiveId(`obj_${seasonYear}_wins_${OWNER_OBJECTIVE_WIN_TARGET_MID}`),
        type: "minimum_win_total",
        description: `Win at least ${OWNER_OBJECTIVE_WIN_TARGET_MID} games`,
        status: "active",
        seasonYear,
        target: OWNER_OBJECTIVE_WIN_TARGET_MID,
        progress: 0,
        consequenceApplied: false,
      }),
    );
  } else {
    generated.push(
      createOwnerObjective({
        id: asOwnerObjectiveId(`obj_${seasonYear}_wins_${OWNER_OBJECTIVE_WIN_TARGET_WEAK}`),
        type: "minimum_win_total",
        description: `Win at least ${OWNER_OBJECTIVE_WIN_TARGET_WEAK} games`,
        status: "active",
        seasonYear,
        target: OWNER_OBJECTIVE_WIN_TARGET_WEAK,
        progress: 0,
        consequenceApplied: false,
      }),
    );
  }

  generated.push(
    createOwnerObjective({
      id: asOwnerObjectiveId(`obj_${seasonYear}_payroll_limit`),
      type: "payroll_limit",
      description: `Keep payroll at or below ${OWNER_OBJECTIVE_PAYROLL_LIMIT}`,
      status: "active",
      seasonYear,
      target: OWNER_OBJECTIVE_PAYROLL_LIMIT,
      progress: getTeamPayroll(teamId, seasonYear, state),
      consequenceApplied: false,
    }),
  );

  return systemResult({
    ...state,
    user: {
      ...state.user,
      objectives: [...state.user.objectives, ...generated],
    },
  });
}

/**
 * Evaluates active owner objectives from canonical simulation state.
 * Sticky completed/failed statuses are not rewritten.
 * When phase is preseason/regular and no active objectives exist for the year,
 * generates them first.
 */
export function evaluateOwnerObjectives(state: GameState): SystemResult {
  let current = state;
  const phase = current.competition.season.phase;
  if (phase === "preseason" || phase === "regular") {
    const generated = generateOwnerObjectives(current);
    current = generated.state;
  }

  const teamId = current.user.controlledTeamId;
  const seasonYear = current.competition.season.year;
  const nextObjectives = current.user.objectives.map((objective) =>
    evaluateOne(objective, current, teamId, seasonYear),
  );

  const changed = nextObjectives.some(
    (objective, index) => objective !== current.user.objectives[index],
  );
  if (!changed) {
    return systemResult(current);
  }

  return systemResult({
    ...current,
    user: {
      ...current.user,
      objectives: nextObjectives,
    },
  });
}

/**
 * Season-boundary resolution for objectives that remain active when the
 * competition phase can no longer satisfy them.
 */
export function resolveSeasonObjectives(state: GameState): SystemResult {
  return evaluateOwnerObjectives(state);
}

function evaluateOne(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective {
  if (objective.status !== "active") {
    return objective;
  }
  if (objective.seasonYear !== seasonYear) {
    return objective;
  }

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
    case "roster_direction":
      return objective;
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
  const phase = state.competition.season.phase;
  if (phase === "postseason" || phase === "offseason") {
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
  if (eliminatedBeforeTarget || state.competition.playoffs.status === "complete") {
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
  const phase = state.competition.season.phase;
  if (phase === "postseason" || phase === "offseason") {
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
  const phase = state.competition.season.phase;
  if (phase === "postseason" || phase === "offseason") {
    return { ...objective, progress: payroll, status: "completed" };
  }
  return { ...objective, progress: payroll };
}

function meanRosterOverall(state: GameState, teamId: TeamId): number {
  const team = state.world.teams[teamId];
  if (!team || team.roster.length === 0) {
    return 0;
  }
  let total = 0;
  let count = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    total += calculatePlayerOverall(player.position, player.attributes);
    count += 1;
  }
  return count === 0 ? 0 : total / count;
}

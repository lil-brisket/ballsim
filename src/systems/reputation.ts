import { FACILITY_CATEGORIES } from "@/domain/entities/franchise-ops";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  REPUTATION_MONTHLY_SMOOTHING,
  REPUTATION_TARGET_WEIGHTS,
} from "@/systems/reputation-config";

function clampReputation(value: number): number {
  return Math.max(1, Math.min(99, Math.round(value)));
}

function teamWinPct(state: GameState, teamId: TeamId): number {
  const standing = state.competition.standings.byTeamId[teamId];
  if (!standing) {
    return 0.5;
  }
  const games = standing.wins + standing.losses;
  return games === 0 ? 0.5 : standing.wins / games;
}

function averageFacilityLevel(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 1;
  }
  let sum = 0;
  for (const category of FACILITY_CATEGORIES) {
    sum += ops.facilities[category].level;
  }
  return (sum / FACILITY_CATEGORIES.length) * 20;
}

export function reputationTarget(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 50;
  }
  const components = {
    winPct: teamWinPct(state, teamId) * 100,
    fanSentiment: ops.fanSentiment,
    mediaAttention: ops.mediaAttention,
    facilityQuality: averageFacilityLevel(state, teamId),
    leaguePopularity: state.business.leagueEconomy.popularity,
  };

  let target = 0;
  for (const key of Object.keys(REPUTATION_TARGET_WEIGHTS) as Array<
    keyof typeof REPUTATION_TARGET_WEIGHTS
  >) {
    target += components[key] * REPUTATION_TARGET_WEIGHTS[key];
  }
  return clampReputation(target);
}

export function processMonthlyReputation(state: GameState): SystemResult {
  let teams = state.world.teams;
  let changed = false;

  for (const teamId of Object.keys(teams).sort()) {
    const team = teams[teamId]!;
    const target = reputationTarget(state, teamId as TeamId);
    const next = clampReputation(
      team.reputation +
        (target - team.reputation) * REPUTATION_MONTHLY_SMOOTHING,
    );
    if (next !== team.reputation) {
      teams = {
        ...teams,
        [teamId]: { ...team, reputation: next },
      };
      changed = true;
    }
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    world: { ...state.world, teams },
  });
}

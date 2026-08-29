import {
  getContractStatus,
  isContractActive,
} from "@/domain/entities/contract";
import type { PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { STARTER_ROLES } from "@/systems/staff-generation";

export type PositionalStrength = {
  position: PlayerPosition;
  bestOverall: number;
  count: number;
  leaguePositionalAvg: number;
  isWeak: boolean;
};

export type TeamPhaseContext = {
  teamId: TeamId;
  rosterSize: number;
  expiringContractCount: number;
  pendingTeamOptions: number;
  pendingPlayerOptions: number;
  capSpace: number;
  draftPickNumbers: number[];
  bestDraftPick: number | null;
  positionalStrengths: PositionalStrength[];
  weakestPositions: PlayerPosition[];
  vacantStaffRoles: string[];
  hasScoutVacancy: boolean;
  hasTrainerVacancy: boolean;
};

/**
 * Pure team analyzers for focus/task evaluation.
 * Re-run after meaningful transactions — never cache across mutations.
 */
export function analyzeTeamPhaseContext(
  state: GameState,
  teamId: TeamId,
): TeamPhaseContext {
  const team = state.world.teams[teamId];
  const year = state.competition.season.year;
  const rosterSize = team?.roster.length ?? 0;

  let expiringContractCount = 0;
  let pendingTeamOptions = 0;
  let pendingPlayerOptions = 0;

  for (const contract of Object.values(state.business.contracts)) {
    if (contract.teamId !== teamId) {
      continue;
    }
    if (!isContractActive(contract, year) && getContractStatus(contract, year) === "expired") {
      // Already expired — counted via release path; skip for "expiring this year"
    }
    if (isContractActive(contract, year) && contract.endYear === year) {
      expiringContractCount += 1;
    }
    if (
      contract.teamOption?.status === "pending" &&
      getContractStatus(contract, year) === "team_option"
    ) {
      pendingTeamOptions += 1;
    }
    if (
      contract.playerOption?.status === "pending" &&
      getContractStatus(contract, year) === "player_option"
    ) {
      pendingPlayerOptions += 1;
    }
  }

  const capSpace = getTeamCapSpace(teamId, year, state);
  const draftPickNumbers = resolveOwnedDraftPickNumbers(state, teamId);
  const bestDraftPick =
    draftPickNumbers.length > 0 ? Math.min(...draftPickNumbers) : null;

  const positionalStrengths = computePositionalStrengths(state, teamId);
  const weakestPositions = positionalStrengths
    .filter((entry) => entry.isWeak)
    .sort((a, b) => a.bestOverall - b.bestOverall)
    .map((entry) => entry.position);

  const vacantStaffRoles: string[] = [];
  for (const role of STARTER_ROLES) {
    if (findTeamStaffByRole(state, teamId, role) === null) {
      vacantStaffRoles.push(role);
    }
  }

  return {
    teamId,
    rosterSize,
    expiringContractCount,
    pendingTeamOptions,
    pendingPlayerOptions,
    capSpace,
    draftPickNumbers,
    bestDraftPick,
    positionalStrengths,
    weakestPositions,
    vacantStaffRoles,
    hasScoutVacancy: vacantStaffRoles.includes("scout"),
    hasTrainerVacancy: vacantStaffRoles.includes("trainer"),
  };
}

function resolveOwnedDraftPickNumbers(
  state: GameState,
  teamId: TeamId,
): number[] {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  const numbers: number[] = [];

  if (draft !== undefined) {
    for (const slot of draft.order) {
      if (slot.ownerTeamId === teamId && slot.status !== "used") {
        numbers.push(slot.overallPick);
      }
    }
  }

  return numbers.sort((a, b) => a - b);
}

function computePositionalStrengths(
  state: GameState,
  teamId: TeamId,
): PositionalStrength[] {
  const team = state.world.teams[teamId];
  const leagueAvgs = leaguePositionalAverages(state);
  const result: PositionalStrength[] = [];

  for (const position of PLAYER_POSITIONS) {
    let bestOverall = 0;
    let count = 0;
    if (team) {
      for (const playerId of team.roster) {
        const player = state.world.players[playerId];
        if (!player || player.attributes == null) {
          continue;
        }
        if (player.position !== position) {
          continue;
        }
        count += 1;
        let overall = 0;
        try {
          overall = calculatePlayerOverall(
            player.position,
            player.attributes,
          );
        } catch {
          continue;
        }
        if (overall > bestOverall) {
          bestOverall = overall;
        }
      }
    }
    const leaguePositionalAvg = leagueAvgs[position] ?? 70;
    const isWeak =
      count === 0 || bestOverall < leaguePositionalAvg - 5;
    result.push({
      position,
      bestOverall,
      count,
      leaguePositionalAvg,
      isWeak,
    });
  }
  return result;
}

function leaguePositionalAverages(
  state: GameState,
): Record<PlayerPosition, number> {
  const sums: Record<string, { total: number; count: number }> = {};
  for (const position of PLAYER_POSITIONS) {
    sums[position] = { total: 0, count: 0 };
  }
  for (const player of Object.values(state.world.players)) {
    if (player.teamId === null || player.attributes == null) {
      continue;
    }
    let overall: number;
    try {
      overall = calculatePlayerOverall(player.position, player.attributes);
    } catch {
      continue;
    }
    const bucket = sums[player.position];
    if (bucket) {
      bucket.total += overall;
      bucket.count += 1;
    }
  }
  const avgs = {} as Record<PlayerPosition, number>;
  for (const position of PLAYER_POSITIONS) {
    const bucket = sums[position];
    avgs[position] =
      bucket && bucket.count > 0
        ? Math.round(bucket.total / bucket.count)
        : 70;
  }
  return avgs;
}

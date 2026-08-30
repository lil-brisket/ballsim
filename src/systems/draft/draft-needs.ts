/**
 * Team draft needs from roster depth, quality, age, and contracts.
 * Influences AI / mock / recommendations — never hard-forces picks.
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getContractStatus } from "@/domain/entities/contract";

export type DraftNeedLevel =
  | "critical"
  | "major"
  | "moderate"
  | "minor"
  | "none";

export type PositionDraftNeed = {
  position: PlayerPosition;
  level: DraftNeedLevel;
  reasons: string[];
  depth: number;
  averageOverall: number | null;
  averageAge: number | null;
};

export type TeamDraftNeeds = {
  teamId: TeamId;
  byPosition: PositionDraftNeed[];
  /** Highest-priority positions first. */
  priorityPositions: PlayerPosition[];
};

const LEVEL_RANK: Record<DraftNeedLevel, number> = {
  critical: 4,
  major: 3,
  moderate: 2,
  minor: 1,
  none: 0,
};

export function calculateTeamDraftNeeds(
  state: GameState,
  teamId: TeamId,
): TeamDraftNeeds {
  const team = state.world.teams[teamId];
  const byPosition: PositionDraftNeed[] = [];
  if (!team) {
    return { teamId, byPosition: [], priorityPositions: [] };
  }

  const seasonYear = state.competition.season.year;

  for (const position of PLAYER_POSITIONS) {
    const players = team.roster
      .map((id) => state.world.players[id])
      .filter((p): p is Player => p !== undefined && p.position === position);

    const depth = players.length;
    const overalls = players.map((p) =>
      calculatePlayerOverall(p.position, p.attributes),
    );
    const averageOverall =
      overalls.length > 0
        ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
        : null;
    const averageAge =
      players.length > 0
        ? Math.round(
            players.reduce((a, p) => a + p.age, 0) / players.length,
          )
        : null;

    const reasons: string[] = [];
    let level: DraftNeedLevel = "none";

    if (depth === 0) {
      level = "critical";
      reasons.push("No players at position");
    } else if (depth === 1) {
      level = "major";
      reasons.push("Only one player at position");
    } else if (depth === 2) {
      level = "moderate";
      reasons.push("Thin depth");
    }

    const bestOverall = overalls.length > 0 ? Math.max(...overalls) : 0;
    if (depth > 0 && bestOverall < 68) {
      if (LEVEL_RANK[level] < LEVEL_RANK.major) level = "major";
      reasons.push("Low starter quality");
    } else if (depth > 0 && bestOverall < 74 && LEVEL_RANK[level] < LEVEL_RANK.moderate) {
      level = "moderate";
      reasons.push("Average starter quality");
    }

    if (averageAge !== null && averageAge >= 30) {
      if (LEVEL_RANK[level] < LEVEL_RANK.moderate) level = "moderate";
      reasons.push("Aging position group");
    } else if (averageAge !== null && averageAge >= 28 && level === "none") {
      level = "minor";
      reasons.push("Approaching decline window");
    }

    const expiring = players.filter((p) => {
      if (!p.contractId) return false;
      const contract = state.business.contracts[p.contractId];
      if (!contract) return false;
      return (
        getContractStatus(contract, seasonYear) === "active" &&
        contract.endYear <= seasonYear + 1
      );
    });
    if (expiring.length > 0 && depth <= 2) {
      if (LEVEL_RANK[level] < LEVEL_RANK.moderate) level = "moderate";
      reasons.push("Upcoming free agency");
    }

    if (level === "none" && depth >= 4 && bestOverall >= 78) {
      reasons.push("Position well stocked");
    }

    byPosition.push({
      position,
      level,
      reasons,
      depth,
      averageOverall,
      averageAge,
    });
  }

  const priorityPositions = [...byPosition]
    .filter((p) => p.level !== "none")
    .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])
    .map((p) => p.position);

  return { teamId, byPosition, priorityPositions };
}

export function needLevelScore(level: DraftNeedLevel): number {
  return LEVEL_RANK[level];
}

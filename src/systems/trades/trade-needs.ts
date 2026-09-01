import type { PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { getContractStatus } from "@/domain/entities/contract";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  calculateTeamDraftNeeds,
  needLevelScore,
  type DraftNeedLevel,
  type PositionDraftNeed,
} from "@/systems/draft/draft-needs";

export type TradeNeedLevel = DraftNeedLevel;

export type PositionTradeNeed = PositionDraftNeed & {
  injuredCount: number;
  surplus: boolean;
};

export type TeamTradeNeeds = {
  teamId: TeamId;
  byPosition: PositionTradeNeed[];
  priorityPositions: PlayerPosition[];
};

/**
 * Roster/trade needs — draft needs are one input, not the sole source of truth.
 */
export function calculateTradeNeeds(
  state: GameState,
  teamId: TeamId,
): TeamTradeNeeds {
  const draftNeeds = calculateTeamDraftNeeds(state, teamId);
  const team = state.world.teams[teamId];
  if (!team) {
    return { teamId, byPosition: [], priorityPositions: [] };
  }

  const seasonYear = state.competition.season.year;
  const byPosition: PositionTradeNeed[] = [];

  for (const position of PLAYER_POSITIONS) {
    const draft = draftNeeds.byPosition.find((p) => p.position === position);
    const players = team.roster
      .map((id) => state.world.players[id])
      .filter((p) => p !== undefined && p.position === position);

    let injuredCount = 0;
    for (const player of players) {
      if (
        player.activeInjuries.some(
          (injury) =>
            injury.gameRestriction === "out" ||
            injury.gameRestriction === "limited",
        )
      ) {
        injuredCount += 1;
      }
    }

    const depth = players.length;
    const overalls = players.map((p) =>
      calculatePlayerOverall(p.position, p.attributes),
    );
    const bestOverall = overalls.length > 0 ? Math.max(...overalls) : 0;
    const averageOverall =
      overalls.length > 0
        ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
        : null;

    let level: TradeNeedLevel = draft?.level ?? "none";
    const reasons = [...(draft?.reasons ?? [])];

    if (injuredCount > 0 && depth - injuredCount <= 1) {
      if (needLevelScore(level) < needLevelScore("major")) {
        level = "major";
      }
      reasons.push("Injury gap at position");
    }

    const expiringHighEnd = players.filter((p) => {
      if (!p.contractId) return false;
      const contract = state.business.contracts[p.contractId];
      if (!contract) return false;
      const ovr = calculatePlayerOverall(p.position, p.attributes);
      return (
        getContractStatus(contract, seasonYear) === "active" &&
        contract.endYear <= seasonYear &&
        ovr >= 75
      );
    });
    if (expiringHighEnd.length > 0 && needLevelScore(level) < needLevelScore("moderate")) {
      level = "moderate";
      reasons.push("Quality starter approaching free agency");
    }

    const surplus =
      depth >= 4 &&
      bestOverall >= 78 &&
      needLevelScore(level) <= needLevelScore("minor");

    if (surplus) {
      reasons.push("Positional surplus");
    }

    byPosition.push({
      position,
      level,
      reasons,
      depth,
      averageOverall: averageOverall ?? draft?.averageOverall ?? null,
      averageAge: draft?.averageAge ?? null,
      injuredCount,
      surplus,
    });
  }

  const priorityPositions = [...byPosition]
    .filter((p) => p.level !== "none")
    .sort((a, b) => needLevelScore(b.level) - needLevelScore(a.level))
    .map((p) => p.position);

  return { teamId, byPosition, priorityPositions };
}

export function tradeNeedLevelScore(level: TradeNeedLevel): number {
  return needLevelScore(level);
}

import type { DraftPick } from "@/domain/entities/draft-pick";
import {
  createDraftOrderSlot,
  type DraftOrderSlot,
} from "@/domain/entities/draft";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { DRAFT_PICK_ROUNDS } from "@/domain/entities/draft-pick";

/**
 * Pure deterministic draft order from pick assets + reverse standings.
 * Total sort within each round:
 * wins ascending → originalTeamId ascending → draftPickId ascending.
 * Round 2 uses the same franchise order (not snake). No RNG.
 */
export function generateDraftOrder(
  state: GameState,
  draftYear: number,
): DraftOrderSlot[] {
  const picksForYear = Object.values(state.world.draftPicks).filter(
    (pick) => pick.seasonYear === draftYear,
  );
  if (picksForYear.length === 0) {
    throw new Error(
      `No draft picks found for seasonYear ${draftYear}.`,
    );
  }

  const winsByTeam = winsByOriginalTeam(state);
  const slots: DraftOrderSlot[] = [];
  let overallPick = 1;

  for (const round of DRAFT_PICK_ROUNDS) {
    const roundPicks = picksForYear
      .filter((pick) => pick.round === round)
      .sort((left, right) =>
        comparePicksForOrder(left, right, winsByTeam),
      );

    for (const pick of roundPicks) {
      slots.push(
        createDraftOrderSlot({
          draftPickId: pick.id,
          overallPick,
          round,
          ownerTeamId: pick.ownerTeamId,
          status: "available",
        }),
      );
      overallPick += 1;
    }
  }

  return slots;
}

function winsByOriginalTeam(state: GameState): Map<string, number> {
  const wins = new Map<string, number>();
  for (const teamId of Object.keys(state.world.teams)) {
    const standing = state.competition.standings.byTeamId[teamId];
    wins.set(teamId, standing?.wins ?? 0);
  }
  return wins;
}

function comparePicksForOrder(
  left: DraftPick,
  right: DraftPick,
  winsByTeam: Map<string, number>,
): number {
  const leftWins = winsByTeam.get(String(left.originalTeamId)) ?? 0;
  const rightWins = winsByTeam.get(String(right.originalTeamId)) ?? 0;
  if (leftWins !== rightWins) {
    return leftWins - rightWins;
  }
  if (left.originalTeamId !== right.originalTeamId) {
    return left.originalTeamId < right.originalTeamId ? -1 : 1;
  }
  if (left.id === right.id) {
    return 0;
  }
  return left.id < right.id ? -1 : 1;
}

/** Draft year for the next draft relative to the current season. */
export function draftYearForSeason(seasonYear: number): number {
  return seasonYear + 1;
}

export function countDraftPicksForYear(
  state: GameState,
  draftYear: number,
): number {
  let count = 0;
  for (const pick of Object.values(state.world.draftPicks)) {
    if (pick.seasonYear === draftYear) {
      count += 1;
    }
  }
  return count;
}

export function teamIdsSorted(state: GameState): TeamId[] {
  return Object.keys(state.world.teams)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => state.world.teams[id]!.id);
}

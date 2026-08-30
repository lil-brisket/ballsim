/**
 * Draft board mutations — franchise-scoped watchlist on TeamDraftState.
 */

import type { DraftClass, TeamDraftState } from "@/domain/entities/draft";
import { createEmptyTeamDraftState } from "@/domain/entities/draft";
import type { DraftBoardEntry } from "@/domain/entities/scouting-types";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";

function getDraft(state: GameState): DraftClass | null {
  const draftYear = draftYearForSeason(state.competition.season.year);
  return state.world.drafts[draftClassIdFor(draftYear)] ?? null;
}

function withBoard(
  state: GameState,
  teamId: TeamId,
  mutate: (board: DraftBoardEntry[]) => DraftBoardEntry[],
): GameState {
  const draft = getDraft(state);
  if (!draft) return state;
  const existing =
    draft.teamDraftState[teamId] ?? createEmptyTeamDraftState();
  const board = mutate([...existing.board]).map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
  const nextTeam: TeamDraftState = { ...existing, board };
  return {
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draft.id]: {
          ...draft,
          teamDraftState: {
            ...draft.teamDraftState,
            [teamId]: nextTeam,
          },
        },
      },
    },
  };
}

export function addToDraftBoard(
  state: GameState,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
): GameState {
  return withBoard(state, teamId, (board) => {
    if (board.some((e) => e.prospectPlayerId === prospectPlayerId)) {
      return board;
    }
    return [
      ...board,
      {
        prospectPlayerId,
        rank: board.length + 1,
        priority: false,
        notes: "",
      },
    ];
  });
}

export function removeFromDraftBoard(
  state: GameState,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
): GameState {
  return withBoard(state, teamId, (board) =>
    board.filter((e) => e.prospectPlayerId !== prospectPlayerId),
  );
}

export function setDraftBoardNotes(
  state: GameState,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
  notes: string,
): GameState {
  return withBoard(state, teamId, (board) =>
    board.map((e) =>
      e.prospectPlayerId === prospectPlayerId ? { ...e, notes } : e,
    ),
  );
}

export function toggleDraftBoardPriority(
  state: GameState,
  teamId: TeamId,
  prospectPlayerId: PlayerId,
): GameState {
  return withBoard(state, teamId, (board) =>
    board.map((e) =>
      e.prospectPlayerId === prospectPlayerId
        ? { ...e, priority: !e.priority }
        : e,
    ),
  );
}

export function reorderDraftBoard(
  state: GameState,
  teamId: TeamId,
  orderedPlayerIds: PlayerId[],
): GameState {
  return withBoard(state, teamId, (board) => {
    const byId = new Map(board.map((e) => [e.prospectPlayerId, e]));
    const next: DraftBoardEntry[] = [];
    for (const id of orderedPlayerIds) {
      const entry = byId.get(id);
      if (entry) next.push(entry);
    }
    for (const entry of board) {
      if (!orderedPlayerIds.includes(entry.prospectPlayerId)) {
        next.push(entry);
      }
    }
    return next;
  });
}

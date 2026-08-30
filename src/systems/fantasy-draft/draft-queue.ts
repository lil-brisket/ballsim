/**
 * Fantasy draft queue mutations — franchise-scoped watchlist on FantasyDraft.
 */

import type { FantasyDraft } from "@/domain/entities/fantasy-draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { withFantasyDraft } from "@/systems/fantasy-draft/draft-order";

function requireActiveOrPausedDraft(state: GameState): FantasyDraft {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  if (draft.status !== "active" && draft.status !== "paused") {
    throw new Error("Fantasy draft queues can only be edited during the draft.");
  }
  return draft;
}

function assertOwnedTeam(state: GameState, teamId: TeamId): void {
  if (!state.user.ownedTeamIds.includes(teamId)) {
    throw new Error("Draft queues can only be managed for owned franchises.");
  }
}

export function getFantasyDraftQueue(
  state: GameState,
  teamId: TeamId,
): PlayerId[] {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return [];
  }
  return [...(draft.teamQueues[teamId] ?? [])];
}

export function addToFantasyDraftQueue(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): GameState {
  const draft = requireActiveOrPausedDraft(state);
  assertOwnedTeam(state, teamId);
  const pool = new Set(draft.poolPlayerIds.map(String));
  if (!pool.has(String(playerId))) {
    throw new Error(`Player "${playerId}" is not in the fantasy draft pool.`);
  }
  const existing = draft.teamQueues[teamId] ?? [];
  if (existing.some((id) => id === playerId)) {
    return state;
  }
  return withFantasyDraft(state, {
    ...draft,
    teamQueues: {
      ...draft.teamQueues,
      [teamId]: [...existing, playerId],
    },
  });
}

export function removeFromFantasyDraftQueue(
  state: GameState,
  teamId: TeamId,
  playerId: PlayerId,
): GameState {
  const draft = requireActiveOrPausedDraft(state);
  assertOwnedTeam(state, teamId);
  const existing = draft.teamQueues[teamId] ?? [];
  if (!existing.some((id) => id === playerId)) {
    return state;
  }
  return withFantasyDraft(state, {
    ...draft,
    teamQueues: {
      ...draft.teamQueues,
      [teamId]: existing.filter((id) => id !== playerId),
    },
  });
}

export function reorderFantasyDraftQueue(
  state: GameState,
  teamId: TeamId,
  orderedPlayerIds: PlayerId[],
): GameState {
  const draft = requireActiveOrPausedDraft(state);
  assertOwnedTeam(state, teamId);
  const existing = draft.teamQueues[teamId] ?? [];
  const byId = new Set(existing.map(String));
  const next: PlayerId[] = [];
  for (const id of orderedPlayerIds) {
    if (byId.has(String(id)) && !next.some((n) => n === id)) {
      next.push(id);
    }
  }
  for (const id of existing) {
    if (!next.some((n) => n === id)) {
      next.push(id);
    }
  }
  return withFantasyDraft(state, {
    ...draft,
    teamQueues: {
      ...draft.teamQueues,
      [teamId]: next,
    },
  });
}

export function setFantasyDraftAutoPickStrategy(
  state: GameState,
  teamId: TeamId,
  strategy: FantasyDraft["autoPickStrategy"][string],
): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  assertOwnedTeam(state, teamId);
  return withFantasyDraft(state, {
    ...draft,
    autoPickStrategy: {
      ...draft.autoPickStrategy,
      [teamId]: strategy,
    },
  });
}

export function updateFantasyDraftSettings(
  state: GameState,
  settings: Partial<FantasyDraft["settings"]>,
): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  return withFantasyDraft(state, {
    ...draft,
    settings: {
      ...draft.settings,
      ...settings,
    },
  });
}

/**
 * First available (undrafted) player in the team's queue, or undefined.
 */
export function getFirstAvailableQueuedPlayer(
  state: GameState,
  teamId: TeamId,
): PlayerId | undefined {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return undefined;
  }
  const selected = new Set(draft.selectedPlayerIds.map(String));
  const queue = draft.teamQueues[teamId] ?? [];
  for (const playerId of queue) {
    if (selected.has(String(playerId))) {
      continue;
    }
    const player = state.world.players[playerId];
    if (player === undefined || player.teamId !== null) {
      continue;
    }
    return playerId;
  }
  return undefined;
}

import type { FantasyDraft } from "@/domain/entities/fantasy-draft";
import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getCurrentPick,
  withFantasyDraft,
} from "@/systems/fantasy-draft/draft-order";

export function getAvailableDraftPlayers(state: GameState): Player[] {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return [];
  }
  const selected = new Set(draft.selectedPlayerIds.map(String));
  const available: Player[] = [];
  for (const playerId of draft.poolPlayerIds) {
    if (selected.has(String(playerId))) {
      continue;
    }
    const player = state.world.players[playerId];
    if (player === undefined) {
      continue;
    }
    if (player.teamId !== null) {
      continue;
    }
    available.push(player);
  }
  return available;
}

export function isTeamOnFantasyDraftClock(
  state: GameState,
  teamId: TeamId,
): boolean {
  const pick = getCurrentPick(state);
  const draft = state.world.fantasyDraft;
  if (pick === undefined || draft === null || draft.status !== "active") {
    return false;
  }
  return pick.teamId === teamId;
}

export function isUserOnFantasyDraftClock(state: GameState): boolean {
  const pick = getCurrentPick(state);
  if (pick === undefined) {
    return false;
  }
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.status !== "active") {
    return false;
  }
  return state.user.ownedTeamIds.includes(pick.teamId);
}

/**
 * Client countdown is presentation only. Server validates expiry from timestamps.
 */
export function isPickExpired(
  draft: FantasyDraft,
  nowIso: string,
): boolean {
  if (!draft.timer.enabled || draft.timer.pickStartedAt === null) {
    return false;
  }
  if (draft.status === "paused") {
    return false;
  }
  const started = Date.parse(draft.timer.pickStartedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(started) || !Number.isFinite(now)) {
    return false;
  }
  return now >= started + draft.timer.secondsPerPick * 1000;
}

export function getRemainingPickSeconds(
  draft: FantasyDraft,
  nowIso: string,
): number | null {
  if (!draft.timer.enabled || draft.timer.pickStartedAt === null) {
    return null;
  }
  if (draft.status === "paused") {
    return draft.timer.secondsPerPick;
  }
  const started = Date.parse(draft.timer.pickStartedAt);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(started) || !Number.isFinite(now)) {
    return null;
  }
  const remainingMs = started + draft.timer.secondsPerPick * 1000 - now;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function pauseFantasyDraft(
  state: GameState,
  nowIso: string,
): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.status !== "active") {
    throw new Error("Fantasy draft is not active.");
  }
  return withFantasyDraft(state, {
    ...draft,
    status: "paused",
    pausedAt: nowIso,
  });
}

/**
 * Resume from paused. Restarts the timer window for the current pick.
 * Also used when loading an active draft that should be treated as paused.
 */
export function resumeFantasyDraft(
  state: GameState,
  nowIso: string,
): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  if (draft.status !== "paused" && draft.status !== "active") {
    throw new Error("Fantasy draft cannot be resumed from this status.");
  }
  return withFantasyDraft(state, {
    ...draft,
    status: "active",
    pausedAt: null,
    timer: {
      ...draft.timer,
      pickStartedAt: draft.timer.enabled ? nowIso : null,
    },
  });
}

/**
 * On load: if draft was active, treat as paused so the timer does not expire
 * while the game was closed.
 */
export function pauseFantasyDraftOnLoad(state: GameState, nowIso: string): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.status !== "active") {
    return state;
  }
  return pauseFantasyDraft(state, nowIso);
}

export function setFantasyDraftAutoPick(
  state: GameState,
  teamId: TeamId,
  enabled: boolean,
): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  if (!state.user.ownedTeamIds.includes(teamId)) {
    throw new Error("Auto-pick can only be set for owned franchises.");
  }
  return withFantasyDraft(state, {
    ...draft,
    userTeamAutoPick: {
      ...draft.userTeamAutoPick,
      [teamId]: enabled,
    },
  });
}

export function setFantasyDraftAutoPickAll(
  state: GameState,
  enabled: boolean,
): GameState {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  const userTeamAutoPick: Record<string, boolean> = {
    ...draft.userTeamAutoPick,
  };
  for (const teamId of state.user.ownedTeamIds) {
    userTeamAutoPick[teamId] = enabled;
  }
  return withFantasyDraft(state, { ...draft, userTeamAutoPick });
}

export function isPlayerDrafted(
  draft: FantasyDraft,
  playerId: PlayerId,
): boolean {
  return draft.selectedPlayerIds.some((id) => id === playerId);
}

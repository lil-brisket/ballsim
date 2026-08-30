import type { FantasyDraftAutoPickStrategy } from "@/domain/entities/fantasy-draft";
import type { DomainEvent } from "@/domain/events/domain-event";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isAiControlledTeam } from "@/state/owner-context";
import {
  getAvailableDraftPlayers,
  isPickExpired,
} from "@/systems/fantasy-draft/draft-clock";
import {
  getCurrentPick,
  getNextPickNumberForTeam,
} from "@/systems/fantasy-draft/draft-order";
import {
  draftTalentScore,
  selectPlayerForTeam,
} from "@/systems/fantasy-draft/draft-evaluation";
import { getFirstAvailableQueuedPlayer } from "@/systems/fantasy-draft/draft-queue";
import { makeFantasyDraftSelection } from "@/systems/fantasy-draft/draft-selection";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";

const MAX_AUTO_PICKS_PER_ADVANCE = 500;

/**
 * Advances the fantasy draft clock by making CPU / auto-pick / timer-expiry
 * selections until a manual user pick is required or the draft completes.
 */
export function advanceFantasyDraftClock(
  state: GameState,
  nowIso: string,
): { state: GameState; events: DomainEvent[]; picksMade: number } {
  let current = state;
  const events: DomainEvent[] = [];
  let picksMade = 0;

  for (let i = 0; i < MAX_AUTO_PICKS_PER_ADVANCE; i += 1) {
    const draft = current.world.fantasyDraft;
    if (draft === null || draft.status !== "active") {
      break;
    }
    if (draft.currentPickNumber === null) {
      break;
    }

    const pick = getCurrentPick(current);
    if (pick === undefined) {
      break;
    }

    const shouldAuto =
      isAiControlledTeam(current, pick.teamId) ||
      Boolean(draft.userTeamAutoPick[pick.teamId]) ||
      isPickExpired(draft, nowIso);

    if (!shouldAuto) {
      break;
    }

    const selected = selectCpuDraftPlayer(current, pick.teamId, pick.round);
    if (selected === undefined) {
      break;
    }

    const result = makeFantasyDraftSelection(current, {
      teamId: pick.teamId,
      playerId: selected,
      nowIso,
      bypassTimerExpiry: true,
    });
    if (!result.success) {
      break;
    }
    current = result.state;
    events.push(...result.events);
    picksMade += 1;
  }

  return { state: current, events, picksMade };
}

/**
 * Session-scoped: advance until the active owner's next pick (or draft end).
 * Does not persist a transient flag — target is computed from owned team.
 */
export function advanceFantasyDraftUntilNextUserPick(
  state: GameState,
  nowIso: string,
): { state: GameState; events: DomainEvent[]; picksMade: number } {
  const draft = state.world.fantasyDraft;
  if (draft === null || draft.status !== "active") {
    return { state, events: [], picksMade: 0 };
  }

  const targetTeamId = state.user.activeOwnerTeamId;
  const targetPick = getNextPickNumberForTeam(state, targetTeamId);

  // Enable auto-pick for all owned teams temporarily for this advance pass.
  let current = state;
  const previousAuto = { ...draft.userTeamAutoPick };
  const enabledAuto: Record<string, boolean> = { ...previousAuto };
  for (const teamId of state.user.ownedTeamIds) {
    enabledAuto[teamId] = true;
  }
  current = {
    ...current,
    world: {
      ...current.world,
      fantasyDraft: {
        ...draft,
        userTeamAutoPick: enabledAuto,
      },
    },
  };

  const events: DomainEvent[] = [];
  let picksMade = 0;

  for (let i = 0; i < MAX_AUTO_PICKS_PER_ADVANCE; i += 1) {
    const d = current.world.fantasyDraft;
    if (d === null || d.status !== "active" || d.currentPickNumber === null) {
      break;
    }
    if (targetPick !== null && d.currentPickNumber >= targetPick) {
      break;
    }

    const pick = getCurrentPick(current);
    if (pick === undefined) {
      break;
    }

    // Stop if we've reached a manual pick for the target team without auto.
    if (
      pick.teamId === targetTeamId &&
      targetPick !== null &&
      d.currentPickNumber === targetPick
    ) {
      break;
    }

    const selected = selectCpuDraftPlayer(current, pick.teamId, pick.round);
    if (selected === undefined) {
      break;
    }

    const result = makeFantasyDraftSelection(current, {
      teamId: pick.teamId,
      playerId: selected,
      nowIso,
      bypassTimerExpiry: true,
    });
    if (!result.success) {
      break;
    }
    current = result.state;
    events.push(...result.events);
    picksMade += 1;
  }

  // Restore prior auto-pick flags (except leave draft status as-is).
  const after = current.world.fantasyDraft;
  if (after !== null) {
    current = {
      ...current,
      world: {
        ...current.world,
        fantasyDraft: {
          ...after,
          userTeamAutoPick: previousAuto,
        },
      },
    };
  }

  return { state: current, events, picksMade };
}

function resolveStrategy(
  state: GameState,
  teamId: TeamId,
): FantasyDraftAutoPickStrategy {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return "best_fit";
  }
  const configured = draft.autoPickStrategy[teamId];
  if (configured) {
    return configured;
  }
  if (state.user.ownedTeamIds.includes(teamId)) {
    return "queue_then_best_fit";
  }
  return "best_fit";
}

function selectBestAvailable(
  state: GameState,
  teamId: TeamId,
  available: ReturnType<typeof getAvailableDraftPlayers>,
): PlayerId | undefined {
  const prefs = resolveFranchisePreferences(state, teamId)?.preferences;
  let bestId: PlayerId | undefined;
  let bestScore = -Infinity;
  for (const player of available) {
    const score = draftTalentScore(player, prefs);
    if (
      score > bestScore ||
      (score === bestScore &&
        bestId !== undefined &&
        String(player.id) < String(bestId))
    ) {
      bestScore = score;
      bestId = player.id;
    }
  }
  return bestId;
}

export function selectCpuDraftPlayer(
  state: GameState,
  teamId: TeamId,
  round: number,
) {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return undefined;
  }
  const strategy = resolveStrategy(state, teamId);
  const available = getAvailableDraftPlayers(state);

  if (
    strategy === "queue_then_best_fit" ||
    strategy === "queue_then_best_available"
  ) {
    const queued = getFirstAvailableQueuedPlayer(state, teamId);
    if (queued !== undefined) {
      return queued;
    }
  }

  if (
    strategy === "best_available" ||
    strategy === "queue_then_best_available"
  ) {
    return selectBestAvailable(state, teamId, available);
  }

  return selectPlayerForTeam(
    state,
    teamId,
    available,
    round,
    draft.picksPerTeam,
  );
}

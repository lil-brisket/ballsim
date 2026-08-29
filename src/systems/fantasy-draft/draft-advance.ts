import type { DomainEvent } from "@/domain/events/domain-event";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isAiControlledTeam } from "@/state/owner-context";
import {
  getAvailableDraftPlayers,
  isPickExpired,
} from "@/systems/fantasy-draft/draft-clock";
import { getCurrentPick } from "@/systems/fantasy-draft/draft-order";
import { selectPlayerForTeam } from "@/systems/fantasy-draft/draft-evaluation";
import { makeFantasyDraftSelection } from "@/systems/fantasy-draft/draft-selection";

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

export function selectCpuDraftPlayer(
  state: GameState,
  teamId: TeamId,
  round: number,
) {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return undefined;
  }
  const available = getAvailableDraftPlayers(state);
  return selectPlayerForTeam(
    state,
    teamId,
    available,
    round,
    draft.picksPerTeam,
  );
}

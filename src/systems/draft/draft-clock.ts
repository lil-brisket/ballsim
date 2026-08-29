import { draftClassIdFor } from "@/domain/entities/draft";
import type { DraftOrderSlot } from "@/domain/entities/draft";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft/draft-order";
import { getActivePhaseId } from "@/systems/phase-engine";

/**
 * First unused draft order slot on the active draft for the current season year.
 * Derived — never persist a separate "on the clock" flag.
 */
export function getActiveDraftOnClockSlot(
  state: GameState,
): DraftOrderSlot | undefined {
  if (getActivePhaseId(state) !== "offseason.draft") {
    return undefined;
  }
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.status !== "active") {
    return undefined;
  }
  return draft.order.find((slot) => slot.status === "available");
}

/**
 * True when the next unused draft slot belongs to the given team.
 */
export function isTeamOnDraftClock(
  state: GameState,
  teamId: TeamId,
): boolean {
  const slot = getActiveDraftOnClockSlot(state);
  return slot !== undefined && slot.ownerTeamId === teamId;
}

/**
 * True when any owned franchise is on the draft clock.
 * Simulation / UI should key off ownedTeamIds, not only the active team.
 */
export function isUserOnDraftClock(state: GameState): boolean {
  const slot = getActiveDraftOnClockSlot(state);
  if (slot === undefined) {
    return false;
  }
  return state.user.ownedTeamIds.includes(slot.ownerTeamId);
}

import { draftClassIdFor } from "@/domain/entities/draft";
import type { DraftOrderSlot } from "@/domain/entities/draft";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft/draft-order";

/**
 * First unused draft order slot on the active draft for the current season year.
 * Derived — never persist a separate "on the clock" flag.
 */
export function getActiveDraftOnClockSlot(
  state: GameState,
): DraftOrderSlot | undefined {
  if (state.competition.season.phase !== "offseason") {
    return undefined;
  }
  if (state.competition.season.offseasonStage !== "draft") {
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
 * True when the user-controlled team is on the draft clock.
 */
export function isUserOnDraftClock(state: GameState): boolean {
  return isTeamOnDraftClock(state, state.user.controlledTeamId);
}

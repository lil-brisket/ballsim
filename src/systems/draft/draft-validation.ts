import type { DraftClass } from "@/domain/entities/draft";
import type {
  DraftClassId,
  DraftPickId,
  PlayerId,
  TeamId,
} from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type {
  DraftValidationIssue,
  DraftValidationResult,
} from "@/systems/draft/draft-types";

export type MakeDraftSelectionInput = {
  draftClassId: DraftClassId;
  draftPickId: DraftPickId;
  prospectPlayerId: PlayerId;
  /** Caller's claimed selecting team; must match slot.ownerTeamId. */
  teamId: TeamId;
};

/**
 * Canonical draft selection validation. Never mutates state. Consumes no RNG.
 */
export function validateDraftSelection(
  state: GameState,
  input: MakeDraftSelectionInput,
): DraftValidationResult {
  const errors: DraftValidationIssue[] = [];
  const warnings: DraftValidationIssue[] = [];

  const draft = state.world.drafts[input.draftClassId] as
    | DraftClass
    | undefined;
  if (draft === undefined) {
    errors.push({
      code: "DRAFT_NOT_FOUND",
      message: `Draft "${input.draftClassId}" does not exist.`,
    });
    return { valid: false, errors, warnings };
  }

  if (draft.status !== "active") {
    errors.push({
      code: "DRAFT_NOT_ACTIVE",
      message: `Draft "${input.draftClassId}" is "${draft.status}"; selections require "active".`,
    });
  }

  const slot = draft.order.find(
    (entry) => entry.draftPickId === input.draftPickId,
  );
  if (slot === undefined) {
    errors.push({
      code: "PICK_NOT_FOUND",
      message: `Draft pick "${input.draftPickId}" is not in draft order.`,
    });
  } else {
    if (slot.status !== "available") {
      errors.push({
        code: "PICK_USED",
        message: `Draft pick "${input.draftPickId}" is already used.`,
      });
    }
    if (input.teamId !== slot.ownerTeamId) {
      errors.push({
        code: "TEAM_OWNERSHIP",
        message: `Claimed team "${input.teamId}" does not own pick "${input.draftPickId}" (owner is "${slot.ownerTeamId}").`,
      });
    }
    if (state.world.teams[slot.ownerTeamId] === undefined) {
      errors.push({
        code: "OWNER_TEAM_MISSING",
        message: `Owner team "${slot.ownerTeamId}" is missing from world.teams.`,
      });
    }
  }

  const prospect = draft.prospects[input.prospectPlayerId];
  if (prospect === undefined) {
    errors.push({
      code: "PROSPECT_NOT_FOUND",
      message: `Prospect "${input.prospectPlayerId}" is not in draft class "${input.draftClassId}".`,
    });
  } else if (prospect.status !== "eligible") {
    errors.push({
      code: "PROSPECT_SELECTED",
      message: `Prospect "${input.prospectPlayerId}" has already been selected.`,
    });
  }

  if (state.world.players[input.prospectPlayerId] !== undefined) {
    errors.push({
      code: "PLAYER_ALREADY_EXISTS",
      message: `Player "${input.prospectPlayerId}" already exists in world.players.`,
    });
  }

  if (state.world.draftPicks[input.draftPickId] === undefined) {
    errors.push({
      code: "DRAFT_PICK_ASSET_MISSING",
      message: `Draft pick asset "${input.draftPickId}" is missing from world.draftPicks.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import {
  getCurrentPick,
} from "@/systems/fantasy-draft/draft-order";
import {
  isPickExpired,
  isPlayerDrafted,
} from "@/systems/fantasy-draft/draft-clock";
import { FANTASY_DRAFT_PICKS_PER_TEAM } from "@/systems/fantasy-draft/fantasy-draft-config";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type FantasyDraftValidationIssue = {
  code: string;
  message: string;
};

export type FantasyDraftValidationResult = {
  valid: boolean;
  errors: FantasyDraftValidationIssue[];
  warnings: FantasyDraftValidationIssue[];
};

export type MakeFantasyDraftSelectionInput = {
  teamId: TeamId;
  playerId: PlayerId;
  /** Wall-clock ISO used for timer expiry checks. */
  nowIso: string;
  /** Internal: allow selection after timer expiry (auto-pick / CPU fallback). */
  bypassTimerExpiry?: boolean;
};

/**
 * Pure validation. Never mutates state. Consumes no RNG.
 */
export function validateFantasyDraftSelection(
  state: GameState,
  input: MakeFantasyDraftSelectionInput,
): FantasyDraftValidationResult {
  const errors: FantasyDraftValidationIssue[] = [];
  const warnings: FantasyDraftValidationIssue[] = [];

  const draft = state.world.fantasyDraft;
  if (draft === null) {
    errors.push({
      code: "DRAFT_NOT_FOUND",
      message: "Fantasy draft does not exist.",
    });
    return { valid: false, errors, warnings };
  }

  if (draft.status === "paused") {
    errors.push({
      code: "DRAFT_PAUSED",
      message: "Fantasy draft is paused.",
    });
  } else if (draft.status !== "active") {
    errors.push({
      code: "DRAFT_NOT_ACTIVE",
      message: `Fantasy draft is "${draft.status}"; selections require "active".`,
    });
  }

  const pick = getCurrentPick(state);
  if (pick === undefined) {
    errors.push({
      code: "NO_ACTIVE_PICK",
      message: "There is no active fantasy draft pick.",
    });
  } else {
    if (input.teamId !== pick.teamId) {
      errors.push({
        code: "TEAM_OWNERSHIP",
        message: `Claimed team "${input.teamId}" is not on the clock (owner is "${pick.teamId}").`,
      });
    }
    if (state.world.teams[pick.teamId] === undefined) {
      errors.push({
        code: "OWNER_TEAM_MISSING",
        message: `Owner team "${pick.teamId}" is missing from world.teams.`,
      });
    }
  }

  if (!input.bypassTimerExpiry && isPickExpired(draft, input.nowIso)) {
    errors.push({
      code: "PICK_EXPIRED",
      message: "The draft timer has expired for this pick.",
    });
  }

  const player = state.world.players[input.playerId];
  if (player === undefined) {
    errors.push({
      code: "PLAYER_NOT_FOUND",
      message: `Player "${input.playerId}" does not exist.`,
    });
  } else {
    if (!draft.poolPlayerIds.includes(input.playerId)) {
      errors.push({
        code: "PLAYER_NOT_IN_POOL",
        message: `Player "${input.playerId}" is not in the fantasy pool.`,
      });
    }
    if (isPlayerDrafted(draft, input.playerId) || player.teamId !== null) {
      errors.push({
        code: "PLAYER_ALREADY_DRAFTED",
        message: `Player "${input.playerId}" has already been drafted.`,
      });
    }
    if (
      !(PLAYER_POSITIONS as readonly string[]).includes(player.position)
    ) {
      errors.push({
        code: "INVALID_POSITION",
        message: `Player position "${player.position}" is not allowed.`,
      });
    }
  }

  if (pick !== undefined) {
    const team = state.world.teams[pick.teamId];
    if (team !== undefined) {
      if (team.roster.length >= TRADE_ROSTER_RULES.maxRosterSize) {
        errors.push({
          code: "ROSTER_FULL",
          message: `Team roster is already at max size (${TRADE_ROSTER_RULES.maxRosterSize}).`,
        });
      }
      if (team.roster.length >= FANTASY_DRAFT_PICKS_PER_TEAM) {
        errors.push({
          code: "PICKS_COMPLETE",
          message: `Team has already drafted ${FANTASY_DRAFT_PICKS_PER_TEAM} players.`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

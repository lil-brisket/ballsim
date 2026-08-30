import type { DraftPick } from "@/domain/entities/draft-pick";
import type { DraftPickId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  DRAFT_PICK_TRADE_HORIZON_YEARS,
  DRAFT_ROUNDS,
} from "@/systems/league-rules/invariants";
import type { RuleViolation } from "@/systems/league-rules/types";

/** Draft year for next draft relative to competition season year. */
function draftYearForSeason(seasonYear: number): number {
  return seasonYear + 1;
}

export function isPickAvailable(pick: DraftPick): boolean {
  return (pick.status ?? "available") === "available";
}

export function isPickConsumed(state: GameState, pickId: DraftPickId): boolean {
  const pick = state.world.draftPicks[pickId];
  if (pick !== undefined && pick.status === "used") {
    return true;
  }
  for (const draft of Object.values(state.world.drafts)) {
    const slot = draft.order.find((entry) => entry.draftPickId === pickId);
    if (slot?.status === "used") {
      return true;
    }
  }
  return false;
}

/**
 * Max tradable season year for picks relative to current competition season year.
 * Inclusive: seasonYear + DRAFT_PICK_TRADE_HORIZON_YEARS is allowed;
 * one year beyond is not.
 */
export function maxTradablePickSeasonYear(competitionSeasonYear: number): number {
  return competitionSeasonYear + DRAFT_PICK_TRADE_HORIZON_YEARS;
}

export function canTradeDraftPick(
  state: GameState,
  pickId: DraftPickId,
): { allowed: boolean; violations: RuleViolation[] } {
  const violations: RuleViolation[] = [];
  const pick = state.world.draftPicks[pickId];
  if (pick === undefined) {
    violations.push({
      code: "PICK_NOT_FOUND",
      message: `Draft pick "${pickId}" does not exist.`,
      tier: "hard_lock",
      action: "pick_trade",
    });
    return { allowed: false, violations };
  }
  if (!isPickAvailable(pick) || isPickConsumed(state, pickId)) {
    violations.push({
      code: "PICK_ALREADY_USED",
      message: `Draft pick unavailable — this pick is already owned/used.`,
      tier: "hard_lock",
      action: "pick_trade",
    });
  }
  const maxYear = maxTradablePickSeasonYear(state.competition.season.year);
  if (pick.seasonYear > maxYear) {
    violations.push({
      code: "PICK_BEYOND_HORIZON",
      message: `Draft pick season ${pick.seasonYear} is beyond the ${DRAFT_PICK_TRADE_HORIZON_YEARS}-year trade horizon (max ${maxYear}).`,
      tier: "hard_lock",
      action: "pick_trade",
    });
  }
  if (pick.round < 1 || pick.round > DRAFT_ROUNDS) {
    violations.push({
      code: "INVALID_DRAFT_ROUND",
      message: `Draft round must be 1–${DRAFT_ROUNDS}.`,
      tier: "hard_lock",
      action: "pick_trade",
    });
  }
  return { allowed: violations.length === 0, violations };
}

export function canActivateDraft(state: GameState): {
  allowed: boolean;
  violations: RuleViolation[];
} {
  const violations: RuleViolation[] = [];
  const draftYear = draftYearForSeason(state.competition.season.year);
  const drafts = Object.values(state.world.drafts);
  const draft =
    drafts.find((d) => d.seasonYear === draftYear) ??
    drafts.find((d) => d.status === "not_started") ??
    null;

  if (draft === null) {
    violations.push({
      code: "DRAFT_CLASS_MISSING",
      message: "Draft cannot begin — draft class does not exist.",
      tier: "phase_lock",
      action: "activate_draft",
    });
    return { allowed: false, violations };
  }

  const teamCount = Object.keys(state.world.teams).length;
  const expectedSlots = teamCount * DRAFT_ROUNDS;
  if (draft.order.length !== expectedSlots) {
    violations.push({
      code: "DRAFT_ORDER_INVALID",
      message: `Draft cannot begin — draft order has not been finalized (expected ${expectedSlots} picks, found ${draft.order.length}).`,
      tier: "hard_lock",
      action: "activate_draft",
    });
  }

  const seen = new Set<string>();
  for (const slot of draft.order) {
    if (seen.has(slot.draftPickId)) {
      violations.push({
        code: "DUPLICATE_DRAFT_PICK",
        message: `Draft order contains duplicate pick "${slot.draftPickId}".`,
        tier: "hard_lock",
        action: "activate_draft",
      });
    }
    seen.add(slot.draftPickId);
    if (state.world.draftPicks[slot.draftPickId] === undefined) {
      violations.push({
        code: "DRAFT_PICK_ASSET_MISSING",
        message: `Draft pick asset "${slot.draftPickId}" is missing.`,
        tier: "hard_lock",
        action: "activate_draft",
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}

export function isDraftCompleteForYear(
  state: GameState,
  seasonYear: number,
): boolean {
  const draftYear = draftYearForSeason(seasonYear);
  for (const draft of Object.values(state.world.drafts)) {
    if (
      (draft.seasonYear === draftYear || draft.seasonYear === seasonYear) &&
      draft.status === "complete"
    ) {
      return true;
    }
  }
  return false;
}

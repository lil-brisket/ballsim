/**
 * The board's soft fail state. Ownership confidence is reviewed when a
 * season is finalized: a season that ends with ownership concerned or
 * displeased moves the board one stage up (warning, then frozen
 * discretionary spending, then a blocking "the board wants changes"
 * decision); a season that ends confident or supportive moves it one stage
 * down. Deterministic: no RNG.
 */

import type {
  BoardPressureStage,
  OwnershipConfidenceState,
} from "@/domain/entities/ownership-confidence";
import { createOwnerNotification } from "@/domain/entities/owner-notification";
import type { TeamId } from "@/domain/ids";
import { asOwnerNotificationId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnedFranchise,
  getActiveOwnerTeamId,
  getOwnedFranchiseOrUndefined,
  withOwnedFranchise,
} from "@/state/owner-context";
import { retainOwnerNotifications } from "@/systems/owner-notifications";
import {
  applyCashAndBooksImpact,
  assertSufficientBusinessFunds,
} from "@/systems/team-finances";

/** Paid to the board's partners to settle an ultimatum and lift the freeze. */
export const BOARD_SETTLEMENT_COST = 6_000_000;
/** Concern after accepting the board's turnaround plan (still "concerned"). */
export const BOARD_PLAN_CONCERN_LEVEL = 60;
/** Concern after settling with the board. */
export const BOARD_SETTLEMENT_CONCERN_LEVEL = 50;

const STAGE_ORDER: readonly BoardPressureStage[] = [
  "none",
  "warning",
  "restricted",
  "ultimatum",
];

function stepStage(stage: BoardPressureStage, by: 1 | -1): BoardPressureStage {
  const index = STAGE_ORDER.indexOf(stage) + by;
  return STAGE_ORDER[Math.max(0, Math.min(STAGE_ORDER.length - 1, index))]!;
}

export function boardPressureStage(
  state: GameState,
  teamId: TeamId,
): BoardPressureStage {
  return (
    getOwnedFranchiseOrUndefined(state, teamId)?.ownershipConfidence
      .boardPressure.stage ?? "none"
  );
}

/** Restricted and ultimatum: no facility upgrades, marketing raises or promotions. */
export function isDiscretionarySpendingFrozen(
  state: GameState,
  teamId: TeamId,
): boolean {
  const stage = boardPressureStage(state, teamId);
  return stage === "restricted" || stage === "ultimatum";
}

/** The board's decision waits for the active owner; time cannot advance. */
export function hasPendingBoardDirective(state: GameState): boolean {
  return boardPressureStage(state, getActiveOwnerTeamId(state)) === "ultimatum";
}

const STAGE_NOTICE: Record<
  Exclude<BoardPressureStage, "none">,
  { title: string; message: string; severity: "warning" | "critical" }
> = {
  warning: {
    title: "Board Warning",
    message:
      "The board has issued a formal warning after a season that left ownership unhappy. Another like it and discretionary spending will be frozen.",
    severity: "warning",
  },
  restricted: {
    title: "Spending Frozen",
    message:
      "The board has frozen discretionary spending: no facility upgrades, marketing increases or game-day promotions until ownership's confidence recovers.",
    severity: "critical",
  },
  ultimatum: {
    title: "The Board Wants Changes",
    message:
      "After another disappointing season the board is demanding changes. Respond to the board before the season can continue.",
    severity: "critical",
  },
};

function withBoardStage(
  state: GameState,
  teamId: TeamId,
  update: (confidence: OwnershipConfidenceState) => OwnershipConfidenceState,
): GameState {
  return withOwnedFranchise(state, teamId, (franchise) => ({
    ...franchise,
    ownershipConfidence: update(franchise.ownershipConfidence),
  }));
}

function notifyStage(
  state: GameState,
  teamId: TeamId,
  stage: BoardPressureStage,
): GameState {
  if (stage === "none") {
    return state;
  }
  const notice = STAGE_NOTICE[stage];
  const year = state.competition.season.year;
  const date = state.world.calendar.currentDate;
  const dedupeKey = `board_pressure:${teamId}:${year}:${stage}`;
  const franchise = getActiveOwnedFranchise(state);
  if (franchise.notifications.some((item) => item.dedupeKey === dedupeKey)) {
    return state;
  }
  const notification = createOwnerNotification({
    id: asOwnerNotificationId(`notif_board_${stage}_${teamId}_${year}`),
    type: "ownership_pressure",
    title: notice.title,
    message: notice.message,
    occurredOn: date,
    severity: notice.severity,
    read: false,
    dedupeKey,
    relatedTeamId: teamId,
  });
  return withOwnedFranchise(state, teamId, (owned) => ({
    ...owned,
    notifications: retainOwnerNotifications(
      [...owned.notifications, notification],
      date,
    ),
  }));
}

/**
 * Season-end review for the active owned franchise (the one whose season
 * notes are kept). Runs once per season from finalizeCompletedSeason.
 */
export function reviewBoardPressure(state: GameState): GameState {
  const teamId = getActiveOwnerTeamId(state);
  const confidence = getActiveOwnedFranchise(state).ownershipConfidence;
  const current = confidence.boardPressure.stage;
  let next = current;
  if (confidence.mood === "concerned" || confidence.mood === "displeased") {
    next = stepStage(current, 1);
  } else if (
    confidence.mood === "confident" ||
    confidence.mood === "supportive"
  ) {
    next = stepStage(current, -1);
  }
  if (next === current) {
    return state;
  }
  const updated = withBoardStage(state, teamId, (owned) => ({
    ...owned,
    boardPressure: { stage: next },
  }));
  // Only escalations are announced; relief shows on the ownership screen.
  return STAGE_ORDER.indexOf(next) > STAGE_ORDER.indexOf(current)
    ? notifyStage(updated, teamId, next)
    : updated;
}

export type BoardDirectiveChoice = "accept_plan" | "settle";

export function isBoardDirectiveChoice(
  value: string,
): value is BoardDirectiveChoice {
  return value === "accept_plan" || value === "settle";
}

/**
 * Answer the board's ultimatum for the active owned franchise.
 * - accept_plan: the freeze stays (restricted) and ownership stays
 *   concerned; one more bad season brings the board back.
 * - settle: pay the board's partners, lift the freeze (back to a warning)
 *   and reset concern to watchful.
 */
export function resolveBoardDirective(
  state: GameState,
  choice: BoardDirectiveChoice,
): SystemResult {
  if (!hasPendingBoardDirective(state)) {
    throw new Error("The board has no pending demands.");
  }
  const teamId = getActiveOwnerTeamId(state);
  const date = state.world.calendar.currentDate;
  if (choice === "accept_plan") {
    return systemResult(
      withBoardStage(state, teamId, (confidence) => ({
        ...confidence,
        mood: "concerned",
        concernLevel: BOARD_PLAN_CONCERN_LEVEL,
        lastConfidenceChangeOn: date,
        boardPressure: { stage: "restricted" },
      })),
    );
  }
  assertSufficientBusinessFunds(
    state,
    teamId,
    BOARD_SETTLEMENT_COST,
    "Settling with the board",
  );
  const paid = applyCashAndBooksImpact(
    state,
    teamId,
    -BOARD_SETTLEMENT_COST,
    state.competition.season.year,
  );
  return systemResult(
    withBoardStage(paid.state, teamId, (confidence) => ({
      ...confidence,
      mood: "watchful",
      concernLevel: BOARD_SETTLEMENT_CONCERN_LEVEL,
      lastConfidenceChangeOn: date,
      boardPressure: { stage: "warning" },
    })),
    paid.events,
  );
}

import { getActiveOwnerDecision } from "@/domain/entities/owner-decision";
import type { GameState } from "@/state/game-state";
import { getActiveDraftOnClockSlot } from "@/systems/draft/draft-clock";
import { shouldStopForDraftClock } from "@/systems/simulation/draft-clock-stop";
import {
  buildTradeReviewView,
  type TradeReviewView,
} from "@/state/trade-review-view";

export type CalendarInterrupt =
  | { kind: "trade_offer"; decisionId: string; review: TradeReviewView }
  | {
      kind: "draft_clock";
      pickNumber: number;
      teamName: string;
      draftHref: string;
    };

export function calendarInterruptKey(interrupt: CalendarInterrupt): string {
  return interrupt.kind === "trade_offer"
    ? `trade_offer:${interrupt.decisionId}`
    : `draft_clock:${interrupt.pickNumber}`;
}

/**
 * Trade-first interrupt payload. Draft clock only when pick assist cannot
 * execute (same rule as the simulation day loop).
 */
export function buildCalendarInterrupt(
  state: GameState,
  saveId: string,
): CalendarInterrupt | null {
  const blocking = getActiveOwnerDecision(state.user);
  if (blocking?.type === "trade_offer") {
    const review = buildTradeReviewView(state, blocking.id);
    if (review) {
      return {
        kind: "trade_offer",
        decisionId: blocking.id,
        review,
      };
    }
  }

  if (!shouldStopForDraftClock(state)) {
    return null;
  }
  const slot = getActiveDraftOnClockSlot(state);
  if (!slot) {
    return null;
  }
  const team = state.world.teams[slot.ownerTeamId];
  return {
    kind: "draft_clock",
    pickNumber: slot.overallPick,
    teamName: team ? `${team.city} ${team.name}` : slot.ownerTeamId,
    draftHref: `/dashboard/${saveId}/draft`,
  };
}

export function remainingResumeTo(
  currentDate: string,
  resumeTo: string | null | undefined,
): string | null {
  if (!resumeTo || !/^\d{4}-\d{2}-\d{2}$/.test(resumeTo)) {
    return null;
  }
  return resumeTo > currentDate ? resumeTo : null;
}

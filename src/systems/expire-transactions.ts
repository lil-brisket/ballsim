import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions/enqueue-trade-offer";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { expireRfaOfferSheets } from "@/systems/rfa";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";

export type ClosedWindowKind =
  | "trade_deadline"
  | "free_agency"
  | "rfa_match";

/**
 * Expire all pending transactions whose legal window has closed.
 * Idempotent.
 */
export function expireTransactionsForClosedWindow(
  state: GameState,
  windowKind: ClosedWindowKind,
): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];

  if (windowKind === "trade_deadline") {
    const expired = expirePendingTradeOffers(current);
    current = expired.state;
    events.push(...expired.events);
  }

  if (windowKind === "free_agency") {
    const withdrawn = withdrawOpenFreeAgencyOffers(current);
    current = withdrawn.state;
    events.push(...withdrawn.events);
  }

  if (windowKind === "rfa_match") {
    const rfa = expireRfaOfferSheets(current);
    current = rfa.state;
    events.push(...rfa.events);
  }

  return systemResult(current, events);
}

/**
 * Call each day during advanceSimulation when windows may have closed.
 */
export function processWindowExpirations(state: GameState): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];
  const calendar = getCalendarContext(current);
  const phaseId = readActivePhaseId(current);

  if (
    phaseId === "regular" &&
    !calendar.tradesOpen &&
    calendar.tradeDeadlineDate != null
  ) {
    const result = expireTransactionsForClosedWindow(
      current,
      "trade_deadline",
    );
    current = result.state;
    events.push(...result.events);
  }

  if (phaseId === "offseason.free_agency") {
    const result = expireTransactionsForClosedWindow(current, "rfa_match");
    current = result.state;
    events.push(...result.events);
  }

  return systemResult(current, events);
}

function expirePendingTradeOffers(state: GameState): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];
  const pending = [...current.user.pendingOwnerDecisions];
  for (const decision of pending) {
    if (decision.type !== "trade_offer") continue;
    const { state: next } = resolvePendingOwnerDecision(current, {
      decisionId: decision.id,
      status: "declined",
      decisionSource: "system",
    });
    current = next;
    events.push(
      createDomainEvent({
        type: "TradeOfferExpired",
        occurredOn: current.world.calendar.currentDate,
        payload: {
          decisionId: decision.id,
          reason: "trade_deadline_passed",
        },
      }),
    );
  }
  return systemResult(current, events);
}

export function withdrawOpenFreeAgencyOffers(state: GameState): SystemResult {
  const offers = { ...state.business.freeAgency.offers };
  let changed = false;
  const events: DomainEvent[] = [];
  const date = state.world.calendar.currentDate;

  for (const [id, offer] of Object.entries(offers)) {
    if (!isOpenOffer(offer.status)) continue;
    offers[id] = {
      ...offer,
      status: "withdrawn",
      updatedOn: date,
    };
    changed = true;
    events.push(
      createDomainEvent({
        type: "FreeAgencyOfferWithdrawn",
        occurredOn: date,
        payload: { offerId: id, reason: "fa_window_closed" },
      }),
    );
  }

  if (!changed) {
    return systemResult(state);
  }
  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        freeAgency: { offers },
      },
    },
    events,
  );
}

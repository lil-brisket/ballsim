import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

export const TICKET_PRICE_MIN = 10;
export const TICKET_PRICE_MAX = 250;

/**
 * Owner/AI ticket pricing command. Shared by UI and AI (E4 / E14).
 */
export function setTicketPrice(
  state: GameState,
  teamId: TeamId,
  ticketPrice: number,
): SystemResult {
  if (
    !Number.isInteger(ticketPrice) ||
    ticketPrice < TICKET_PRICE_MIN ||
    ticketPrice > TICKET_PRICE_MAX
  ) {
    throw new Error(
      `setTicketPrice: price must be an integer between ${TICKET_PRICE_MIN} and ${TICKET_PRICE_MAX}.`,
    );
  }
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`setTicketPrice: franchiseOps missing for "${teamId}".`);
  }
  if (ops.ticketPrice === ticketPrice) {
    return systemResult(state);
  }
  return systemResult({
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: { ...ops, ticketPrice },
      },
    },
  });
}

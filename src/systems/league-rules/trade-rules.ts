import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import type { GameState } from "@/state/game-state";
import { TRADE_DEADLINE_SEASON_FRACTION } from "@/systems/league-rules/invariants";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import type { RuleViolation } from "@/systems/league-rules/types";

/**
 * Resolve trade deadline from calendar span [seasonStart, seasonEnd].
 * Uses hard-lock fraction (0.6), not GameSettings.
 *
 * Definition: 60% of regular-season calendar span, NOT games played.
 * tradesOpen when currentDate < deadlineDate (deadline day itself is closed).
 */
export function resolveHardLockTradeDeadlineDate(
  seasonStart: string | null,
  seasonEnd: string | null,
): string | null {
  if (seasonStart === null || seasonEnd === null || seasonEnd < seasonStart) {
    return null;
  }
  const spanDays = calendarDaysBetween(seasonStart, seasonEnd);
  const offset = Math.max(
    0,
    Math.round(spanDays * TRADE_DEADLINE_SEASON_FRACTION),
  );
  return addCalendarDays(seasonStart, offset);
}

/**
 * Trades are open during regular season only when currentDate < deadlineDate.
 * Offseason / preseason reopen is handled separately by phase matrix.
 */
export function areTradesOpenHardLock(
  lifecyclePhase: string,
  currentDate: string,
  tradeDeadlineDate: string | null,
): boolean {
  if (lifecyclePhase !== "regular") {
    return false;
  }
  if (tradeDeadlineDate === null) {
    return true;
  }
  return currentDate < tradeDeadlineDate;
}

export function checkTradeWindow(
  state: GameState,
): { allowed: boolean; violations: RuleViolation[] } {
  const phaseId = readActivePhaseId(state);

  if (phaseId === "preseason.preparation") {
    return { allowed: true, violations: [] };
  }
  if (phaseId.startsWith("offseason.")) {
    if (phaseId === "offseason.season_transition") {
      return {
        allowed: false,
        violations: [
          {
            code: "TRADES_NOT_OPEN",
            message: "Trades are not open during season transition.",
            tier: "phase_lock",
            action: "trade",
          },
        ],
      };
    }
    return { allowed: true, violations: [] };
  }

  if (phaseId !== "regular") {
    return {
      allowed: false,
      violations: [
        {
          code: "TRADES_CLOSED_PHASE",
          message: "Trades closed — not in a trade-legal phase.",
          tier: "phase_lock",
          action: "trade",
        },
      ],
    };
  }

  const deadline =
    state.competition.season.tradeDeadlineDate ??
    resolveDeadlineFromState(state);
  const currentDate = state.world.calendar.currentDate;
  if (deadline !== null && currentDate >= deadline) {
    return {
      allowed: false,
      violations: [
        {
          code: "TRADE_DEADLINE_PASSED",
          message: "Trades closed — trade deadline has passed.",
          tier: "hard_lock",
          action: "trade",
        },
      ],
    };
  }
  return { allowed: true, violations: [] };
}

function resolveDeadlineFromState(state: GameState): string | null {
  const start =
    state.competition.season.regularSeasonStartDate ??
    readScheduleBounds(state).earliest;
  const end = readScheduleBounds(state).latest;
  return resolveHardLockTradeDeadlineDate(start, end);
}

function readScheduleBounds(state: GameState): {
  earliest: string | null;
  latest: string | null;
} {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (earliest === null || game.date < earliest) earliest = game.date;
    if (latest === null || game.date > latest) latest = game.date;
  }
  return { earliest, latest };
}

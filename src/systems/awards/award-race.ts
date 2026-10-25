import {
  addCalendarDays,
  getCalendarMonthId,
  parseCalendarDate,
} from "@/domain/calendar-date";
import type {
  AwardCandidateResult,
  AwardDefinitionId,
  AwardResult,
} from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import {
  evaluateCoachOfYear,
  evaluateDefensivePlayerOfMonth,
  evaluateDpoy,
  evaluateMostImproved,
  evaluateMvp,
  evaluatePlayerOfMonth,
  evaluateRookieOfMonth,
  evaluateRoy,
  evaluateSixthMan,
} from "@/systems/awards/evaluate-awards";

/**
 * Who is in contention for an award that has not been decided yet.
 * Contenders are in score order; the final vote can still pick any of them.
 */
export type AwardRace = {
  awardId: AwardDefinitionId;
  /** YYYY-MM for monthly races; null for season awards. */
  period: string | null;
  /** Inclusive cut-off: the last day of the most recent completed week. */
  throughDate: string;
  contenders: AwardCandidateResult[];
};

type RaceEvaluator = (
  state: GameState,
  throughDate: string,
  period: string,
) => AwardResult | null;

const RACE_EVALUATORS: Record<AwardDefinitionId, RaceEvaluator | null> = {
  player_of_month: (state, throughDate, period) =>
    evaluatePlayerOfMonth(state, period, { throughDate }),
  rookie_of_month: (state, throughDate, period) =>
    evaluateRookieOfMonth(state, period, { throughDate }),
  defensive_player_of_month: (state, throughDate, period) =>
    evaluateDefensivePlayerOfMonth(state, period, { throughDate }),
  mvp: (state, throughDate) => evaluateMvp(state, { throughDate }),
  dpoy: (state, throughDate) => evaluateDpoy(state, { throughDate }),
  roy: (state, throughDate) => evaluateRoy(state, { throughDate }),
  sixth_man: (state, throughDate) => evaluateSixthMan(state, { throughDate }),
  most_improved: (state, throughDate) =>
    evaluateMostImproved(state, { throughDate }),
  coach_of_year: (state, throughDate) =>
    evaluateCoachOfYear(state, { throughDate }),
  midseason_mvp: null,
  midseason_dpoy: null,
  midseason_roy: null,
  midseason_sixth_man: null,
  midseason_most_improved: null,
};

/**
 * Races update weekly (Monday to Sunday). The cut-off is the last Sunday
 * before `currentDate`, so a week only counts once it is over.
 */
export function awardRaceThroughDate(currentDate: string): string {
  const { year, month, day } = parseCalendarDate(currentDate);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return addCalendarDays(currentDate, weekday === 0 ? -7 : -weekday);
}

/**
 * Top contenders for `awardId` from games through `throughDate`. Monthly
 * races cover the current calendar month unless a period is given. Null
 * when nobody qualifies yet.
 */
export function evaluateAwardRace(
  state: GameState,
  awardId: AwardDefinitionId,
  options: { throughDate: string; period?: string },
): AwardRace | null {
  const evaluate = RACE_EVALUATORS[awardId];
  if (!evaluate) return null;
  const period =
    options.period ?? getCalendarMonthId(state.world.calendar.currentDate);
  const result = evaluate(state, options.throughDate, period);
  if (!result) return null;
  // The evaluator already ran a vote; the race shows the scoring table.
  const contenders = [...result.candidates]
    .sort((a, b) => b.score - a.score || a.subjectId.localeCompare(b.subjectId))
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  return {
    awardId,
    period: result.cadence === "monthly" ? period : null,
    throughDate: options.throughDate,
    contenders,
  };
}

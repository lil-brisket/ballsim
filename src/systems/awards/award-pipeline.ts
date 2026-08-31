import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  ensureAwardResult,
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
import { getPrimaryGamesForMonth } from "@/systems/awards/award-stat-sources";

export type AwardsPipelineResult = SystemResult & {
  awardsGenerated: number;
};

/**
 * Monthly awards for a completed calendar month (YYYY-MM).
 * Only runs during regular season; skips months with no primary games.
 * Idempotent via award result ids.
 */
export function runMonthlyAwards(
  state: GameState,
  completedMonthId: string,
): AwardsPipelineResult {
  if (state.competition.season.phase !== "regular") {
    return { ...systemResult(state), awardsGenerated: 0 };
  }
  const games = getPrimaryGamesForMonth(state, completedMonthId);
  if (games.length === 0) {
    return { ...systemResult(state), awardsGenerated: 0 };
  }

  let current = state;
  let awardsGenerated = 0;
  const before = Object.keys(current.business.awards.results).length;

  current = ensureAwardResult(
    current,
    evaluatePlayerOfMonth(current, completedMonthId),
  );
  current = ensureAwardResult(
    current,
    evaluateRookieOfMonth(current, completedMonthId),
  );
  current = ensureAwardResult(
    current,
    evaluateDefensivePlayerOfMonth(current, completedMonthId),
  );

  awardsGenerated =
    Object.keys(current.business.awards.results).length - before;
  return { ...systemResult(current), awardsGenerated };
}

/**
 * Yearly regular-season awards. Must run after regular season is complete
 * and before playoffs. Uses regular_season stats only — never playoffs or DL.
 * Idempotent via award result ids.
 */
export function runYearlyAwards(state: GameState): AwardsPipelineResult {
  let current = state;
  const before = Object.keys(current.business.awards.results).length;

  current = ensureAwardResult(current, evaluateMvp(current));
  current = ensureAwardResult(current, evaluateDpoy(current));
  current = ensureAwardResult(current, evaluateRoy(current));
  current = ensureAwardResult(current, evaluateSixthMan(current));
  current = ensureAwardResult(current, evaluateMostImproved(current));
  current = ensureAwardResult(current, evaluateCoachOfYear(current));

  const awardsGenerated =
    Object.keys(current.business.awards.results).length - before;
  return { ...systemResult(current), awardsGenerated };
}

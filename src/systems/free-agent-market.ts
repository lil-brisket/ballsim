/**
 * How the free-agent market moves. A free agent opens the window asking his
 * market salary and lowers his ask while he goes unsigned, so a league whose
 * budgets cannot pay every ask still clears its stars. CPU teams sign for a
 * length that fits the player's age and level.
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import type { Player } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  salaryForPlayer,
  serviceYearsForSalary,
  vetMinSalary,
} from "@/systems/salary-scale";

/** Share of his opening ask a free agent still wants when the window closes. */
export const FREE_AGENT_CLOSING_ASK_SHARE = 0.5;

/** CPU contract length by level: stars, starters, rotation players. */
export const CPU_CONTRACT_YEARS_BY_OVERALL = [
  { minOverall: 80, years: 4 },
  { minOverall: 72, years: 3 },
  { minOverall: 66, years: 2 },
] as const;

/** CPU teams do not commit seasons past this age. */
export const CPU_CONTRACT_END_AGE = 33;

/** Open-market salary for a player's level, age and service. */
export function freeAgentMarketSalary(
  state: GameState,
  player: Player,
): number {
  return salaryForPlayer({
    overall: calculatePlayerOverall(player.position, player.attributes),
    age: player.age,
    years: serviceYearsForSalary({
      age: player.age,
      seasonYear: state.competition.season.year,
      draftSeasonYear: player.developmentLeague?.draftSeasonYear ?? null,
      seasonsPlayed:
        state.business.playerHistory[player.id]?.seasons.length ?? 0,
    }),
    cap: getLeagueSalaryCap(state),
    kind: "fa",
  });
}

/**
 * Share of his market salary a free agent asks today: 1 when free agency
 * opens, falling evenly to {@link FREE_AGENT_CLOSING_ASK_SHARE} on the last
 * day, and the closing share through the season that follows (he went
 * unsigned). Before free agency opens he asks his full market salary.
 */
export function freeAgentAskShare(state: GameState): number {
  const phase = state.competition.phase;
  if (
    phase?.activePhaseId === "preseason.preparation" ||
    phase?.activePhaseId === "regular"
  ) {
    return FREE_AGENT_CLOSING_ASK_SHARE;
  }
  if (phase?.activePhaseId !== "offseason.free_agency") {
    return 1;
  }
  const duration = state.settings.offseason.freeAgency.durationDays;
  if (duration <= 0) {
    return FREE_AGENT_CLOSING_ASK_SHARE;
  }
  const days = calendarDaysBetween(
    phase.enteredDate,
    state.world.calendar.currentDate,
  );
  const progress = Math.min(1, Math.max(0, days / duration));
  return 1 - (1 - FREE_AGENT_CLOSING_ASK_SHARE) * progress;
}

/**
 * What a free agent asks at `share` of his market salary (default: today's
 * share), never below the veteran minimum.
 */
export function freeAgentAsk(
  state: GameState,
  player: Player,
  share: number = freeAgentAskShare(state),
): number {
  const market = freeAgentMarketSalary(state, player);
  const floor = vetMinSalary(getLeagueSalaryCap(state));
  return Math.max(floor, Math.round((market * share) / 1_000) * 1_000);
}

/**
 * Seasons a CPU team signs a player for: longer for better players, never
 * past {@link CPU_CONTRACT_END_AGE}, and one season for replacement-level
 * players.
 */
export function cpuContractYears(age: number, overall: number): number {
  const tier = CPU_CONTRACT_YEARS_BY_OVERALL.find(
    (entry) => overall >= entry.minOverall,
  );
  const years = tier?.years ?? 1;
  return Math.max(1, Math.min(years, CPU_CONTRACT_END_AGE - age));
}

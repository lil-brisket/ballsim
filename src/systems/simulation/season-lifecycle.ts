import type { DomainEvent } from "@/domain/events";
import { createSeededRng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { runYearlyAwards } from "@/systems/awards/award-pipeline";
import { startPlayoffs } from "@/systems/playoff-simulation";
import { generateSchedule } from "@/systems/schedule-generation";
import { generateDevelopmentLeagueSchedule } from "@/systems/development-league/schedule-generation";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import {
  getActivePhaseId,
  setActivePhase,
} from "@/systems/phase-engine";
import { canBeginRegularSeason, canBeginPlayoffs } from "@/systems/league-rules";
import { snapshotTradeDeadline } from "@/systems/league-rules/snapshot-trade-deadline";

/**
 * True when the regular season has a non-empty schedule and every listed game is final.
 * An empty schedule is never "complete."
 */
export function isRegularSeasonComplete(state: GameState): boolean {
  const { schedule, games } = state.competition;
  if (schedule.gameIds.length === 0) {
    return false;
  }
  for (const gameId of schedule.gameIds) {
    const game = games[gameId];
    if (!game || game.status !== "final") {
      return false;
    }
  }
  return true;
}

function withRegularSeasonStartDate(
  state: GameState,
  regularSeasonStartDate: string,
): GameState {
  if (state.competition.season.regularSeasonStartDate === regularSeasonStartDate) {
    return state;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        regularSeasonStartDate,
      },
    },
  };
}

/**
 * Begin the regular season from preseason.preparation (user-controlled advance).
 */
export function beginRegularSeasonFromPreseason(state: GameState): SystemResult {
  if (getActivePhaseId(state) !== "preseason.preparation") {
    throw new Error(
      `beginRegularSeasonFromPreseason requires preseason.preparation; got "${getActivePhaseId(state)}".`,
    );
  }
  const gate = canBeginRegularSeason(state);
  if (!gate.allowed) {
    throw new Error(
      gate.blockReason ?? "Season cannot begin — roster validation is incomplete.",
    );
  }
  const events: DomainEvent[] = [];
  let current = state;

  const phaseResult = transitionPhase(current, "regular");
  current = phaseResult.state;
  events.push(...phaseResult.events);

  current = setActivePhase(current, "regular");
  current = withRegularSeasonStartDate(
    current,
    current.world.calendar.currentDate,
  );

  if (current.competition.schedule.gameIds.length === 0) {
    const scheduleResult = generateSchedule(current);
    current = scheduleResult.state;
    events.push(...scheduleResult.events);
  }

  const dlSchedule = generateDevelopmentLeagueSchedule(current);
  current = dlSchedule.state;
  events.push(...dlSchedule.events);

  current = snapshotTradeDeadline(current);

  return systemResult(current, events);
}

/**
 * Evaluates season-phase transitions appropriate for the current competition state.
 * Does not advance the calendar. transitionPhase is the sole SeasonPhase writer.
 *
 * Preseason is user-paced via beginRegularSeasonFromPreseason / advanceLeaguePhase.
 * Postseason is a player-paced Season Review checkpoint.
 */
export function processSeasonLifecycle(state: GameState): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const phase = current.competition.season.phase;

  // preseason: hold until user advances (preseason.preparation → regular).
  if (phase === "preseason") {
    return systemResult(current, events);
  }

  if (phase === "regular" && isRegularSeasonComplete(current)) {
    // Regular-season awards must finalize before playoffs begin.
    // Playoff stats must never alter these awards (idempotent if re-run).
    const yearly = runYearlyAwards(current);
    current = yearly.state;
    events.push(...yearly.events);

    const playoffGate = canBeginPlayoffs(current);
    if (!playoffGate.allowed && current.settings.playoffs.playoffTeams > 0) {
      // Standings/seeds may still be building — fall through only when complete check fails for empty
    }
    const playoffTeams = current.settings.playoffs.playoffTeams;
    const liveTeamCount = Object.keys(current.world.teams).length;

    if (playoffTeams > 0 && playoffTeams <= liveTeamCount) {
      const rng = createSeededRng(current.meta.rngState);
      const started = startPlayoffs(current, rng);
      current = {
        ...started.state,
        meta: {
          ...started.state.meta,
          rngState: rng.getState(),
        },
      };
      events.push(...started.events);
      const phaseResult = transitionPhase(current, "playoffs");
      current = setActivePhase(phaseResult.state, "playoffs");
      events.push(...phaseResult.events);
      return systemResult(current, events);
    }

    const phaseResult = transitionPhase(current, "postseason");
    current = setActivePhase(phaseResult.state, "postseason.season_review");
    events.push(...phaseResult.events);
    return systemResult(current, events);
  }

  if (
    phase === "playoffs" &&
    current.competition.playoffs.status === "complete"
  ) {
    const phaseResult = transitionPhase(current, "postseason");
    current = setActivePhase(phaseResult.state, "postseason.season_review");
    events.push(...phaseResult.events);
    return systemResult(current, events);
  }

  // Sync competition.phase when in regular/playoffs without pointer
  if (phase === "regular" && getActivePhaseId(current) !== "regular") {
    current = setActivePhase(current, "regular");
  }
  if (phase === "playoffs" && getActivePhaseId(current) !== "playoffs") {
    current = setActivePhase(current, "playoffs");
  }
  if (
    phase === "postseason" &&
    getActivePhaseId(current) !== "postseason.season_review"
  ) {
    current = setActivePhase(current, "postseason.season_review");
  }

  return systemResult(current, events);
}

/**
 * Player-paced exit from Season Review into offseason season transition.
 * Does not run transition processors — the next advanceSimulation day does.
 */
export function enterOffseasonFromPostseason(state: GameState): SystemResult {
  if (state.competition.season.phase !== "postseason") {
    throw new Error(
      `enterOffseasonFromPostseason requires phase "postseason"; got "${state.competition.season.phase}".`,
    );
  }
  const phaseResult = transitionPhase(state, "offseason");
  let current = phaseResult.state;
  current = setActivePhase(current, "offseason.season_transition");
  return systemResult(current, phaseResult.events);
}

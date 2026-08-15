import { getCalendarMonthId, getIsoWeekId } from "@/domain/calendar-date";
import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { advanceCalendar } from "@/systems/calendar";
import { generateRosters } from "@/systems/roster-generation";
import { runDailyPipeline } from "@/systems/simulation/daily-pipeline";
import {
  completedMonthIdForSimulatedDate,
  runMonthlyPipeline,
} from "@/systems/simulation/monthly-pipeline";
import { processOffseasonLifecycle } from "@/systems/simulation/offseason-lifecycle";
import { runOwnerGameplay } from "@/systems/simulation/owner-gameplay";
import { processScheduledEvents } from "@/systems/simulation/scheduled-events";
import { processSeasonLifecycle } from "@/systems/simulation/season-lifecycle";
import type {
  AdvanceSimulationOptions,
  AdvanceSimulationResult,
} from "@/systems/simulation/types";
import {
  completedWeekIdForSimulatedDate,
  runWeeklyPipeline,
} from "@/systems/simulation/weekly-pipeline";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { processDailyFanSentimentAfterGames } from "@/systems/fan-sentiment";
import { applyMediaFromDomainEvents } from "@/systems/media";
import { processHomeGameTicketRevenue } from "@/systems/ticket-revenue";

/**
 * Canonical Owner Mode simulation advance.
 *
 * Per-day order:
 * 1. Validate
 * 2. Season + offseason lifecycle (may change phase / generate schedule)
 * 3. Scheduled events due on currentDate
 * 4. Daily pipeline (uses post-lifecycle phase)
 * 5. Owner gameplay: AI → finances → objectives → notifications
 * 6. Record lastSimulatedDate
 * 7. advanceCalendar +1 (orchestrator only)
 * 8. Weekly pipeline when crossing into a new ISO week
 *
 * When `stopOnPhaseChange` is true, stops immediately after the first day
 * that changes `{ phase, offseasonStage, year }`. Never bypasses lifecycle.
 *
 * Callers must persist rng.getState() into meta.rngState after this runs.
 */
export function advanceSimulation(
  state: GameState,
  rng: Rng,
  options: AdvanceSimulationOptions = {},
): AdvanceSimulationResult {
  const days = options.days ?? 1;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(
      `advanceSimulation days must be an integer >= 1; got ${days}.`,
    );
  }

  const phaseBefore = state.competition.season.phase;
  const previousDate = state.world.calendar.currentDate;
  const identityBefore = lifecycleIdentity(state);
  const allEvents: DomainEvent[] = [];
  let current = state;
  let scheduledEventsProcessed = 0;
  let gamesSimulated = 0;
  let weeklyPipelineRan = false;
  let monthlyPipelineRan = false;
  let daysAdvanced = 0;

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const dayResult = advanceOneDay(current, rng);
    current = dayResult.state;
    allEvents.push(...dayResult.events);
    scheduledEventsProcessed += dayResult.scheduledEventsProcessed;
    gamesSimulated += dayResult.gamesSimulated;
    weeklyPipelineRan = weeklyPipelineRan || dayResult.weeklyPipelineRan;
    monthlyPipelineRan = monthlyPipelineRan || dayResult.monthlyPipelineRan;
    daysAdvanced += 1;

    if (
      options.stopOnPhaseChange &&
      lifecycleIdentity(current) !== identityBefore
    ) {
      break;
    }
  }

  const phaseAfter = current.competition.season.phase;

  return {
    state: current,
    events: allEvents,
    previousDate,
    currentDate: current.world.calendar.currentDate,
    daysAdvanced,
    phaseBefore,
    phaseAfter,
    phaseChanged: phaseBefore !== phaseAfter,
    scheduledEventsProcessed,
    gamesSimulated,
    weeklyPipelineRan,
    monthlyPipelineRan,
  };
}

function lifecycleIdentity(state: GameState): string {
  const season = state.competition.season;
  return `${season.phase}|${season.offseasonStage}|${season.year}`;
}

type OneDayResult = {
  state: GameState;
  events: DomainEvent[];
  scheduledEventsProcessed: number;
  gamesSimulated: number;
  weeklyPipelineRan: boolean;
  monthlyPipelineRan: boolean;
};

function advanceOneDay(state: GameState, rng: Rng): OneDayResult {
  const events: DomainEvent[] = [];
  let current = bootstrapRostersAndPicks(state, rng);

  const simulatedDate = current.world.calendar.currentDate;
  if (current.world.calendar.lastSimulatedDate === simulatedDate) {
    throw new Error(
      `Daily simulation already completed for "${simulatedDate}".`,
    );
  }

  const seasonLife = processSeasonLifecycle(current);
  current = seasonLife.state;
  events.push(...seasonLife.events);

  const offseasonLife = processOffseasonLifecycle(current, rng);
  current = offseasonLife.state;
  events.push(...offseasonLife.events);

  const scheduled = processScheduledEvents(current, rng);
  current = scheduled.state;
  events.push(...scheduled.events);

  const daily = runDailyPipeline(current, rng);
  current = daily.state;
  events.push(...daily.events);

  const tickets = processHomeGameTicketRevenue(current);
  current = tickets.state;
  events.push(...tickets.events);

  const sentiment = processDailyFanSentimentAfterGames(current);
  current = sentiment.state;
  events.push(...sentiment.events);

  const gameplay = runOwnerGameplay(current, rng);
  current = gameplay.state;
  events.push(...gameplay.events);

  const media = applyMediaFromDomainEvents(current, events);
  current = media.state;
  events.push(...media.events);

  current = {
    ...current,
    world: {
      ...current.world,
      calendar: {
        ...current.world.calendar,
        lastSimulatedDate: simulatedDate,
      },
    },
  };

  const calendarResult = advanceCalendar(current);
  current = calendarResult.state;
  events.push(...calendarResult.events);

  const newDate = current.world.calendar.currentDate;
  let weeklyRan = false;
  let monthlyRan = false;
  if (getIsoWeekId(newDate) !== getIsoWeekId(simulatedDate)) {
    const completedWeekId = completedWeekIdForSimulatedDate(simulatedDate);
    const weekly = runWeeklyPipeline(current, completedWeekId);
    current = weekly.state;
    events.push(...weekly.events);
    weeklyRan = weekly.weeklyPipelineRan;
  }

  if (getCalendarMonthId(newDate) !== getCalendarMonthId(simulatedDate)) {
    const completedMonthId = completedMonthIdForSimulatedDate(simulatedDate);
    const monthly = runMonthlyPipeline(current, completedMonthId);
    current = monthly.state;
    events.push(...monthly.events);
    monthlyRan = monthly.monthlyPipelineRan;
  }

  return {
    state: current,
    events,
    scheduledEventsProcessed: scheduled.scheduledEventsProcessed,
    gamesSimulated: daily.gamesSimulated,
    weeklyPipelineRan: weeklyRan,
    monthlyPipelineRan: monthlyRan,
  };
}

function bootstrapRostersAndPicks(state: GameState, rng: Rng): GameState {
  const afterRosters = generateRosters(state, rng);
  return ensureDraftPicksLocal(afterRosters.state);
}

function ensureDraftPicksLocal(state: GameState): GameState {
  const teams = Object.values(state.world.teams);
  const draftPicks = mergeDraftPicksForSeason(
    state.world.draftPicks,
    teams,
    state.competition.season.year,
  );
  if (draftPicks === state.world.draftPicks) {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      draftPicks,
    },
  };
}

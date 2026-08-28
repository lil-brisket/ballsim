import { getCalendarMonthId, getIsoWeekId } from "@/domain/calendar-date";
import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
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
import { lifecycleIdentity } from "@/systems/simulation/calendar-context";
import type {
  AdvanceSimulationOptions,
  AdvanceSimulationResult,
  SimulationProgress,
} from "@/systems/simulation/types";
import {
  completedWeekIdForSimulatedDate,
  runWeeklyPipeline,
} from "@/systems/simulation/weekly-pipeline";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { processDailyFanSentimentAfterGames } from "@/systems/fan-sentiment";
import { applyMediaFromDomainEvents } from "@/systems/media";
import { processLeaguePlayoffBonuses } from "@/systems/playoff-financial-bonuses";
import { processHomeGameTicketRevenue } from "@/systems/ticket-revenue";
import { processNarrativeLayer } from "@/systems/narrative";
import { assertContinuityBoundary } from "@/systems/simulation/continuity-validation";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";

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
 * that changes `{ phase, offseasonStage, year, seasonSegment }`. Never bypasses lifecycle.
 *
 * After each completed day, stops if an active owner decision is pending
 * (e.g. incoming trade offer). Never interrupts mid-pipeline.
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
  let stopReason: AdvanceSimulationResult["stopReason"];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const dayResult = advanceOneDay(current, rng, options.profiler);
    current = dayResult.state;
    allEvents.push(...dayResult.events);
    scheduledEventsProcessed += dayResult.scheduledEventsProcessed;
    gamesSimulated += dayResult.gamesSimulated;
    weeklyPipelineRan = weeklyPipelineRan || dayResult.weeklyPipelineRan;
    monthlyPipelineRan = monthlyPipelineRan || dayResult.monthlyPipelineRan;
    daysAdvanced += 1;

    if (options.onProgress) {
      const progress: SimulationProgress = {
        daysRequested: days,
        daysAdvanced,
        currentDate: current.world.calendar.currentDate,
        phase: current.competition.season.phase,
        offseasonStage: current.competition.season.offseasonStage,
        seasonYear: current.competition.season.year,
        gamesSimulated,
        percentComplete: Math.min(100, (daysAdvanced / days) * 100),
      };
      options.onProgress(progress);
    }

    // Owner decisions pause only after a fully completed day.
    if (hasBlockingOwnerDecision(current.user)) {
      stopReason = "pending_owner_decision";
      break;
    }

    if (
      options.stopOnPhaseChange &&
      lifecycleIdentity(current) !== identityBefore
    ) {
      stopReason = "phase_change";
      break;
    }
  }

  const phaseAfter = current.competition.season.phase;
  const status: AdvanceSimulationResult["status"] = stopReason
    ? "paused"
    : "completed";

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
    status,
    ...(stopReason ? { stopReason } : {}),
  };
}

type OneDayResult = {
  state: GameState;
  events: DomainEvent[];
  scheduledEventsProcessed: number;
  gamesSimulated: number;
  weeklyPipelineRan: boolean;
  monthlyPipelineRan: boolean;
};

function advanceOneDay(
  state: GameState,
  rng: Rng,
  profiler?: SimulationProfiler,
): OneDayResult {
  const events: DomainEvent[] = [];
  let current = bootstrapRostersAndPicks(state, rng);
  const dayStart = performance.now();

  const simulatedDate = current.world.calendar.currentDate;
  if (current.world.calendar.lastSimulatedDate === simulatedDate) {
    throw new Error(
      `Daily simulation already completed for "${simulatedDate}".`,
    );
  }

  const identityBeforeLifecycle = lifecycleIdentity(current);

  const lifecycleStart = performance.now();
  const seasonLife = processSeasonLifecycle(current);
  current = seasonLife.state;
  events.push(...seasonLife.events);

  const offseasonLife = processOffseasonLifecycle(current, rng);
  current = offseasonLife.state;
  events.push(...offseasonLife.events);
  if (profiler) {
    profiler.addSeason("lifecycleMs", performance.now() - lifecycleStart);
  }

  const scheduled = processScheduledEvents(current, rng);
  current = scheduled.state;
  events.push(...scheduled.events);

  const daily = runDailyPipeline(current, rng, profiler);
  current = daily.state;
  events.push(...daily.events);

  const ticketsStart = performance.now();
  const tickets = processHomeGameTicketRevenue(current);
  current = tickets.state;
  events.push(...tickets.events);

  const playoffBonuses = processLeaguePlayoffBonuses(current);
  current = playoffBonuses.state;
  events.push(...playoffBonuses.events);

  const sentiment = processDailyFanSentimentAfterGames(current);
  current = sentiment.state;
  events.push(...sentiment.events);
  if (profiler) {
    profiler.addSeason("ticketsMs", performance.now() - ticketsStart);
  }

  const gameplayStart = performance.now();
  const gameplay = runOwnerGameplay(current, rng, {
    dayEvents: tickets.events,
  });
  current = gameplay.state;
  events.push(...gameplay.events);
  if (profiler) {
    profiler.addSeason("ownerGameplayMs", performance.now() - gameplayStart);
  }

  const lifecycleChanged =
    lifecycleIdentity(current) !== identityBeforeLifecycle;

  if (lifecycleChanged) {
    assertContinuityBoundary(current);
  }

  const mediaStart = performance.now();
  const media = applyMediaFromDomainEvents(current, events);
  current = media.state;
  events.push(...media.events);
  if (profiler) {
    profiler.addSeason("mediaMs", performance.now() - mediaStart);
  }

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
  const narrativeCadences: Array<
    "game" | "daily" | "weekly" | "monthly" | "offseason"
  > = [daily.gamesSimulated > 0 ? "game" : "daily"];
  if (lifecycleChanged) {
    narrativeCadences.push("offseason");
  }

  if (getIsoWeekId(newDate) !== getIsoWeekId(simulatedDate)) {
    const completedWeekId = completedWeekIdForSimulatedDate(simulatedDate);
    const weeklyStart = performance.now();
    const weekly = runWeeklyPipeline(current, completedWeekId);
    if (profiler) {
      profiler.addSeason("weeklyMs", performance.now() - weeklyStart);
    }
    current = weekly.state;
    events.push(...weekly.events);
    weeklyRan = weekly.weeklyPipelineRan;
    if (weeklyRan) {
      narrativeCadences.push("weekly");
    }
  }

  let completedMonthId: string | undefined;
  if (getCalendarMonthId(newDate) !== getCalendarMonthId(simulatedDate)) {
    completedMonthId = completedMonthIdForSimulatedDate(simulatedDate);
    const monthlyStart = performance.now();
    const monthly = runMonthlyPipeline(current, completedMonthId);
    if (profiler) {
      profiler.addSeason("monthlyMs", performance.now() - monthlyStart);
    }
    current = monthly.state;
    events.push(...monthly.events);
    monthlyRan = monthly.monthlyPipelineRan;
    if (monthlyRan) {
      narrativeCadences.push("monthly");
    }
  }

  const narrativeStart = performance.now();
  const narrative = processNarrativeLayer(current, rng, {
    cadences: narrativeCadences,
    dayEvents: events,
    completedMonthId: monthlyRan ? completedMonthId : undefined,
  });
  current = narrative.state;
  events.push(...narrative.events);
  if (profiler) {
    profiler.addSeason("narrativeMs", performance.now() - narrativeStart);
    const accounted =
      performance.now() - dayStart;
    // residual bucket for unclassified day work
    void accounted;
    profiler.bumpDay();
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

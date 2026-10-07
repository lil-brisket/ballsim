import { getCalendarMonthId, getIsoWeekId } from "@/domain/calendar-date";
import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import type { TeamId } from "@/domain/ids";
import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
import { expireDatedTradeOffers } from "@/systems/owner-decisions/enqueue-trade-offer";
import type { GameState } from "@/state/game-state";
import { advanceCalendar } from "@/systems/calendar";
import {
  getTeamGameForDate,
  projectTeamGameView,
} from "@/systems/calendar/schedule-projection";
import { generateRosters } from "@/systems/roster-generation";
import { canBeginRegularSeason } from "@/systems/league-rules";
import { canAdvancePhase } from "@/systems/phase-engine";
import { enforceMaxRosterViaDevelopmentLeague } from "@/systems/development-league/enforce-roster-cap";
import { runDailyPipeline } from "@/systems/simulation/daily-pipeline";
import {
  completedMonthIdForSimulatedDate,
  runMonthlyPipeline,
} from "@/systems/simulation/monthly-pipeline";
import { processOffseasonLifecycle } from "@/systems/simulation/offseason-lifecycle";
import { runOwnerGameplay } from "@/systems/simulation/owner-gameplay";
import {
  formatCannotBeginRegularSeasonError,
  syncPhaseForward,
} from "@/systems/simulation/phase-lifecycle";
import { processScheduledEvents } from "@/systems/simulation/scheduled-events";
import { processSeasonEvents } from "@/systems/season-events";
import {
  derivePlannedRegularSeasonStartDate,
  needsRegularSeasonInitialization,
  processSeasonLifecycle,
} from "@/systems/simulation/season-lifecycle";
import { lifecycleIdentity } from "@/systems/simulation/calendar-context";
import { assertSimulationState } from "@/systems/simulation/validate-simulation-state";
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
import { applyPromotionDownstreamEffects } from "@/systems/game-day-promotions/apply-promotion-downstream-effects";
import { processNarrativeLayer } from "@/systems/narrative";
import { assertContinuityBoundary } from "@/systems/simulation/continuity-validation";
import type { SimulationProfiler } from "@/systems/simulation/simulation-profiler";
import { processWindowExpirations } from "@/systems/expire-transactions";

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
 * Phase-boundary exception (preseason → regular):
 * When allowOwnerManagedPhaseTransitions initializes the regular season,
 * competition simulation and calendar +1 are skipped so the opener remains
 * unplayed. currentDate lands on regularSeasonStartDate. The next advance
 * plays that day's games.
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
  const session = createAdvanceSession(state, rng, options);
  while (session.step()) {
    /* sync */
  }
  return session.result();
}

/**
 * Same as {@link advanceSimulation}, yielding to the event loop after each day
 * so streamed progress can flush to the client.
 */
export async function advanceSimulationAsync(
  state: GameState,
  rng: Rng,
  options: AdvanceSimulationOptions = {},
): Promise<AdvanceSimulationResult> {
  const session = createAdvanceSession(state, rng, options);
  while (session.step()) {
    await yieldToEventLoop();
  }
  return session.result();
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

type AdvanceSession = {
  step: () => boolean;
  result: () => AdvanceSimulationResult;
};

function createAdvanceSession(
  state: GameState,
  rng: Rng,
  options: AdvanceSimulationOptions,
): AdvanceSession {
  const days = options.days ?? 1;
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(
      `advanceSimulation days must be an integer >= 1; got ${days}.`,
    );
  }

  const allowOwnerManaged = options.allowOwnerManagedPhaseTransitions !== false;

  const allEvents: DomainEvent[] = [];
  let current = state;

  if (allowOwnerManaged && needsRegularSeasonInitialization(current)) {
    const plannedOpener = derivePlannedRegularSeasonStartDate(current);
    if (
      plannedOpener != null &&
      current.world.calendar.currentDate >= plannedOpener
    ) {
      const capped = enforceMaxRosterViaDevelopmentLeague(current);
      current = capped.state;
      allEvents.push(...capped.events);
      if (
        !canAdvancePhase(current) ||
        !canBeginRegularSeason(current).allowed
      ) {
        throw new Error(formatCannotBeginRegularSeasonError(current));
      }
    }
  }

  const phaseBefore = current.competition.season.phase;
  const previousDate = current.world.calendar.currentDate;
  const identityBefore = lifecycleIdentity(current);
  const ownerTeamId = current.user.activeOwnerTeamId;
  let scheduledEventsProcessed = 0;
  let gamesSimulated = 0;
  let weeklyPipelineRan = false;
  let monthlyPipelineRan = false;
  let daysAdvanced = 0;
  let stopReason: AdvanceSimulationResult["stopReason"];
  let dayIndex = 0;
  let finished = false;

  function finish(): AdvanceSimulationResult {
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

  return {
    step(): boolean {
      if (finished || dayIndex >= days) {
        finished = true;
        return false;
      }

      const dateAboutToSimulate = current.world.calendar.currentDate;
      if (
        options.stopBeforeUserTeamGame === true &&
        dayIndex > 0 &&
        !needsRegularSeasonInitialization(current) &&
        ownerHasScheduledGameOnDate(current, ownerTeamId, dateAboutToSimulate)
      ) {
        stopReason = "user_team_game";
        finished = true;
        return false;
      }

      const dayResult = advanceOneDay(current, rng, {
        profiler: options.profiler,
        allowOwnerManagedPhaseTransitions: allowOwnerManaged,
        gameFidelity: options.gameFidelity,
        ownerTeamId,
        skipOwnerGameplay: options.skipOwnerGameplay === true,
      });
      current = dayResult.state;
      allEvents.push(...dayResult.events);
      scheduledEventsProcessed += dayResult.scheduledEventsProcessed;
      gamesSimulated += dayResult.gamesSimulated;
      weeklyPipelineRan = weeklyPipelineRan || dayResult.weeklyPipelineRan;
      monthlyPipelineRan = monthlyPipelineRan || dayResult.monthlyPipelineRan;
      daysAdvanced += 1;
      dayIndex += 1;

      if (options.onProgress) {
        const progress: SimulationProgress = {
          daysRequested: days,
          daysAdvanced,
          currentDate: current.world.calendar.currentDate,
          completedDate: dateAboutToSimulate,
          phase: current.competition.season.phase,
          offseasonStage: current.competition.season.offseasonStage,
          seasonYear: current.competition.season.year,
          gamesSimulated,
          percentComplete: Math.min(100, (daysAdvanced / days) * 100),
          teamGame: ownerTeamGameProgress(
            current,
            ownerTeamId,
            dateAboutToSimulate,
          ),
        };
        options.onProgress(progress);
      }

      if (hasBlockingOwnerDecision(current.user)) {
        stopReason = "pending_owner_decision";
        finished = true;
        return false;
      }

      if (
        options.stopOnPhaseChange &&
        lifecycleIdentity(current) !== identityBefore
      ) {
        stopReason = "phase_change";
        finished = true;
        return false;
      }

      if (dayResult.regularSeasonInitialized && options.stopOnPhaseChange) {
        stopReason = "phase_change";
        finished = true;
        return false;
      }

      if (dayIndex >= days) {
        finished = true;
        return false;
      }
      return true;
    },
    result: finish,
  };
}

type OneDayResult = {
  state: GameState;
  events: DomainEvent[];
  scheduledEventsProcessed: number;
  gamesSimulated: number;
  weeklyPipelineRan: boolean;
  monthlyPipelineRan: boolean;
  regularSeasonInitialized: boolean;
};

type OneDayOptions = {
  profiler?: SimulationProfiler;
  allowOwnerManagedPhaseTransitions?: boolean;
  gameFidelity?: "possession" | "box_score";
  ownerTeamId?: TeamId;
  skipOwnerGameplay?: boolean;
};

function advanceOneDay(
  state: GameState,
  rng: Rng,
  dayOptions: OneDayOptions = {},
): OneDayResult {
  const events: DomainEvent[] = [];
  let current = bootstrapRostersAndPicks(state, rng);
  const dayStart = performance.now();
  const profiler = dayOptions.profiler;
  const allowOwnerManaged =
    dayOptions.allowOwnerManagedPhaseTransitions !== false;

  const simulatedDate = current.world.calendar.currentDate;
  if (current.world.calendar.lastSimulatedDate === simulatedDate) {
    throw new Error(
      `Daily simulation already completed for "${simulatedDate}".`,
    );
  }

  const identityBeforeLifecycle = lifecycleIdentity(current);

  const lifecycleStart = performance.now();

  // Date-driven phase sync: at most one phase transition, full exit/enter hooks.
  const phaseSync = syncPhaseForward(current, rng, {
    allowAiAssist: true,
    allowOwnerManagedPhaseTransitions: allowOwnerManaged,
  });
  current = phaseSync.state;
  events.push(...phaseSync.events);

  if (
    phaseSync.stopReason === "required_tasks" &&
    phaseSync.stopMessage &&
    needsRegularSeasonInitialization(state) &&
    allowOwnerManaged
  ) {
    throw new Error(phaseSync.stopMessage);
  }

  const regularSeasonInitialized = phaseSync.regularSeasonInitialized === true;

  // Phase-boundary day: schedule generated, land on opener, do not play games.
  if (regularSeasonInitialized) {
    const opener =
      current.competition.season.regularSeasonStartDate ??
      current.world.calendar.currentDate;
    if (current.world.calendar.currentDate !== opener) {
      current = {
        ...current,
        world: {
          ...current.world,
          calendar: {
            ...current.world.calendar,
            currentDate: opener,
          },
        },
      };
    }

    assertContinuityBoundary(current);
    assertSimulationState(current, "day");

    if (profiler) {
      profiler.addSeason("lifecycleMs", performance.now() - lifecycleStart);
      profiler.bumpDay();
    }

    return {
      state: current,
      events,
      scheduledEventsProcessed: 0,
      gamesSimulated: 0,
      weeklyPipelineRan: false,
      monthlyPipelineRan: false,
      regularSeasonInitialized: true,
    };
  }

  const seasonLife = processSeasonLifecycle(current, rng);
  current = seasonLife.state;
  events.push(...seasonLife.events);

  const offseasonLife = processOffseasonLifecycle(current, rng);
  current = offseasonLife.state;
  events.push(...offseasonLife.events);

  const windowExpiry = processWindowExpirations(current);
  current = windowExpiry.state;
  events.push(...windowExpiry.events);

  const datedOffers = expireDatedTradeOffers(current);
  current = datedOffers.state;

  if (profiler) {
    profiler.addSeason("lifecycleMs", performance.now() - lifecycleStart);
  }

  const scheduled = processScheduledEvents(current, rng);
  current = scheduled.state;
  events.push(...scheduled.events);

  const daily = runDailyPipeline(current, rng, profiler, {
    fidelity: dayOptions.gameFidelity,
    ownerTeamId: dayOptions.ownerTeamId,
  });
  current = daily.state;
  events.push(...daily.events);

  // Season events after games so cutoff-day RS stats are included.
  const seasonEvents = processSeasonEvents(current, rng);
  current = seasonEvents.state;
  events.push(...seasonEvents.events);

  const ticketsStart = performance.now();
  const tickets = processHomeGameTicketRevenue(current, rng);
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

  if (dayOptions.skipOwnerGameplay !== true) {
    const gameplayStart = performance.now();
    const gameplay = runOwnerGameplay(current, rng, {
      dayEvents: tickets.events,
    });
    current = gameplay.state;
    events.push(...gameplay.events);
    if (profiler) {
      profiler.addSeason("ownerGameplayMs", performance.now() - gameplayStart);
    }
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
  // Fan/PR/awareness from GameDayPromotionSettled (media handled above).
  const promoDownstream = applyPromotionDownstreamEffects(current, events);
  current = promoDownstream.state;
  events.push(...promoDownstream.events);
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

  // Lightweight per-day invariant check.
  assertSimulationState(current, "day");

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
    const weekly = runWeeklyPipeline(current, completedWeekId, rng);
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
    const accounted = performance.now() - dayStart;
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
    regularSeasonInitialized: false,
  };
}

function bootstrapRostersAndPicks(state: GameState, rng: Rng): GameState {
  const afterRosters = generateRosters(state, rng);
  return ensureDraftPicksLocal(afterRosters.state);
}

function ownerHasScheduledGameOnDate(
  state: GameState,
  teamId: TeamId,
  date: string,
): boolean {
  const scheduled = getTeamGameForDate(state, teamId, date);
  if (scheduled != null && scheduled.status === "scheduled") {
    return true;
  }
  const playoffs = state.competition.playoffs;
  if (playoffs.status !== "in_progress") {
    return false;
  }
  const active = [...playoffs.series]
    .filter((series) => series.status === "active")
    .sort((left, right) => {
      if (left.round !== right.round) {
        return left.round - right.round;
      }
      return left.slot - right.slot;
    });
  const next = active[0];
  if (next == null) {
    return false;
  }
  return (
    next.higherSeedTeamId === teamId || next.lowerSeedTeamId === teamId
  );
}

function ownerTeamGameProgress(
  state: GameState,
  teamId: TeamId,
  date: string,
): SimulationProgress["teamGame"] {
  const game = getTeamGameForDate(state, teamId, date);
  if (game == null || game.status !== "final") {
    return null;
  }
  const view = projectTeamGameView(state, teamId, game);
  return {
    opponentAbbreviation: view.opponentAbbreviation,
    resultLabel: view.resultLabel,
    home: view.home,
  };
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

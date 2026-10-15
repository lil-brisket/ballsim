import "server-only";
import {
  advanceBlockedReason,
  getActiveParticipant,
  getParticipantForTeam,
  withReadyReset,
} from "@/systems/participation";
import type {
  SimulationProgress,
  AdvanceSimulationResult,
} from "@/systems/simulation/types";
import type { SaveGameStore } from "@/persistence/save-game-store";
import type { DomainEvent } from "@/domain/events";
import { buildSimulationHighlights } from "@/systems/simulation/simulation-highlights";
import { hasActiveOwnerDecision } from "@/systems/owner-decisions";
import { isUserOnDraftClock } from "@/systems/draft";
import { shouldStopForDraftClock } from "@/systems/simulation/draft-clock-stop";
import { createSeededRng } from "@/domain/rng";
import { runAiContinuity } from "@/systems/simulation/ai-continuity";
import {
  mapTimeAdvancePersistenceError,
  withTimeAdvanceDedupe,
} from "@/application/time-advance-mutation";
import {
  derivePlannedRegularSeasonStartDate,
  needsRegularSeasonInitialization,
} from "@/systems/simulation/planned-season-dates";
import {
  addCalendarDays,
  parseCalendarDate,
  formatCalendarDate,
  calendarDaysBetween,
} from "@/domain/calendar-date";
import { advanceSimulationAsync } from "@/systems/simulation/advance-simulation";
import { processDerivedProjections } from "@/systems/media-hub";
import type { GameState } from "@/state/game-state";
import { resolveSeasonAnchors } from "@/systems/league-rules/league-calendar";
import { findNextSimulationTarget } from "@/systems/calendar";
import type {
  OwnerCommandResult,
  AdvanceDayResult,
} from "@/application/game-service/types";
import {
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";

export type SimulationStopCondition =
  "blocking_decision" | "user_team_game" | "important_event" | "phase_change";

export type AdvanceOwnerTimeOptions = {
  days?: number;
  stopOnPhaseChange?: boolean;
  /** Simulate forward until this calendar date is current (inclusive landing). */
  targetDate?: string;
  /** Explicit shortcut modes — resolve target date from calendar projection. */
  targetMode?:
    | "next_game"
    | "next_important"
    | "next_decision"
    | "next_deadline"
    | "next_month"
    | "end_of_season";
  /** Optional early-stop conditions for multi-day advances. */
  stopConditions?: SimulationStopCondition[];
  /** Stream per-day progress (calendar playback). */
  onProgress?: (progress: SimulationProgress) => void;
  /** Caller already holds {@link runWithSimulationDedupe} for this save. */
  skipInProcessDedupe?: boolean;
};

export async function advanceOwnerTime(
  saveId: string,
  options: AdvanceOwnerTimeOptions = {},
  store?: SaveGameStore,
): Promise<
  OwnerCommandResult<{
    events: DomainEvent[];
    simulation: Omit<AdvanceSimulationResult, "state" | "events">;
    highlights: ReturnType<typeof buildSimulationHighlights>;
    summary?: import("@/systems/calendar/simulation-summary").SimulationSummary;
  }>
> {
  try {
    const runAdvance = async () => {
      const saveStore = getStore(store);
      const loaded = await saveStore.load(saveId);
      if (!loaded) {
        return fail("Save not found.");
      }

      const commitToken = loaded.updatedAt;
      let workingState = loaded.state;
      let rngState = loaded.state.meta.rngState;
      const preEvents: DomainEvent[] = [];

      const participantsBlocked = advanceBlockedReason(workingState);
      if (participantsBlocked) {
        return fail(participantsBlocked);
      }

      if (hasActiveOwnerDecision(workingState.user)) {
        const blocking = workingState.user.pendingOwnerDecisions.find(
          (d) => d.blockingLevel === "blocking",
        );
        const teamId = blocking?.primaryTeamId;
        const team = teamId ? workingState.world.teams[teamId] : undefined;
        const teamLabel = team
          ? `${team.city} ${team.name}`
          : (teamId ?? "a franchise");
        const owner = teamId
          ? getParticipantForTeam(workingState, teamId)
          : null;
        if (owner && owner.id !== getActiveParticipant(workingState)?.id) {
          return fail(
            `${owner.displayName} must resolve a pending decision for ${teamLabel} before time can advance.`,
          );
        }
        const switchHint =
          teamId && teamId !== workingState.user.activeOwnerTeamId
            ? ` Switch to ${teamLabel} using the franchise selector in the header to resolve it.`
            : "";
        return fail(
          `${teamLabel} needs your attention before time can advance. Resolve the pending owner decision first.${switchHint}`,
        );
      }

      if (isUserOnDraftClock(workingState)) {
        if (shouldStopForDraftClock(workingState)) {
          return fail(
            "Cannot advance time while your team is on the draft clock. Make a draft selection first.",
          );
        }
        const rngDraft = createSeededRng(rngState);
        try {
          const continuity = runAiContinuity(workingState, rngDraft, {
            forcePhase: `draft_clock:${workingState.world.calendar.currentDate}`,
          });
          workingState = continuity.state;
          rngState = rngDraft.getState();
          preEvents.push(...continuity.events);
          if (
            shouldStopForDraftClock(workingState) ||
            isUserOnDraftClock(workingState)
          ) {
            return fail(
              "Cannot advance time while your team is on the draft clock. Make a draft selection first.",
            );
          }
        } catch (error) {
          return fail(mapTimeAdvancePersistenceError(error));
        }
      }

      // Preflight: reconcile phase pointer with date/state before simulating.
      {
        const { reconcilePhaseWithState } =
          await import("@/systems/simulation/phase-lifecycle");
        const preflight = reconcilePhaseWithState(workingState);
        workingState = preflight.state;
        preEvents.push(...preflight.events);
        if (preflight.stopReason === "owner_decision") {
          return fail(
            preflight.stopMessage ??
              "A required owner decision must be resolved before time can advance.",
          );
        }
        if (preflight.stopReason === "draft_clock") {
          return fail(
            preflight.stopMessage ??
              "Cannot advance time while your team is on the draft clock.",
          );
        }
      }

      const resolved = resolveAdvanceDays(workingState, options);
      if (!resolved.ok) {
        return fail(resolved.error);
      }

      const stopConditions = options.stopConditions ?? [];
      const isCalendarTarget =
        options.targetDate != null || options.targetMode != null;
      const stopOnPhaseChange =
        options.stopOnPhaseChange === true ||
        stopConditions.includes("phase_change");

      const rng = createSeededRng(rngState);
      const useBoxScore = isCalendarTarget || resolved.days > 1;
      const stopBeforeUserTeamGame = stopConditions.includes("user_team_game");
      // Regular-season init consumes a simulation step without moving the
      // calendar. Only add that extra step when this jump actually reaches
      // the opener; preseason-only jumps must land on the requested date.
      const plannedOpener = derivePlannedRegularSeasonStartDate(workingState);
      const jumpIncludesRegularSeasonInit =
        isCalendarTarget &&
        needsRegularSeasonInitialization(workingState) &&
        plannedOpener != null &&
        addCalendarDays(
          workingState.world.calendar.currentDate,
          resolved.days,
        ) >= plannedOpener;
      const days = jumpIncludesRegularSeasonInit
        ? resolved.days + 1
        : resolved.days;

      const result = await advanceSimulationAsync(workingState, rng, {
        days,
        stopOnPhaseChange,
        allowOwnerManagedPhaseTransitions: true,
        gameFidelity: useBoxScore ? "box_score" : "possession",
        stopBeforeUserTeamGame,
        onProgress: options.onProgress,
      });

      // Postflight: final phase reconciliation + full invariant validation.
      const { reconcilePhaseWithState } =
        await import("@/systems/simulation/phase-lifecycle");
      const { assertSimulationState } =
        await import("@/systems/simulation/validate-simulation-state");
      const { buildSimulationSummary } =
        await import("@/systems/calendar/simulation-summary");
      const postflight = reconcilePhaseWithState(result.state, rng);
      assertSimulationState(postflight.state, "full");

      const fromDate = workingState.world.calendar.currentDate;
      const allEvents = [...preEvents, ...result.events, ...postflight.events];
      const withProjections = withReadyReset(
        processDerivedProjections(postflight.state, allEvents),
      );

      const saved = await persistWorkingState(
        saveId,
        withProjections,
        rng.getState(),
        saveStore,
        allEvents,
        { ifUpdatedAt: commitToken },
      );

      const { state: _state, events: _ignored, ...simulation } = result;
      const highlights = buildSimulationHighlights(withProjections, allEvents);
      const summary = buildSimulationSummary(withProjections, allEvents, {
        fromDate,
        toDate: withProjections.world.calendar.currentDate,
      });
      return {
        ...withDashboard(saved),
        events: allEvents,
        simulation,
        highlights,
        summary,
      };
    };
    if (options.skipInProcessDedupe === true) {
      return await runAdvance();
    }
    return await withTimeAdvanceDedupe(saveId, runAdvance);
  } catch (error) {
    return fail(mapTimeAdvancePersistenceError(error));
  }
}

function resolveAdvanceDays(
  state: GameState,
  options: AdvanceOwnerTimeOptions,
): { ok: true; days: number } | { ok: false; error: string } {
  const currentDate = state.world.calendar.currentDate;
  const stopConditions = [...(options.stopConditions ?? [])];

  let days = options.days ?? 1;
  let targetDate = options.targetDate;

  if (options.targetMode != null) {
    if (options.targetMode === "next_decision") {
      // Advance until a blocking decision appears or phase changes.
      days = 400;
      stopConditions.push("blocking_decision", "phase_change");
      targetDate = undefined;
    } else if (options.targetMode === "next_month") {
      const parsed = parseCalendarDate(currentDate);
      const lastDayThisMonth = formatCalendarDate(
        parsed.year,
        parsed.month,
        new Date(parsed.year, parsed.month, 0).getDate(),
      );
      targetDate = lastDayThisMonth;
      if (targetDate <= currentDate) {
        const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
        const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
        targetDate = formatCalendarDate(
          nextYear,
          nextMonth,
          new Date(nextYear, nextMonth, 0).getDate(),
        );
      }
      stopConditions.push("blocking_decision");
    } else if (options.targetMode === "end_of_season") {
      const anchors = resolveSeasonAnchors(state);
      targetDate =
        anchors.playoffsEnd ??
        anchors.regularSeasonEnd ??
        anchors.seasonReviewStart ??
        undefined;
      if (!targetDate || targetDate <= currentDate) {
        return {
          ok: false,
          error: "No end-of-season date is available to simulate to.",
        };
      }
      stopConditions.push("blocking_decision");
    } else {
      const target = findNextSimulationTarget(state, options.targetMode);
      if (!target || target.daysUntil < 1) {
        const labels: Record<string, string> = {
          next_game: "No upcoming team game found.",
          next_important: "No upcoming important event found.",
          next_deadline: "No upcoming deadline found.",
        };
        return {
          ok: false,
          error: labels[options.targetMode] ?? "No target found.",
        };
      }
      targetDate = target.date;
      if (options.targetMode === "next_game") {
        stopConditions.push("user_team_game", "blocking_decision");
      } else if (options.targetMode === "next_important") {
        stopConditions.push("important_event", "blocking_decision");
      } else {
        stopConditions.push("blocking_decision");
      }
    }
  }

  if (targetDate != null) {
    const delta = calendarDaysBetween(currentDate, targetDate);
    if (delta < 0) {
      return {
        ok: false,
        error: "Cannot simulate backward. Select a future date.",
      };
    }
    if (delta === 0) {
      return {
        ok: false,
        error: "Already at the selected date.",
      };
    }
    days = delta;
  }

  // Cap days at earlier stop-condition targets when requested.
  const caps: number[] = [days];

  if (stopConditions.includes("user_team_game")) {
    const next = findNextSimulationTarget(state, "next_game");
    if (next && next.daysUntil > 0) {
      caps.push(next.daysUntil);
    }
  }
  if (stopConditions.includes("important_event")) {
    const next = findNextSimulationTarget(state, "next_important");
    if (next && next.daysUntil > 0) {
      caps.push(next.daysUntil);
    }
  }
  if (
    stopConditions.includes("blocking_decision") &&
    options.targetMode !== "next_decision"
  ) {
    const next = findNextSimulationTarget(state, "next_decision");
    if (next && next.daysUntil > 0) {
      caps.push(next.daysUntil);
    }
  }

  const resolvedDays = Math.min(...caps);
  if (!Number.isInteger(resolvedDays) || resolvedDays < 1) {
    return { ok: false, error: "Nothing to simulate for the selected target." };
  }

  return { ok: true, days: resolvedDays };
}

/** @deprecated Prefer advanceOwnerTime — kept for existing callers. */
export async function advanceOwnerDay(
  saveId: string,
  store?: SaveGameStore,
): Promise<AdvanceDayResult | null> {
  const result = await advanceOwnerTime(saveId, { days: 1 }, store);
  if (!result.ok) {
    if (result.error === "Save not found.") {
      return null;
    }
    throw new Error(result.error);
  }
  return {
    save: result.save,
    dashboard: result.dashboard,
    events: result.events,
    simulation: result.simulation,
  };
}

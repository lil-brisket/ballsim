/**
 * League calendar: season anchors + phase resolution.
 *
 * Expected phase windows are date-derived. Actual active phase also depends on
 * league state, event completion, and blocking owner decisions.
 */

import {
  addCalendarDays,
  calendarDaysBetween,
} from "@/domain/calendar-date";
import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
import type { GameState } from "@/state/game-state";
import { isDraftCompleteForYear } from "@/systems/league-rules/draft-rules";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import {
  OFFSEASON_PHASE_WINDOWS,
  PRESEASON_LENGTH_DAYS,
  SEASON_REVIEW_LENGTH_DAYS,
  getPhaseWindowConfig,
  type PhaseWindowConfig,
} from "@/systems/simulation/offseason-calendar-config";
import { evaluatePhaseTasks } from "@/systems/phase-engine/evaluate-phase-tasks";
import { getPhaseDefinition } from "@/systems/phase-engine/phase-definitions";
import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";

export type SeasonAnchors = {
  regularSeasonStart: string | null;
  regularSeasonEnd: string | null;
  playoffsEnd: string | null;
  offseasonStart: string | null;
  preseasonStart: string | null;
  seasonReviewStart: string | null;
};

export type PhaseResolutionReason =
  | "date_window"
  | "event_incomplete"
  | "blocking_decision"
  | "reconciled"
  | "in_season_state";

export type PhaseBlockedBy =
  | "draft_incomplete"
  | "fa_open"
  | "owner_decision"
  | "required_tasks"
  | "preparation_incomplete";

export type PhaseResolution = {
  phaseId: LeaguePhaseId;
  reason: PhaseResolutionReason;
  expectedWindow: { start: string; end: string | null } | null;
  blockedBy?: PhaseBlockedBy;
};

export type ResolvedPhaseWindow = {
  phaseId: LeaguePhaseId;
  start: string;
  end: string | null;
  config: PhaseWindowConfig;
};

export const PHASE_ORDER: readonly LeaguePhaseId[] = [
  "postseason.season_review",
  "offseason.season_transition",
  "offseason.roster_decisions",
  "offseason.draft_preparation",
  "offseason.draft",
  "offseason.free_agency",
  "offseason.staff_development",
  "preseason.preparation",
  "regular",
  "playoffs",
  "end_of_season.wrap_up",
] as const;

export function phaseOrderIndex(phaseId: LeaguePhaseId): number {
  const idx = PHASE_ORDER.indexOf(phaseId);
  return idx === -1 ? 0 : idx;
}

export function getNextPhaseInOrder(
  phaseId: LeaguePhaseId,
): LeaguePhaseId | null {
  return getPhaseDefinition(phaseId).nextPhaseId;
}

function scheduleBounds(state: GameState): {
  earliest: string | null;
  latest: string | null;
} {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (game.competitionType === "development_league") continue;
    if (earliest === null || game.date < earliest) earliest = game.date;
    if (latest === null || game.date > latest) latest = game.date;
  }
  return { earliest, latest };
}

function lastFinalGameDate(
  state: GameState,
  competitionType: "regular_season" | "playoffs",
): string | null {
  let latest: string | null = null;
  for (const game of Object.values(state.competition.games)) {
    if (game.status !== "final") continue;
    if (game.competitionType !== competitionType) continue;
    if (latest === null || game.date > latest) latest = game.date;
  }
  return latest;
}

export function resolveSeasonAnchors(state: GameState): SeasonAnchors {
  const bounds = scheduleBounds(state);
  const regularSeasonStart =
    state.competition.season.regularSeasonStartDate ?? bounds.earliest;

  const regularSeasonEnd =
    lastFinalGameDate(state, "regular_season") ?? bounds.latest;

  const playoffsEnd =
    lastFinalGameDate(state, "playoffs") ??
    (state.competition.playoffs.status === "complete"
      ? regularSeasonEnd
      : null);

  const seasonEndAnchor = playoffsEnd ?? regularSeasonEnd;

  const seasonReviewStart = seasonEndAnchor
    ? addCalendarDays(seasonEndAnchor, 1)
    : state.competition.season.offseasonStageEnteredDate
      ? addCalendarDays(
          state.competition.season.offseasonStageEnteredDate,
          -SEASON_REVIEW_LENGTH_DAYS,
        )
      : null;

  const offseasonStart =
    state.competition.season.offseasonStageEnteredDate ??
    (seasonReviewStart
      ? addCalendarDays(seasonReviewStart, SEASON_REVIEW_LENGTH_DAYS)
      : seasonEndAnchor
        ? addCalendarDays(seasonEndAnchor, 1 + SEASON_REVIEW_LENGTH_DAYS)
        : null);

  const preseasonStart = regularSeasonStart
    ? addCalendarDays(regularSeasonStart, -PRESEASON_LENGTH_DAYS)
    : null;

  return {
    regularSeasonStart,
    regularSeasonEnd,
    playoffsEnd,
    offseasonStart,
    preseasonStart,
    seasonReviewStart,
  };
}

function freeAgencyDurationDays(state: GameState): number {
  return state.settings.offseason.freeAgency.durationDays;
}

export function resolveOffseasonWindows(
  state: GameState,
): ResolvedPhaseWindow[] {
  const anchors = resolveSeasonAnchors(state);
  if (!anchors.offseasonStart) {
    return [];
  }

  const start = anchors.offseasonStart;
  const faDays = freeAgencyDurationDays(state);
  const windows: ResolvedPhaseWindow[] = [];

  const transitionCfg = getPhaseWindowConfig("offseason.season_transition")!;
  windows.push({
    phaseId: "offseason.season_transition",
    start,
    end: addCalendarDays(start, transitionCfg.minimumDurationDays),
    config: transitionCfg,
  });

  const rosterCfg = getPhaseWindowConfig("offseason.roster_decisions")!;
  windows.push({
    phaseId: "offseason.roster_decisions",
    start,
    end: rosterCfg.maximumDurationDays
      ? addCalendarDays(start, rosterCfg.maximumDurationDays)
      : addCalendarDays(start, rosterCfg.minimumDurationDays),
    config: rosterCfg,
  });

  const prepCfg = getPhaseWindowConfig("offseason.draft_preparation")!;
  const prepStart = addCalendarDays(start, prepCfg.startOffsetDays);
  windows.push({
    phaseId: "offseason.draft_preparation",
    start: prepStart,
    end: prepCfg.maximumDurationDays
      ? addCalendarDays(prepStart, prepCfg.maximumDurationDays)
      : null,
    config: prepCfg,
  });

  const draftCfg = getPhaseWindowConfig("offseason.draft")!;
  windows.push({
    phaseId: "offseason.draft",
    start: addCalendarDays(start, draftCfg.startOffsetDays),
    end: null,
    config: draftCfg,
  });

  const faCfg = getPhaseWindowConfig("offseason.free_agency")!;
  const faStart = addCalendarDays(start, faCfg.startOffsetDays);
  const faEnd = addCalendarDays(
    faStart,
    Math.max(faDays, faCfg.minimumDurationDays),
  );
  windows.push({
    phaseId: "offseason.free_agency",
    start: faStart,
    end: faEnd,
    config: faCfg,
  });

  const staffCfg = getPhaseWindowConfig("offseason.staff_development")!;
  windows.push({
    phaseId: "offseason.staff_development",
    start: faEnd,
    end: anchors.preseasonStart,
    config: staffCfg,
  });

  if (anchors.preseasonStart && anchors.regularSeasonStart) {
    const preCfg = getPhaseWindowConfig("preseason.preparation")!;
    windows.push({
      phaseId: "preseason.preparation",
      start: anchors.preseasonStart,
      end: anchors.regularSeasonStart,
      config: preCfg,
    });
  }

  return windows;
}

export function getExpectedPhaseWindow(
  state: GameState,
  phaseId: LeaguePhaseId,
): ResolvedPhaseWindow | null {
  const anchors = resolveSeasonAnchors(state);

  if (phaseId === "regular") {
    return anchors.regularSeasonStart
      ? {
          phaseId,
          start: anchors.regularSeasonStart,
          end: anchors.regularSeasonEnd,
          config: {
            phaseId,
            startOffsetDays: 0,
            minimumDurationDays: 1,
            maximumDurationDays: null,
            completionCondition: "until_regular_season_start",
          },
        }
      : null;
  }

  if (phaseId === "postseason.season_review" && anchors.seasonReviewStart) {
    return {
      phaseId,
      start: anchors.seasonReviewStart,
      end: anchors.offseasonStart,
      config: {
        phaseId,
        startOffsetDays: 0,
        minimumDurationDays: SEASON_REVIEW_LENGTH_DAYS,
        maximumDurationDays: SEASON_REVIEW_LENGTH_DAYS,
        completionCondition: "automatic",
      },
    };
  }

  if (phaseId === "playoffs" || phaseId === "end_of_season.wrap_up") {
    return null;
  }

  return (
    resolveOffseasonWindows(state).find((w) => w.phaseId === phaseId) ?? null
  );
}

function expectedPhaseFromDate(
  state: GameState,
  date: string,
): { phaseId: LeaguePhaseId; window: ResolvedPhaseWindow | null } {
  const anchors = resolveSeasonAnchors(state);
  const seasonPhase = state.competition.season.phase;
  const playoffs = state.competition.playoffs;

  if (
    (seasonPhase === "playoffs" || playoffs.status === "in_progress") &&
    playoffs.status !== "complete"
  ) {
    return { phaseId: "playoffs", window: null };
  }

  if (
    seasonPhase === "regular" &&
    anchors.regularSeasonStart &&
    date >= anchors.regularSeasonStart
  ) {
    const unfinishedRegular = Object.values(state.competition.games).some(
      (g) =>
        g.competitionType === "regular_season" &&
        g.status !== "final" &&
        g.date >= date,
    );
    if (
      unfinishedRegular ||
      !anchors.regularSeasonEnd ||
      date <= anchors.regularSeasonEnd
    ) {
      return {
        phaseId: "regular",
        window: getExpectedPhaseWindow(state, "regular"),
      };
    }
  }

  if (
    anchors.seasonReviewStart &&
    anchors.offseasonStart &&
    date >= anchors.seasonReviewStart &&
    date < anchors.offseasonStart
  ) {
    return {
      phaseId: "postseason.season_review",
      window: getExpectedPhaseWindow(state, "postseason.season_review"),
    };
  }

  if (seasonPhase === "postseason") {
    return {
      phaseId: "postseason.season_review",
      window: getExpectedPhaseWindow(state, "postseason.season_review"),
    };
  }

  if (anchors.preseasonStart && anchors.regularSeasonStart) {
    if (date >= anchors.preseasonStart && date < anchors.regularSeasonStart) {
      return {
        phaseId: "preseason.preparation",
        window: getExpectedPhaseWindow(state, "preseason.preparation"),
      };
    }
    if (date >= anchors.regularSeasonStart && seasonPhase !== "offseason") {
      return {
        phaseId: "regular",
        window: getExpectedPhaseWindow(state, "regular"),
      };
    }
  }

  const windows = resolveOffseasonWindows(state);
  if (windows.length === 0) {
    return { phaseId: readActivePhaseId(state), window: null };
  }

  for (let i = windows.length - 1; i >= 0; i -= 1) {
    const w = windows[i]!;
    if (date < w.start) continue;
    if (w.end !== null && date >= w.end) continue;
    return { phaseId: w.phaseId, window: w };
  }

  if (anchors.offseasonStart && date >= anchors.offseasonStart) {
    return { phaseId: windows[0]!.phaseId, window: windows[0]! };
  }

  return { phaseId: readActivePhaseId(state), window: null };
}

function ownedRequiredTaskCount(state: GameState): number {
  let count = 0;
  for (const teamId of state.user.ownedTeamIds) {
    count += evaluatePhaseTasks(state, teamId).counts.required;
  }
  return count;
}

function isDraftDone(state: GameState): boolean {
  return isDraftCompleteForYear(state, state.competition.season.year);
}

function phaseEnteredDate(state: GameState): string {
  return (
    state.competition.phase?.enteredDate ??
    state.competition.season.offseasonStageEnteredDate ??
    state.world.calendar.currentDate
  );
}

function daysInPhase(state: GameState, date: string): number {
  return Math.max(0, calendarDaysBetween(phaseEnteredDate(state), date));
}

/**
 * Resolve the actual phase the simulation should be in for `date`.
 */
export function resolvePhaseResolution(
  state: GameState,
  date: string = state.world.calendar.currentDate,
): PhaseResolution {
  const activeId = readActivePhaseId(state);
  const { phaseId: expectedId, window } = expectedPhaseFromDate(state, date);
  const expectedWindow = window
    ? { start: window.start, end: window.end }
    : null;

  if (hasBlockingOwnerDecision(state.user)) {
    return {
      phaseId: activeId,
      reason: "blocking_decision",
      expectedWindow,
      blockedBy: "owner_decision",
    };
  }

  const pastDraft =
    phaseOrderIndex(expectedId) >= phaseOrderIndex("offseason.draft");
  if (
    !isDraftDone(state) &&
    pastDraft &&
    phaseOrderIndex(activeId) <= phaseOrderIndex("offseason.draft")
  ) {
    const prepCfg = getPhaseWindowConfig("offseason.draft_preparation");
    const holdPrep =
      activeId === "offseason.draft_preparation" &&
      prepCfg !== null &&
      daysInPhase(state, date) < prepCfg.minimumDurationDays;

    let holdId: LeaguePhaseId = "offseason.draft";
    if (holdPrep) {
      holdId = "offseason.draft_preparation";
    } else if (
      activeId === "offseason.draft" ||
      phaseOrderIndex(activeId) >= phaseOrderIndex("offseason.draft")
    ) {
      holdId = "offseason.draft";
    } else if (activeId === "offseason.draft_preparation") {
      holdId = "offseason.draft";
    } else {
      holdId = activeId;
    }

    const draftWindow = getExpectedPhaseWindow(state, "offseason.draft");
    return {
      phaseId: holdId,
      reason: "event_incomplete",
      expectedWindow: draftWindow
        ? { start: draftWindow.start, end: null }
        : expectedWindow,
      blockedBy:
        holdId === "offseason.draft_preparation"
          ? "preparation_incomplete"
          : "draft_incomplete",
    };
  }

  if (activeId === "offseason.roster_decisions") {
    const cfg = getPhaseWindowConfig("offseason.roster_decisions")!;
    const elapsed = daysInPhase(state, date);
    const required = ownedRequiredTaskCount(state);
    if (elapsed < cfg.minimumDurationDays || required > 0) {
      return {
        phaseId: activeId,
        reason: required > 0 ? "event_incomplete" : "date_window",
        expectedWindow,
        blockedBy: required > 0 ? "required_tasks" : undefined,
      };
    }
  }

  if (activeId === "offseason.draft_preparation") {
    const cfg = getPhaseWindowConfig("offseason.draft_preparation")!;
    if (daysInPhase(state, date) < cfg.minimumDurationDays) {
      return {
        phaseId: activeId,
        reason: "date_window",
        expectedWindow,
        blockedBy: "preparation_incomplete",
      };
    }
  }

  if (activeId === "offseason.free_agency") {
    const entered = phaseEnteredDate(state);
    const faDays = freeAgencyDurationDays(state);
    const extended = state.competition.season.freeAgencyExtendedUntil;
    const faEnd = extended ?? addCalendarDays(entered, faDays);
    if (date < faEnd) {
      return {
        phaseId: activeId,
        reason: "date_window",
        expectedWindow: { start: entered, end: faEnd },
        blockedBy: "fa_open",
      };
    }
  }

  if (phaseOrderIndex(activeId) > phaseOrderIndex(expectedId)) {
    return {
      phaseId: activeId,
      reason: "reconciled",
      expectedWindow,
    };
  }

  if (expectedId !== activeId) {
    const inSeason =
      expectedId === "regular" ||
      expectedId === "playoffs" ||
      expectedId === "postseason.season_review";
    return {
      phaseId: expectedId,
      reason: inSeason ? "in_season_state" : "date_window",
      expectedWindow,
    };
  }

  return {
    phaseId: activeId,
    reason: "date_window",
    expectedWindow,
  };
}

export { OFFSEASON_PHASE_WINDOWS, getPhaseWindowConfig };

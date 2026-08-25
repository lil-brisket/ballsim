import { calendarDaysBetween } from "@/domain/calendar-date";
import { playoffRoundLabel } from "@/domain/entities/playoffs";
import type { GameState } from "@/state/game-state";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { computePhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import {
  canUserManageFranchise,
  isAnyAiAssistEnabled,
} from "@/systems/simulation/management-policy";

export type SimulationPhaseContext = {
  primaryLabel: string;
  subLabel?: string;
  seasonYear: number;
  dayInPhase: number;
  phaseDurationDays: number | null;
  nextPhaseLabel: string | null;
  canUserManage: boolean;
  unresolvedDecisionCount: number;
  responsibility: "user" | "ai" | "unresolved";
  aiAssistEnabled: boolean;
};

export type SimulationPhaseKey =
  | "preseason"
  | "regular"
  | "trade_deadline"
  | "playoffs"
  | "finals"
  | "postseason"
  | "offseason"
  | "free_agency"
  | "draft"
  | "season_transition";

/**
 * Derived display/control context for the current simulation phase.
 * Persisted authority remains SeasonPhase + OffseasonStage.
 */
export function resolveSimulationPhase(state: GameState): SimulationPhaseContext {
  const calendar = getCalendarContext(state);
  const season = state.competition.season;
  const phaseKey = resolveSimulationPhaseKey(state);
  const labels = labelsForPhaseKey(phaseKey, calendar.displayLabel);
  const responsibility = computePhaseResponsibility(state);
  const dayInPhase = computeDayInPhase(state);
  const phaseDurationDays =
    phaseKey === "free_agency"
      ? state.settings.offseason.freeAgency.durationDays
      : null;

  return {
    primaryLabel: labels.primaryLabel,
    subLabel: labels.subLabel,
    seasonYear: season.year,
    dayInPhase,
    phaseDurationDays,
    nextPhaseLabel: nextPhaseLabelFor(phaseKey, calendar.seasonSegment),
    canUserManage: canUserManageFranchise(state.settings),
    unresolvedDecisionCount: responsibility.unresolvedCount,
    responsibility: responsibility.owner,
    aiAssistEnabled: isAnyAiAssistEnabled(state.settings),
  };
}

export function resolveSimulationPhaseKey(state: GameState): SimulationPhaseKey {
  const season = state.competition.season;
  const calendar = getCalendarContext(state);

  if (season.phase === "preseason") {
    return "preseason";
  }
  if (season.phase === "regular") {
    return calendar.seasonSegment === "deadline_window"
      ? "trade_deadline"
      : "regular";
  }
  if (season.phase === "playoffs") {
    return isFinals(state) ? "finals" : "playoffs";
  }
  if (season.phase === "postseason") {
    return "postseason";
  }

  switch (season.offseasonStage) {
    case "free_agency":
      return "free_agency";
    case "draft":
      return "draft";
    case "league_initialization":
      return "season_transition";
    default:
      return "offseason";
  }
}

function isFinals(state: GameState): boolean {
  const playoffs = state.competition.playoffs;
  if (playoffs.status !== "in_progress" || playoffs.fieldSize < 2) {
    return false;
  }
  const active = playoffs.series.filter((series) => series.status === "active");
  if (active.length === 0) {
    return false;
  }
  const maxRound = Math.max(...active.map((series) => series.round));
  try {
    return playoffRoundLabel(maxRound, playoffs.fieldSize) === "final";
  } catch {
    return false;
  }
}

function computeDayInPhase(state: GameState): number {
  const season = state.competition.season;
  const currentDate = state.world.calendar.currentDate;

  if (
    season.phase === "offseason" &&
    season.offseasonStage !== "none" &&
    season.offseasonStageEnteredDate !== null
  ) {
    return Math.max(
      1,
      calendarDaysBetween(season.offseasonStageEnteredDate, currentDate) + 1,
    );
  }

  if (
    season.phase === "regular" &&
    season.regularSeasonStartDate !== null
  ) {
    return Math.max(
      1,
      calendarDaysBetween(season.regularSeasonStartDate, currentDate) + 1,
    );
  }

  return 1;
}

function labelsForPhaseKey(
  phaseKey: SimulationPhaseKey,
  displayLabel: string,
): { primaryLabel: string; subLabel?: string } {
  switch (phaseKey) {
    case "preseason":
      return { primaryLabel: "TRAINING CAMP", subLabel: "Preseason" };
    case "regular":
      return { primaryLabel: "REGULAR SEASON", subLabel: displayLabel };
    case "trade_deadline":
      return { primaryLabel: "TRADE DEADLINE", subLabel: "Regular Season" };
    case "playoffs":
      return { primaryLabel: "PLAYOFFS" };
    case "finals":
      return { primaryLabel: "FINALS", subLabel: "Playoffs" };
    case "postseason":
      return { primaryLabel: "SEASON REVIEW", subLabel: "Postseason" };
    case "free_agency":
      return { primaryLabel: "FREE AGENCY", subLabel: "Offseason" };
    case "draft":
      return { primaryLabel: "DRAFT", subLabel: "Offseason" };
    case "season_transition":
      return { primaryLabel: "SEASON TRANSITION", subLabel: "Offseason" };
    case "offseason":
    default:
      return { primaryLabel: "OFFSEASON", subLabel: displayLabel };
  }
}

function nextPhaseLabelFor(
  phaseKey: SimulationPhaseKey,
  seasonSegment: string,
): string | null {
  switch (phaseKey) {
    case "preseason":
      return "Regular Season";
    case "regular":
      return seasonSegment === "late" ? "Playoffs" : null;
    case "trade_deadline":
      return "Late Season";
    case "playoffs":
      return "Finals";
    case "finals":
      return "Season Review";
    case "postseason":
      return "Offseason";
    case "offseason":
      return "Free Agency";
    case "free_agency":
      return "Draft";
    case "draft":
      return "Season Transition";
    case "season_transition":
      return "Preseason";
    default:
      return null;
  }
}

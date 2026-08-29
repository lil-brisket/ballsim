import { calendarDaysBetween } from "@/domain/calendar-date";
import { playoffRoundLabel } from "@/domain/entities/playoffs";
import type { GameState } from "@/state/game-state";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { computePhaseResponsibility } from "@/systems/simulation/phase-responsibility";
import {
  canUserManageFranchise,
  isAnyAiAssistEnabled,
} from "@/systems/simulation/management-policy";
import {
  getActivePhaseId,
  getPhaseDefinition,
  resolveCurrentPhase,
} from "@/systems/phase-engine";

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
  /** Authoritative league phase id (v49+). */
  activePhaseId: string;
  theme: string;
  objective: string;
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
  | "draft_preparation"
  | "roster_decisions"
  | "staff_development"
  | "season_transition";

/**
 * Derived display/control context for the current simulation phase.
 * Persisted authority is competition.phase.activePhaseId (with legacy fallback).
 */
export function resolveSimulationPhase(state: GameState): SimulationPhaseContext {
  const calendar = getCalendarContext(state);
  const season = state.competition.season;
  const resolved = resolveCurrentPhase(state);
  const phaseKey = resolveSimulationPhaseKey(state);
  const labels = labelsForPhaseKey(phaseKey, calendar.displayLabel, resolved.name);
  const responsibility = computePhaseResponsibility(state);
  const dayInPhase = computeDayInPhase(state);
  const phaseDurationDays =
    getActivePhaseId(state) === "offseason.free_agency"
      ? state.settings.offseason.freeAgency.durationDays
      : null;

  return {
    primaryLabel: labels.primaryLabel,
    subLabel: labels.subLabel,
    seasonYear: season.year,
    dayInPhase,
    phaseDurationDays,
    nextPhaseLabel: resolved.nextPhaseName,
    canUserManage: canUserManageFranchise(state.settings),
    unresolvedDecisionCount: responsibility.unresolvedCount,
    responsibility: responsibility.owner,
    aiAssistEnabled: isAnyAiAssistEnabled(state.settings),
    activePhaseId: resolved.phaseId,
    theme: resolved.theme,
    objective: resolved.objective,
  };
}

export function resolveSimulationPhaseKey(state: GameState): SimulationPhaseKey {
  const phaseId = getActivePhaseId(state);
  const calendar = getCalendarContext(state);

  switch (phaseId) {
    case "preseason.preparation":
      return "preseason";
    case "regular":
      return calendar.seasonSegment === "deadline_window"
        ? "trade_deadline"
        : "regular";
    case "playoffs":
      return isFinals(state) ? "finals" : "playoffs";
    case "postseason.season_review":
    case "end_of_season.wrap_up":
      return "postseason";
    case "offseason.free_agency":
      return "free_agency";
    case "offseason.draft":
      return "draft";
    case "offseason.draft_preparation":
      return "draft_preparation";
    case "offseason.roster_decisions":
      return "roster_decisions";
    case "offseason.staff_development":
      return "staff_development";
    case "offseason.season_transition":
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
  const entered =
    state.competition.phase?.enteredDate ??
    state.competition.season.offseasonStageEnteredDate;
  const currentDate = state.world.calendar.currentDate;

  if (entered !== null && entered !== undefined) {
    return Math.max(1, calendarDaysBetween(entered, currentDate) + 1);
  }

  if (
    state.competition.season.phase === "regular" &&
    state.competition.season.regularSeasonStartDate !== null
  ) {
    return Math.max(
      1,
      calendarDaysBetween(
        state.competition.season.regularSeasonStartDate,
        currentDate,
      ) + 1,
    );
  }

  return 1;
}

function labelsForPhaseKey(
  phaseKey: SimulationPhaseKey,
  displayLabel: string,
  resolvedName: string,
): { primaryLabel: string; subLabel?: string } {
  switch (phaseKey) {
    case "preseason":
      return { primaryLabel: "PRESEASON", subLabel: "Preparation" };
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
    case "draft_preparation":
      return { primaryLabel: "DRAFT PREP", subLabel: "Offseason" };
    case "roster_decisions":
      return { primaryLabel: "ROSTER DECISIONS", subLabel: "Offseason" };
    case "staff_development":
      return { primaryLabel: "STAFF & DEVELOPMENT", subLabel: "Offseason" };
    case "season_transition":
      return { primaryLabel: "SEASON TRANSITION", subLabel: "Offseason" };
    case "offseason":
    default:
      return {
        primaryLabel: resolvedName.toUpperCase(),
        subLabel: displayLabel,
      };
  }
}

/** @deprecated Prefer resolveCurrentPhase().nextPhaseName */
export function nextPhaseLabelFromDefinition(state: GameState): string | null {
  const def = getPhaseDefinition(getActivePhaseId(state));
  if (def.nextPhaseId === null) {
    return null;
  }
  return getPhaseDefinition(def.nextPhaseId).name;
}

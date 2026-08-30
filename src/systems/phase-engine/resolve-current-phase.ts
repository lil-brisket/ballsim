import type { OffseasonStage, SeasonPhase } from "@/domain/entities/season";
import type { GameState } from "@/state/game-state";
import {
  getPhaseDefinition,
  isLeaguePhaseId,
} from "@/systems/phase-engine/phase-definitions";
import type {
  CompetitionPhaseState,
  LeaguePhaseId,
  ResolvedPhase,
} from "@/systems/phase-engine/phase-types";

/**
 * Map legacy offseasonStage → LeaguePhaseId for migration / fallback.
 */
export function leaguePhaseIdFromLegacy(
  seasonPhase: SeasonPhase,
  offseasonStage: OffseasonStage,
): LeaguePhaseId {
  if (seasonPhase === "postseason") {
    return "postseason.season_review";
  }
  if (seasonPhase === "preseason") {
    return "preseason.preparation";
  }
  if (seasonPhase === "regular") {
    return "regular";
  }
  if (seasonPhase === "playoffs") {
    return "playoffs";
  }
  // offseason
  switch (offseasonStage) {
    case "season_finalization":
      return "offseason.season_transition";
    case "contract_expiration":
    case "roster_decisions":
      return "offseason.roster_decisions";
    case "draft_preparation":
      return "offseason.draft_preparation";
    case "free_agency":
      return "offseason.free_agency";
    case "draft":
      return "offseason.draft";
    case "staff_development":
    case "league_initialization":
      return "offseason.staff_development";
    case "none":
    default:
      return "offseason.season_transition";
  }
}

/**
 * Keep legacy OffseasonStage roughly in sync for gradual caller migration.
 */
export function legacyOffseasonStageFromPhase(
  phaseId: LeaguePhaseId,
): OffseasonStage {
  switch (phaseId) {
    case "offseason.season_transition":
      return "season_finalization";
    case "offseason.roster_decisions":
      return "roster_decisions";
    case "offseason.draft_preparation":
      return "draft_preparation";
    case "offseason.draft":
      return "draft";
    case "offseason.free_agency":
      return "free_agency";
    case "offseason.staff_development":
      return "staff_development";
    default:
      return "none";
  }
}

export function seasonPhaseFromLeaguePhase(
  phaseId: LeaguePhaseId,
): SeasonPhase {
  const stage = getPhaseDefinition(phaseId).stage;
  if (stage === "end_of_season") {
    return "postseason";
  }
  if (stage === "offseason") {
    return "offseason";
  }
  return stage;
}

/**
 * Authoritative active phase id from persisted competition.phase.
 * When stored phase disagrees with legacy season.phase, prefer competition.phase
 * and treat season.phase as stale (callers should repair via setActivePhase).
 */
export function getActivePhaseId(state: GameState): LeaguePhaseId {
  const stored = state.competition.phase?.activePhaseId;
  if (isLeaguePhaseId(stored)) {
    return stored;
  }
  return leaguePhaseIdFromLegacy(
    state.competition.season.phase,
    state.competition.season.offseasonStage,
  );
}

export function getCompetitionPhaseState(
  state: GameState,
): CompetitionPhaseState {
  const phase = state.competition.phase;
  if (
    phase !== undefined &&
    isLeaguePhaseId(phase.activePhaseId) &&
    typeof phase.enteredDate === "string"
  ) {
    return phase;
  }
  return {
    activePhaseId: getActivePhaseId(state),
    enteredDate:
      state.competition.season.offseasonStageEnteredDate ??
      state.world.calendar.currentDate,
  };
}

export function resolveCurrentPhase(state: GameState): ResolvedPhase {
  const { activePhaseId, enteredDate } = getCompetitionPhaseState(state);
  const def = getPhaseDefinition(activePhaseId);
  const nextDef =
    def.nextPhaseId !== null ? getPhaseDefinition(def.nextPhaseId) : null;
  const laterDef =
    def.laterPhaseId !== null ? getPhaseDefinition(def.laterPhaseId) : null;

  return {
    phaseId: activePhaseId,
    stage: def.stage,
    name: def.name,
    theme: def.theme,
    objective: def.objective,
    description: def.description,
    advanceMode: def.advanceMode,
    enteredDate,
    nextPhaseId: def.nextPhaseId,
    nextPhaseName: nextDef?.name ?? null,
    laterPhaseId: def.laterPhaseId,
    laterPhaseName: laterDef?.name ?? null,
  };
}

export function isInLeaguePhase(
  state: GameState,
  phaseId: LeaguePhaseId,
): boolean {
  return getActivePhaseId(state) === phaseId;
}

export function isInAnyLeaguePhase(
  state: GameState,
  phaseIds: readonly LeaguePhaseId[],
): boolean {
  const active = getActivePhaseId(state);
  return phaseIds.includes(active);
}

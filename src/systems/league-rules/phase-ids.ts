/**
 * Phase ID helpers for league-rules.
 * Duplicates the ID list so league-rules does not import phase-engine runtime.
 * Types may use LeaguePhaseId from phase-types (type-only).
 */

import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";
import type { SeasonPhase } from "@/domain/entities/season";

export const LEAGUE_PHASE_ID_SET: ReadonlySet<string> = new Set([
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
]);

export function isLeaguePhaseId(value: unknown): value is LeaguePhaseId {
  return typeof value === "string" && LEAGUE_PHASE_ID_SET.has(value);
}

/**
 * Read authoritative phase from competition.phase.
 * Prefer stored activePhaseId; never invent from legacy alone for new code paths.
 */
export function readActivePhaseId(state: {
  competition: {
    phase?: { activePhaseId?: string } | null;
    season: { phase: SeasonPhase; offseasonStage: string };
  };
}): LeaguePhaseId {
  const stored = state.competition.phase?.activePhaseId;
  if (isLeaguePhaseId(stored)) {
    return stored;
  }
  // Legacy fallback for pre-migration states only.
  return legacyPhaseFallback(
    state.competition.season.phase,
    state.competition.season.offseasonStage,
  );
}

function legacyPhaseFallback(
  seasonPhase: SeasonPhase,
  offseasonStage: string,
): LeaguePhaseId {
  if (seasonPhase === "postseason") return "postseason.season_review";
  if (seasonPhase === "preseason") return "preseason.preparation";
  if (seasonPhase === "regular") return "regular";
  if (seasonPhase === "playoffs") return "playoffs";
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
    default:
      return "offseason.season_transition";
  }
}

export function seasonPhaseFromPhaseId(phaseId: LeaguePhaseId): SeasonPhase {
  if (
    phaseId === "postseason.season_review" ||
    phaseId === "end_of_season.wrap_up"
  ) {
    return "postseason";
  }
  if (phaseId.startsWith("offseason.")) {
    return "offseason";
  }
  if (phaseId === "preseason.preparation") {
    return "preseason";
  }
  if (phaseId === "playoffs") {
    return "playoffs";
  }
  return "regular";
}

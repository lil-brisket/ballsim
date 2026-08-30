import type { SeasonId } from "@/domain/ids";

export type SeasonPhase =
  | "preseason"
  | "regular"
  | "playoffs"
  | "postseason"
  | "offseason";

export const SEASON_PHASES: readonly SeasonPhase[] = [
  "preseason",
  "regular",
  "playoffs",
  "postseason",
  "offseason",
] as const;

export type OffseasonStage =
  | "none"
  | "season_finalization"
  | "contract_expiration"
  | "roster_decisions"
  | "draft_preparation"
  | "free_agency"
  | "draft"
  | "staff_development"
  | "league_initialization";

export const OFFSEASON_STAGES: readonly OffseasonStage[] = [
  "none",
  "season_finalization",
  "contract_expiration",
  "roster_decisions",
  "draft_preparation",
  "free_agency",
  "draft",
  "staff_development",
  "league_initialization",
] as const;

export type Season = {
  id: SeasonId;
  year: number;
  phase: SeasonPhase;
  offseasonStage: OffseasonStage;
  /**
   * Calendar date when this season entered the regular phase (YYYY-MM-DD).
   * Null until preseason → regular. Used for league trade-deadline rules.
   */
  regularSeasonStartDate: string | null;
  /**
   * Snapshotted trade deadline (YYYY-MM-DD) set when regular season begins.
   * 60% of regular-season calendar span — not games played.
   * Null until regular season starts.
   */
  tradeDeadlineDate: string | null;
  /**
   * True after roster_decisions classifies all expiring players as UFA or RFA.
   * Required before free agency opens.
   */
  rfaQualificationComplete: boolean;
  /**
   * Calendar date when the current offseasonStage was entered (YYYY-MM-DD).
   * Null when offseasonStage is "none" or before first stage entry.
   */
  offseasonStageEnteredDate: string | null;
  /**
   * Optional absolute end date when the user extends free agency past durationDays.
   * Null when not extended / not in free agency.
   * Note: durationDays is cosmetic — phase determines FA availability.
   */
  freeAgencyExtendedUntil: string | null;
};

export function isSeasonPhase(value: unknown): value is SeasonPhase {
  return (
    typeof value === "string" &&
    (SEASON_PHASES as readonly string[]).includes(value)
  );
}

export function isOffseasonStage(value: unknown): value is OffseasonStage {
  return (
    typeof value === "string" &&
    (OFFSEASON_STAGES as readonly string[]).includes(value)
  );
}

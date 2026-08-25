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
  | "free_agency"
  | "draft"
  | "league_initialization";

export const OFFSEASON_STAGES: readonly OffseasonStage[] = [
  "none",
  "season_finalization",
  "contract_expiration",
  "free_agency",
  "draft",
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
   * Calendar date when the current offseasonStage was entered (YYYY-MM-DD).
   * Null when offseasonStage is "none" or before first stage entry.
   */
  offseasonStageEnteredDate: string | null;
  /**
   * Optional absolute end date when the user extends free agency past durationDays.
   * Null when not extended / not in free agency.
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

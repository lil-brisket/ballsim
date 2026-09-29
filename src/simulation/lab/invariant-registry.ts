import type { InvariantSeverity, LabScope } from "@/simulation/lab/types";

export type InvariantRegistryEntry = {
  severity: InvariantSeverity;
  scope: LabScope;
};

export const HARD_GAME_RULE_IDS = [
  "FGM_LE_FGA",
  "3PM_LE_3PA",
  "FTM_LE_FTA",
  "3PM_LE_FGM",
  "3PA_LE_FGA",
  "TWO_POINT_FGM_NONNEG",
  "REB_SUM",
  "POINTS_IDENTITY",
  "NON_NEGATIVE",
  "PLAYER_SUM_EQ_TEAM",
  "POINTS_EQ_SCORE",
  "FG_PCT",
  "3PT_PCT",
  "FT_PCT",
  "POSSESSIONS_POSITIVE",
  "PERIOD_SCORES_SUM",
  "NO_TIE",
  "STATUS_FINAL",
  "SCORE_NONNEG",
  "DUPLICATE_PLAYER",
  "PLAYER_TEAM_MATCHUP",
  "CLOCK_NEGATIVE",
  "FOUL_LIMIT",
  "ROSTER_SIZE",
] as const;

export const ROTATION_HARD_RULE_IDS = [
  "NEGATIVE_SECONDS",
  "TEAM_SECONDS_MISMATCH",
] as const;

export const INVARIANT_REGISTRY: Record<string, InvariantRegistryEntry> = {
  FGM_LE_FGA: { severity: "HARD_FAILURE", scope: "game" },
  "3PM_LE_3PA": { severity: "HARD_FAILURE", scope: "game" },
  FTM_LE_FTA: { severity: "HARD_FAILURE", scope: "game" },
  "3PM_LE_FGM": { severity: "HARD_FAILURE", scope: "game" },
  "3PA_LE_FGA": { severity: "HARD_FAILURE", scope: "game" },
  TWO_POINT_FGM_NONNEG: { severity: "HARD_FAILURE", scope: "game" },
  REB_SUM: { severity: "HARD_FAILURE", scope: "game" },
  POINTS_IDENTITY: { severity: "HARD_FAILURE", scope: "game" },
  NON_NEGATIVE: { severity: "HARD_FAILURE", scope: "game" },
  PLAYER_SUM_EQ_TEAM: { severity: "HARD_FAILURE", scope: "game" },
  POINTS_EQ_SCORE: { severity: "HARD_FAILURE", scope: "game" },
  FG_PCT: { severity: "HARD_FAILURE", scope: "game" },
  "3PT_PCT": { severity: "HARD_FAILURE", scope: "game" },
  FT_PCT: { severity: "HARD_FAILURE", scope: "game" },
  POSSESSIONS_POSITIVE: { severity: "HARD_FAILURE", scope: "game" },
  PERIOD_SCORES_SUM: { severity: "HARD_FAILURE", scope: "game" },
  NO_TIE: { severity: "HARD_FAILURE", scope: "game" },
  STATUS_FINAL: { severity: "HARD_FAILURE", scope: "game" },
  SCORE_NONNEG: { severity: "HARD_FAILURE", scope: "game" },
  DUPLICATE_PLAYER: { severity: "HARD_FAILURE", scope: "game" },
  PLAYER_TEAM_MATCHUP: { severity: "HARD_FAILURE", scope: "game" },
  CLOCK_NEGATIVE: { severity: "HARD_FAILURE", scope: "game" },
  FOUL_LIMIT: { severity: "HARD_FAILURE", scope: "game" },
  ROSTER_SIZE: { severity: "HARD_FAILURE", scope: "game" },
  NEGATIVE_SECONDS: { severity: "HARD_FAILURE", scope: "game" },
  TEAM_SECONDS_MISMATCH: { severity: "HARD_FAILURE", scope: "game" },
  LAB_OT_PERIODS_HIGH: { severity: "WARNING", scope: "game" },
  invalid_current_date: { severity: "HARD_FAILURE", scope: "season" },
  last_simulated_after_current: { severity: "HARD_FAILURE", scope: "season" },
  orphan_player_team: { severity: "HARD_FAILURE", scope: "league" },
  missing_roster_player: { severity: "HARD_FAILURE", scope: "league" },
  player_team_mismatch: { severity: "HARD_FAILURE", scope: "league" },
  rotation_stale_player: { severity: "HARD_FAILURE", scope: "team" },
  final_game_missing_score: { severity: "HARD_FAILURE", scope: "game" },
  phase_date_mismatch: { severity: "WARNING", scope: "season" },
  missing_standings_row: { severity: "WARNING", scope: "season" },
  PHASE_MISMATCH: { severity: "HARD_FAILURE", scope: "season" },
  DUPLICATE_PICK_ID: { severity: "HARD_FAILURE", scope: "league" },
  DRAFT_ORDER_SIZE: { severity: "HARD_FAILURE", scope: "league" },
  RFA_STILL_ROSTERED: { severity: "HARD_FAILURE", scope: "league" },
  RETIRED_ON_ROSTER: { severity: "HARD_FAILURE", scope: "league" },
};

export function lookupInvariant(rule: string): InvariantRegistryEntry {
  return (
    INVARIANT_REGISTRY[rule] ?? {
      severity: "HARD_FAILURE",
      scope: "game",
    }
  );
}

/**
 * Historical milestone query results — interpretation of FranchiseHistory facts.
 */

export type MilestoneStatus = "achieved" | "approaching" | "projected";

export type MilestoneKind =
  | "first_championship"
  | "first_playoff"
  | "first_50_win_season"
  | "first_three_year_playoff_streak"
  | "first_sellout_season"
  | "first_positive_operating_income"
  | "first_back_to_back_championship"
  | "first_playoff_after_relocation"
  | "first_championship_after_relocation"
  | "first_2b_valuation"
  | "franchise_record_wins"
  | "franchise_record_attendance"
  | "franchise_record_franchise_value"
  | "playoff_streak"
  | "championship_drought"
  | "repeat_championship";

export type MilestoneResult = {
  kind: MilestoneKind;
  status: MilestoneStatus;
  message: string;
  currentValue: number;
  thresholdValue: number | null;
  margin: number;
  seasonYear: number | null;
};

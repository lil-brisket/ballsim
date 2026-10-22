import type { TeamId } from "@/domain/ids";

/** One team's luxury-tax and salary-floor result for a season. */
export type PayrollAssessment = {
  teamId: TeamId;
  seasonYear: number;
  /** Payroll assessed (contracts and dead money). */
  payroll: number;
  /** Tax line, or null when the tax was off. */
  threshold: number | null;
  /** Salary floor, or null when the floor was off. */
  floor: number | null;
  taxBill: number;
  floorShortfall: number;
  /** This team's share of the league's tax proceeds. */
  taxShare: number;
};

/** Assessments by season year, then team id (schema v74+). */
export type PayrollAssessmentState = Record<
  string,
  Record<string, PayrollAssessment>
>;

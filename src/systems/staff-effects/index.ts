import type { Staff } from "@/domain/entities/staff";
import {
  STAFF_BASE_SALARY_BY_ROLE,
  STAFF_SALARY_QUALITY_CENTER,
  STAFF_SALARY_QUALITY_PCT_PER_POINT,
} from "@/systems/staff-config";

export { findTeamStaffByRole } from "@/systems/staff-effects/find";
export { gmTradeAcceptanceThreshold } from "@/systems/staff-effects/gm-effects";
export { scoutNoiseScale } from "@/systems/staff-effects/scout-effects";
export {
  trainerDevelopmentMultiplier,
  combinedStaffDevelopmentMultiplier,
} from "@/systems/staff-effects/development-effects";
export {
  headCoachSimModifiers,
  buildTeamStaffGameContext,
  type HeadCoachSimModifiers,
  type TeamStaffGameContext,
} from "@/systems/staff-effects/coach-effects";
export {
  financeRevenueEfficiencyMultiplier,
  financeOpexEfficiencyMultiplier,
} from "@/systems/staff-effects/finance-effects";
export {
  medicalPreventionMultiplier,
  medicalRecoveryMultiplier,
  medicalEffectivenessScore,
} from "@/systems/staff-effects/medical-effects";
export {
  prReputationModifier,
  prMarketabilityMultiplier,
} from "@/systems/staff-effects/pr-effects";

export function annualSalaryForStaff(staff: Staff): number {
  const base = STAFF_BASE_SALARY_BY_ROLE[staff.role] ?? 500_000;
  const mult =
    1 +
    (staff.overall - STAFF_SALARY_QUALITY_CENTER) *
      STAFF_SALARY_QUALITY_PCT_PER_POINT;
  return Math.max(0, Math.round(base * Math.max(0.4, mult)));
}

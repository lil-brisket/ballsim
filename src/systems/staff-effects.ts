import type { Staff, StaffRole } from "@/domain/entities/staff";
import type { GameState } from "@/state/game-state";
import type { TeamId } from "@/domain/ids";
import {
  GM_TRADE_THRESHOLD_PER_QUALITY_POINT,
  HEAD_COACH_EFFICIENCY_PER_QUALITY_POINT,
  HEAD_COACH_TEMPO_PER_QUALITY_POINT,
  SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT,
  SCOUT_NOISE_SCALE_MAX,
  SCOUT_NOISE_SCALE_MIN,
  STAFF_BASE_SALARY_BY_ROLE,
  STAFF_SALARY_QUALITY_CENTER,
  STAFF_SALARY_QUALITY_PCT_PER_POINT,
  TRAINER_DEV_MULT_MAX,
  TRAINER_DEV_MULT_MIN,
  TRAINER_DEV_PER_QUALITY_POINT,
} from "@/systems/staff-config";

export function findTeamStaffByRole(
  state: GameState,
  teamId: TeamId,
  role: StaffRole,
): Staff | null {
  const team = state.world.teams[teamId];
  if (!team) {
    return null;
  }
  for (const staffId of team.staff) {
    const staff = state.world.staff[staffId];
    if (staff && staff.teamId === teamId && staff.role === role) {
      return staff;
    }
  }
  return null;
}

export function annualSalaryForStaff(staff: Staff): number {
  const base = STAFF_BASE_SALARY_BY_ROLE[staff.role] ?? 500_000;
  const mult =
    1 +
    (staff.quality - STAFF_SALARY_QUALITY_CENTER) *
      STAFF_SALARY_QUALITY_PCT_PER_POINT;
  return Math.max(0, Math.round(base * Math.max(0.4, mult)));
}

/** Net-value threshold for trade acceptance. Default 0; better GM lowers it. */
export function gmTradeAcceptanceThreshold(state: GameState, teamId: TeamId): number {
  const gm = findTeamStaffByRole(state, teamId, "general_manager");
  if (!gm) {
    return 0;
  }
  return (
    -(gm.quality - 50) * GM_TRADE_THRESHOLD_PER_QUALITY_POINT
  );
}

/** Scale draft scouting noise (1 = default). Better scout → lower noise. */
export function scoutNoiseScale(state: GameState, teamId: TeamId): number {
  const scout = findTeamStaffByRole(state, teamId, "scout");
  if (!scout) {
    return 1;
  }
  const scale =
    1 - (scout.quality - 50) * SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT;
  return Math.min(
    SCOUT_NOISE_SCALE_MAX,
    Math.max(SCOUT_NOISE_SCALE_MIN, scale),
  );
}

/** Development magnitude multiplier. Better trainer → higher mult. */
export function trainerDevelopmentMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const trainer = findTeamStaffByRole(state, teamId, "trainer");
  if (!trainer) {
    return 1;
  }
  const mult =
    1 + (trainer.quality - 50) * TRAINER_DEV_PER_QUALITY_POINT;
  return Math.min(
    TRAINER_DEV_MULT_MAX,
    Math.max(TRAINER_DEV_MULT_MIN, mult),
  );
}

export type HeadCoachSimModifiers = {
  tempoBonus: number;
  efficiencyBonus: number;
};

/** Light additive modifiers on top of coachingPhilosophy. */
export function headCoachSimModifiers(
  state: GameState,
  teamId: TeamId,
): HeadCoachSimModifiers {
  const coach = findTeamStaffByRole(state, teamId, "head_coach");
  if (!coach) {
    return { tempoBonus: 0, efficiencyBonus: 0 };
  }
  const delta = coach.quality - 50;
  return {
    tempoBonus: delta * HEAD_COACH_TEMPO_PER_QUALITY_POINT,
    efficiencyBonus: delta * HEAD_COACH_EFFICIENCY_PER_QUALITY_POINT,
  };
}

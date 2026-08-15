import { FIRST_NAMES } from "@/data/names/first-names";
import { LAST_NAMES } from "@/data/names/last-names";
import { createCoach } from "@/domain/entities/coach";
import {
  createStaff,
  STAFF_ROLES,
  type Staff,
  type StaffRole,
  type StaffStrength,
  type StaffWeakness,
  STAFF_STRENGTHS,
  STAFF_WEAKNESSES,
} from "@/domain/entities/staff";
import { createStaffContract } from "@/domain/entities/staff-contract";
import {
  asCoachId,
  asStaffContractId,
  asStaffId,
  type StaffId,
  type TeamId,
} from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { annualSalaryForStaff } from "@/systems/staff-effects";
import { STAFF_DEFAULT_CONTRACT_YEARS } from "@/systems/staff-config";

const STARTER_ROLES: readonly StaffRole[] = [
  "general_manager",
  "head_coach",
  "scout",
  "trainer",
  "assistant_coach",
  "finance",
  "marketing",
];

const UNEMPLOYED_PER_ROLE = 2;

function pickTraits(rng: Rng): {
  strengths: StaffStrength[];
  weaknesses: StaffWeakness[];
} {
  const strengths: StaffStrength[] = [];
  const weaknesses: StaffWeakness[] = [];
  if (rng.chance(0.7)) {
    strengths.push(rng.pick(STAFF_STRENGTHS));
  }
  if (rng.chance(0.5)) {
    const second = rng.pick(STAFF_STRENGTHS);
    if (!strengths.includes(second)) {
      strengths.push(second);
    }
  }
  if (rng.chance(0.55)) {
    weaknesses.push(rng.pick(STAFF_WEAKNESSES));
  }
  return { strengths, weaknesses };
}

function createStaffMember(
  rng: Rng,
  role: StaffRole,
  teamId: TeamId | null,
  index: number,
): Staff {
  const id = asStaffId(
    `staff_${role}_${teamId ?? "fa"}_${index}_${rng.nextInt(0, 1_000_000)}`,
  );
  const { strengths, weaknesses } = pickTraits(rng);
  return createStaff({
    id,
    teamId,
    firstName: rng.pick(FIRST_NAMES),
    lastName: rng.pick(LAST_NAMES),
    role,
    quality: rng.nextInt(35, 75),
    experience: rng.nextInt(0, 25),
    strengths,
    weaknesses,
  });
}

/**
 * Seeds starter staff + contracts for every team and an unemployed pool.
 * Idempotent if staff already exist.
 */
export function generateLeagueStaff(state: GameState, rng: Rng): GameState {
  if (Object.keys(state.world.staff).length > 0) {
    return state;
  }

  const year = state.competition.season.year;
  const staff: Record<string, Staff> = {};
  const staffContracts = { ...state.business.staffContracts };
  const teams = { ...state.world.teams };
  let coaches = { ...state.world.coaches };

  const teamIds = Object.keys(teams).sort() as TeamId[];
  let index = 0;

  for (const teamId of teamIds) {
    const team = teams[teamId]!;
    const staffIds: StaffId[] = [];
    for (const role of STARTER_ROLES) {
      const member = createStaffMember(rng, role, teamId, index);
      index += 1;
      staff[member.id] = member;
      staffIds.push(member.id);

      const annual = annualSalaryForStaff(member);
      const salaryByYear: Record<string, number> = {};
      for (let y = 0; y < STAFF_DEFAULT_CONTRACT_YEARS; y += 1) {
        salaryByYear[String(year + y)] = annual;
      }
      const contractId = asStaffContractId(`scontract_${member.id}`);
      staffContracts[contractId] = createStaffContract({
        id: contractId,
        staffId: member.id,
        teamId,
        startYear: year,
        endYear: year + STAFF_DEFAULT_CONTRACT_YEARS - 1,
        salaryByYear,
      });

      if (role === "head_coach") {
        const coachId = asCoachId(`coach_${member.id}`);
        coaches = {
          ...coaches,
          [coachId]: createCoach({
            id: coachId,
            teamId,
            firstName: member.firstName,
            lastName: member.lastName,
          }),
        };
      }
    }
    teams[teamId] = { ...team, staff: staffIds };
  }

  for (const role of STAFF_ROLES) {
    for (let i = 0; i < UNEMPLOYED_PER_ROLE; i += 1) {
      const member = createStaffMember(rng, role, null, index);
      index += 1;
      staff[member.id] = member;
    }
  }

  return {
    ...state,
    world: {
      ...state.world,
      staff,
      coaches,
      teams,
    },
    business: {
      ...state.business,
      staffContracts,
    },
  };
}

/**
 * Seeds starter staff + contracts for one team (expansion / late join).
 */
export function generateLeagueStaffForTeam(
  state: GameState,
  rng: Rng,
  teamId: TeamId,
): SystemResult {
  const team = state.world.teams[teamId];
  if (!team) {
    throw new Error(`generateLeagueStaffForTeam: team "${teamId}" not found.`);
  }
  if (team.staff.length > 0) {
    return systemResult(state);
  }

  const year = state.competition.season.year;
  const staff = { ...state.world.staff };
  const staffContracts = { ...state.business.staffContracts };
  let coaches = { ...state.world.coaches };
  const staffIds: StaffId[] = [];
  let index = Object.keys(staff).length;

  for (const role of STARTER_ROLES) {
    const member = createStaffMember(rng, role, teamId, index);
    index += 1;
    staff[member.id] = member;
    staffIds.push(member.id);

    const annual = annualSalaryForStaff(member);
    const salaryByYear: Record<string, number> = {};
    for (let y = 0; y < STAFF_DEFAULT_CONTRACT_YEARS; y += 1) {
      salaryByYear[String(year + y)] = annual;
    }
    const contractId = asStaffContractId(`scontract_${member.id}`);
    staffContracts[contractId] = createStaffContract({
      id: contractId,
      staffId: member.id,
      teamId,
      startYear: year,
      endYear: year + STAFF_DEFAULT_CONTRACT_YEARS - 1,
      salaryByYear,
    });

    if (role === "head_coach") {
      const coachId = asCoachId(`coach_${member.id}`);
      coaches = {
        ...coaches,
        [coachId]: createCoach({
          id: coachId,
          teamId,
          firstName: member.firstName,
          lastName: member.lastName,
        }),
      };
    }
  }

  return systemResult({
    ...state,
    world: {
      ...state.world,
      staff,
      coaches,
      teams: {
        ...state.world.teams,
        [teamId]: { ...team, staff: staffIds },
      },
    },
    business: {
      ...state.business,
      staffContracts,
    },
  });
}

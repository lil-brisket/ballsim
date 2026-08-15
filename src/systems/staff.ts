import { createCoach } from "@/domain/entities/coach";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import {
  asCoachId,
  asStaffContractId,
  type StaffId,
  type TeamId,
} from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { Staff } from "@/domain/entities/staff";
import { createStaffContract } from "@/domain/entities/staff-contract";
import type { GameState } from "@/state/game-state";
import {
  STAFF_BUYOUT_FRACTION,
  STAFF_DEFAULT_CONTRACT_YEARS,
  STAFF_PAYROLL_WEEKS_PER_YEAR,
} from "@/systems/staff-config";
import {
  annualSalaryForStaff,
  findTeamStaffByRole,
} from "@/systems/staff-effects";
import { applyCashAndBooksImpact } from "@/systems/team-finances";
import {
  getStaffContractSalaryForYear,
  isStaffContractActive,
} from "@/domain/entities/staff-contract";

function salaryByYearFor(
  startYear: number,
  years: number,
  annual: number,
): Record<string, number> {
  const salaryByYear: Record<string, number> = {};
  for (let i = 0; i < years; i += 1) {
    salaryByYear[String(startYear + i)] = annual;
  }
  return salaryByYear;
}

/**
 * Hire an unemployed staff member onto a team with a new staff contract.
 * Head coach also syncs world.coaches (separate CoachId space).
 */
export function hireStaff(
  state: GameState,
  teamId: TeamId,
  staffId: StaffId,
  options: { years?: number; annualSalary?: number } = {},
): SystemResult {
  const team = state.world.teams[teamId];
  if (!team) {
    throw new Error(`hireStaff: team "${teamId}" not found.`);
  }
  const staff = state.world.staff[staffId];
  if (!staff) {
    throw new Error(`hireStaff: staff "${staffId}" not found.`);
  }
  if (staff.teamId !== null) {
    throw new Error(`hireStaff: staff "${staffId}" is already employed.`);
  }
  const existing = findTeamStaffByRole(state, teamId, staff.role);
  if (existing) {
    throw new Error(
      `hireStaff: team already has a ${staff.role}. Fire them first.`,
    );
  }

  const year = state.competition.season.year;
  const years = options.years ?? STAFF_DEFAULT_CONTRACT_YEARS;
  const annual = options.annualSalary ?? annualSalaryForStaff(staff);
  const contractId = asStaffContractId(`scontract_${staffId}_${year}`);
  const contract = createStaffContract({
    id: contractId,
    staffId,
    teamId,
    startYear: year,
    endYear: year + years - 1,
    salaryByYear: salaryByYearFor(year, years, annual),
  });

  const nextStaff: Staff = { ...staff, teamId };
  let coaches = state.world.coaches;
  const events: DomainEvent[] = [
    createDomainEvent({
      type: "StaffHired",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        teamId,
        staffId,
        role: staff.role,
        contractId,
      },
    }),
  ];

  if (staff.role === "head_coach") {
    const coachId = asCoachId(`coach_${staffId}`);
    coaches = {
      ...coaches,
      [coachId]: createCoach({
        id: coachId,
        teamId,
        firstName: staff.firstName,
        lastName: staff.lastName,
      }),
    };
    events.push(
      createDomainEvent({
        type: "CoachHired",
        occurredOn: state.world.calendar.currentDate,
        payload: { teamId, coachId, staffId },
      }),
    );
  }

  return systemResult(
    {
      ...state,
      world: {
        ...state.world,
        staff: { ...state.world.staff, [staffId]: nextStaff },
        coaches,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            staff: [...team.staff, staffId],
          },
        },
      },
      business: {
        ...state.business,
        staffContracts: {
          ...state.business.staffContracts,
          [contractId]: contract,
        },
      },
    },
    events,
  );
}

/**
 * Fire/release staff. Pays buyout of remaining current-year salary via expenses.staff.
 * Head coach clears matching world.coaches entry.
 */
export function fireStaff(
  state: GameState,
  teamId: TeamId,
  staffId: StaffId,
): SystemResult {
  const team = state.world.teams[teamId];
  if (!team) {
    throw new Error(`fireStaff: team "${teamId}" not found.`);
  }
  const staff = state.world.staff[staffId];
  if (!staff || staff.teamId !== teamId) {
    throw new Error(`fireStaff: staff "${staffId}" not on team.`);
  }
  if (!team.staff.includes(staffId)) {
    throw new Error(`fireStaff: staff "${staffId}" missing from team.staff.`);
  }

  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  const activeContract = Object.values(current.business.staffContracts).find(
    (c) =>
      c.staffId === staffId &&
      c.teamId === teamId &&
      isStaffContractActive(c, year),
  );
  if (activeContract) {
    const salary = getStaffContractSalaryForYear(activeContract, year) ?? 0;
    const buyout = Math.round(salary * STAFF_BUYOUT_FRACTION);
    if (buyout > 0) {
      const impact = applyCashAndBooksImpact(
        current,
        teamId,
        -buyout,
        year,
        { expenseCategory: "staff" },
      );
      current = impact.state;
      events.push(...impact.events);
    }
    const { [activeContract.id]: _removed, ...rest } =
      current.business.staffContracts;
    current = {
      ...current,
      business: {
        ...current.business,
        staffContracts: rest,
      },
    };
  }

  let coaches = current.world.coaches;
  if (staff.role === "head_coach") {
    const nextCoaches = { ...coaches };
    for (const [coachId, coach] of Object.entries(nextCoaches)) {
      if (
        coach.teamId === teamId &&
        coach.firstName === staff.firstName &&
        coach.lastName === staff.lastName
      ) {
        nextCoaches[coachId] = { ...coach, teamId: null };
      }
    }
    coaches = nextCoaches;
  }

  events.push(
    createDomainEvent({
      type: "StaffFired",
      occurredOn: current.world.calendar.currentDate,
      payload: { teamId, staffId, role: staff.role },
    }),
  );

  return systemResult(
    {
      ...current,
      world: {
        ...current.world,
        coaches,
        staff: {
          ...current.world.staff,
          [staffId]: { ...staff, teamId: null },
        },
        teams: {
          ...current.world.teams,
          [teamId]: {
            ...team,
            staff: team.staff.filter((id) => id !== staffId),
          },
        },
      },
    },
    events,
  );
}

/**
 * Weekly staff payroll burn for all teams. Posts expenses.staff.
 * Remainder of annual salary is paid in the last week window via floor division.
 */
export function processWeeklyStaffPayroll(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  const teamIds = Object.keys(current.world.teams).sort();
  for (const teamId of teamIds) {
    let weeklyTotal = 0;
    for (const contract of Object.values(current.business.staffContracts)) {
      if (contract.teamId !== teamId || !isStaffContractActive(contract, year)) {
        continue;
      }
      const annual = getStaffContractSalaryForYear(contract, year) ?? 0;
      weeklyTotal += Math.floor(annual / STAFF_PAYROLL_WEEKS_PER_YEAR);
    }
    if (weeklyTotal <= 0) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId as TeamId,
      -weeklyTotal,
      year,
      { expenseCategory: "staff" },
    );
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
}

import {
  createStaffContract,
  isStaffContractActive,
  type StaffContract,
} from "@/domain/entities/staff-contract";
import { appendCareerEntry } from "@/domain/entities/staff-development";
import { createStaff, type Staff } from "@/domain/entities/staff";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import {
  asStaffContractId,
  type StaffId,
  type TeamId,
} from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { STAFF_BUYOUT_FRACTION } from "@/systems/staff-config";
import { fireStaff } from "@/systems/staff";
import { isOpenStaffOffer } from "@/domain/entities/staff-offer";

function remainingGuaranteedSalary(
  contract: StaffContract,
  currentYear: number,
): number {
  let total = 0;
  for (let y = currentYear; y <= contract.endYear; y += 1) {
    total += contract.salaryByYear[String(y)] ?? 0;
  }
  return total;
}

export function calculateStaffBuyout(
  state: GameState,
  teamId: TeamId,
  staffId: StaffId,
): number {
  const year = state.competition.season.year;
  const contract = Object.values(state.business.staffContracts).find(
    (c) =>
      c.staffId === staffId &&
      c.teamId === teamId &&
      isStaffContractActive(c, year),
  );
  if (!contract) {
    return 0;
  }
  return Math.round(
    remainingGuaranteedSalary(contract, year) * STAFF_BUYOUT_FRACTION,
  );
}

/**
 * Fire with buyout. Blocks if buyout would drive businessFunds negative.
 * Buyout is a basketball-ops staff termination expense (not Finance Director effect).
 */
export function fireStaffWithBuyout(
  state: GameState,
  teamId: TeamId,
  staffId: StaffId,
): SystemResult {
  const buyout = calculateStaffBuyout(state, teamId, staffId);
  const finances = state.business.finances[teamId];
  if (finances && buyout > 0 && finances.businessFunds < buyout) {
    throw new Error(
      `Cannot fire staff: buyout $${buyout.toLocaleString()} exceeds available funds $${finances.businessFunds.toLocaleString()}.`,
    );
  }

  let current = state;
  const events: DomainEvent[] = [];

  if (buyout > 0 && finances) {
    current = {
      ...current,
      business: {
        ...current.business,
        finances: {
          ...current.business.finances,
          [teamId]: {
            ...finances,
            businessFunds: finances.businessFunds - buyout,
          },
        },
      },
    };
  }

  const fired = fireStaff(current, teamId, staffId);
  current = fired.state;
  events.push(...fired.events);

  const staff = current.world.staff[staffId];
  if (staff) {
    const year = current.competition.season.year;
    current = {
      ...current,
      world: {
        ...current.world,
        staff: {
          ...current.world.staff,
          [staffId]: createStaff({
            ...staff,
            careerHistory: appendCareerEntry(staff.careerHistory, {
              seasonYear: year,
              teamId,
              role: staff.role,
              overall: staff.overall,
              kind: "fired",
            }),
            development: {
              ...staff.development,
              timeInRole: 0,
            },
          }),
        },
      },
    };
  }

  current = invalidateStaffOffers(current, staffId);
  return systemResult(appendSeasonEventLog(current, events), events);
}

function staffHasBindingContract(
  state: GameState,
  staffId: StaffId,
  teamId: TeamId,
  year: number,
  offseason: boolean,
): boolean {
  const contracts = Object.values(state.business.staffContracts).filter(
    (c) => c.staffId === staffId && c.teamId === teamId,
  );
  if (contracts.length === 0) {
    return false;
  }
  if (offseason) {
    // Contract ending this season year is finished in offseason
    return contracts.some((c) => year < c.endYear);
  }
  return contracts.some((c) => isStaffContractActive(c, year));
}

/**
 * Release staff whose contracts have expired into unemployment.
 */
export function releaseExpiredStaffContracts(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const offseason = state.competition.season.phase === "offseason";
  let current = state;
  const events: DomainEvent[] = [];

  const staffIds = Object.keys(current.world.staff).sort();
  for (const staffIdKey of staffIds) {
    const staff = current.world.staff[staffIdKey]!;
    if (staff.teamId === null) continue;
    const teamId = staff.teamId;

    if (staffHasBindingContract(current, staff.id, teamId, year, offseason)) {
      continue;
    }

    // Only release if they had a contract that just expired (or no contract while employed)
    const hadContract = Object.values(current.business.staffContracts).some(
      (c) => c.staffId === staff.id && c.teamId === teamId,
    );
    if (!hadContract) {
      // Employed without contract — treat as unbound, release
    }

    const team = current.world.teams[teamId];
    if (!team) continue;

    const releasedStaff: Staff = createStaff({
      ...staff,
      teamId: null,
      careerHistory: appendCareerEntry(staff.careerHistory, {
        seasonYear: year,
        teamId,
        role: staff.role,
        overall: staff.overall,
        kind: "moved",
        note: "Contract expired",
      }),
      development: { ...staff.development, timeInRole: 0 },
    });

    const nextContracts = { ...current.business.staffContracts };
    for (const [cid, c] of Object.entries(nextContracts)) {
      if (
        c.staffId === staff.id &&
        c.teamId === teamId &&
        year >= c.endYear
      ) {
        delete nextContracts[cid];
      }
    }

    events.push(
      createDomainEvent({
        type: "StaffContractExpired",
        occurredOn: current.world.calendar.currentDate,
        payload: { teamId, staffId: staff.id, role: staff.role },
      }),
    );

    current = {
      ...current,
      world: {
        ...current.world,
        staff: {
          ...current.world.staff,
          [staff.id]: releasedStaff,
        },
        teams: {
          ...current.world.teams,
          [teamId]: {
            ...team,
            staff: team.staff.filter((id) => id !== staff.id),
          },
        },
      },
      business: {
        ...current.business,
        staffContracts: nextContracts,
      },
    };
  }

  return systemResult(appendSeasonEventLog(current, events), events);
}

export function renewStaffContract(
  state: GameState,
  teamId: TeamId,
  staffId: StaffId,
  options: { years: number; annualSalary: number },
): SystemResult {
  const staff = state.world.staff[staffId];
  if (!staff || staff.teamId !== teamId) {
    throw new Error(`renewStaffContract: staff not on team.`);
  }
  const year = state.competition.season.year;
  const years = options.years;
  const annual = options.annualSalary;

  const nextContracts = { ...state.business.staffContracts };
  for (const [cid, c] of Object.entries(nextContracts)) {
    if (c.staffId === staffId && c.teamId === teamId) {
      delete nextContracts[cid];
    }
  }

  const salaryByYear: Record<string, number> = {};
  for (let i = 0; i < years; i += 1) {
    salaryByYear[String(year + i)] = annual;
  }
  const contractId = asStaffContractId(`scontract_${staffId}_${year}_renew`);
  nextContracts[contractId] = createStaffContract({
    id: contractId,
    staffId,
    teamId,
    startYear: year,
    endYear: year + years - 1,
    salaryByYear,
  });

  return systemResult({
    ...state,
    business: {
      ...state.business,
      staffContracts: nextContracts,
    },
  });
}

/** Invalidate open staff market offers for a staff member. */
export function invalidateStaffOffers(
  state: GameState,
  staffId: StaffId,
): GameState {
  const offers = { ...state.world.staffMarket.offers };
  let changed = false;
  for (const [id, offer] of Object.entries(offers)) {
    if (offer.staffId === staffId && isOpenStaffOffer(offer.status)) {
      offers[id] = {
        ...offer,
        status: "withdrawn",
        updatedOn: state.world.calendar.currentDate,
      };
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    world: {
      ...state.world,
      staffMarket: { offers },
    },
  };
}

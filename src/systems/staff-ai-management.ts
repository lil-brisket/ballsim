import type { Staff, StaffRole } from "@/domain/entities/staff";
import { STARTER_STAFF_ROLES } from "@/domain/entities/staff-roles";
import { isStaffContractActive } from "@/domain/entities/staff-contract";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { findTeamStaffByRole, annualSalaryForStaff } from "@/systems/staff-effects";
import { acceptStaffOffer, makeStaffOffer, negotiateStaffOffer } from "@/systems/staff-free-agency";
import { renewStaffContract, fireStaffWithBuyout } from "@/systems/staff-contract-lifecycle";
import { getTeamStaffBudgetSpace } from "@/systems/staff-budget";
import { STAFF_DEFAULT_CONTRACT_YEARS } from "@/systems/staff-config";
import { asStaffOfferId } from "@/domain/ids";

/** Minimum overall gap required before AI replaces an incumbent. */
export const AI_STAFF_REPLACE_OVERALL_GAP = 8;

/** Roles AI will not fire/replace unless vacant or critical gap. */
const STABILITY_PRIORITY_ROLES: readonly StaffRole[] = [
  "head_coach",
  "general_manager",
];

/**
 * Conservative AI staff management for one team.
 * Does not churn for marginal upgrades (e.g. 72 → 75).
 */
export function runTeamStaffAiManagement(
  state: GameState,
  teamId: TeamId,
  rng: Rng,
): SystemResult {
  let current = state;
  const events = [];

  // 1. Fill vacancies
  for (const role of STARTER_STAFF_ROLES) {
    const incumbent = findTeamStaffByRole(current, teamId, role);
    if (incumbent) continue;

    const hired = tryHireBestAvailable(current, teamId, role, rng);
    if (hired) {
      current = hired.state;
      events.push(...hired.events);
    }
  }

  // 2. Renew expiring contracts when staff is adequate
  const year = current.competition.season.year;
  for (const role of STARTER_STAFF_ROLES) {
    const incumbent = findTeamStaffByRole(current, teamId, role);
    if (!incumbent) continue;
    const contract = Object.values(current.business.staffContracts).find(
      (c) =>
        c.staffId === incumbent.id &&
        c.teamId === teamId &&
        isStaffContractActive(c, year),
    );
    if (!contract) continue;
    if (contract.endYear !== year) continue;

    // Renew if overall is at least league-average-ish for role
    const leagueAvg = roleLeagueAverage(current, role);
    if (incumbent.overall >= leagueAvg - 5) {
      const salary = annualSalaryForStaff(incumbent);
      const space = getTeamStaffBudgetSpace(teamId, year, current);
      // Approximate: renewing replaces same salary commitment
      if (salary <= space + salary) {
        const renewed = renewStaffContract(current, teamId, incumbent.id, {
          years: STAFF_DEFAULT_CONTRACT_YEARS,
          annualSalary: salary,
        });
        current = renewed.state;
        events.push(...renewed.events);
      }
    }
  }

  // 3. Replace only for meaningful underperformance
  for (const role of STARTER_STAFF_ROLES) {
    const incumbent = findTeamStaffByRole(current, teamId, role);
    if (!incumbent) continue;
    const leagueAvg = roleLeagueAverage(current, role);
    const gap = leagueAvg - incumbent.overall;
    if (gap < AI_STAFF_REPLACE_OVERALL_GAP) continue;

    const bestFa = bestUnemployedForRole(current, role);
    if (!bestFa) continue;
    if (bestFa.overall - incumbent.overall < AI_STAFF_REPLACE_OVERALL_GAP) {
      continue;
    }

    // Prefer not to churn HC/GM unless gap is larger
    if (
      STABILITY_PRIORITY_ROLES.includes(role) &&
      bestFa.overall - incumbent.overall < AI_STAFF_REPLACE_OVERALL_GAP + 4
    ) {
      continue;
    }

    try {
      const fired = fireStaffWithBuyout(current, teamId, incumbent.id);
      current = fired.state;
      events.push(...fired.events);
      const hired = tryHireBestAvailable(current, teamId, role, rng);
      if (hired) {
        current = hired.state;
        events.push(...hired.events);
      }
    } catch {
      // Buyout unaffordable — skip
    }
  }

  return systemResult(current, events);
}

/**
 * Run staff AI for all non-user (CPU) teams.
 */
export function runLeagueStaffAiManagement(
  state: GameState,
  rng: Rng,
): SystemResult {
  let current = state;
  const events = [];
  const owned = new Set(state.user.ownedTeamIds);
  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];

  for (const teamId of teamIds) {
    if (owned.has(teamId)) continue;
    const result = runTeamStaffAiManagement(current, teamId, rng);
    current = result.state;
    events.push(...result.events);
  }

  return systemResult(current, events);
}

function roleLeagueAverage(state: GameState, role: StaffRole): number {
  const members = Object.values(state.world.staff).filter((s) => s.role === role);
  if (members.length === 0) return 50;
  const sum = members.reduce((acc, s) => acc + s.overall, 0);
  return Math.round(sum / members.length);
}

function bestUnemployedForRole(
  state: GameState,
  role: StaffRole,
): Staff | null {
  let best: Staff | null = null;
  for (const staff of Object.values(state.world.staff)) {
    if (staff.teamId !== null || staff.role !== role) continue;
    if (!best || staff.overall > best.overall) {
      best = staff;
    }
  }
  return best;
}

function tryHireBestAvailable(
  state: GameState,
  teamId: TeamId,
  role: StaffRole,
  _rng: Rng,
): SystemResult | null {
  const candidate = bestUnemployedForRole(state, role);
  if (!candidate) return null;

  const year = state.competition.season.year;
  const salary = Math.max(
    candidate.preferences.minimumSalary,
    Math.round(
      (candidate.preferences.desiredSalary +
        candidate.preferences.minimumSalary) /
        2,
    ),
  );
  const space = getTeamStaffBudgetSpace(teamId, year, state);
  if (salary > space) return null;

  try {
    const offerId = asStaffOfferId(
      `ai_staff_offer_${candidate.id}_${teamId}_${year}`,
    );
    let current = makeStaffOffer(state, {
      id: offerId,
      staffId: candidate.id,
      teamId,
      annualSalary: salary,
      years: STAFF_DEFAULT_CONTRACT_YEARS,
    }).state;
    current = negotiateStaffOffer(current, offerId).state;
    const offer = current.world.staffMarket.offers[offerId];
    if (!offer || offer.status === "rejected") {
      return null;
    }
    return acceptStaffOffer(current, offerId);
  } catch {
    return null;
  }
}

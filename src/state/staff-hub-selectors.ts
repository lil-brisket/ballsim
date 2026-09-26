/**
 * Staff Hub presentation — Staff Directory (not a player roster).
 * Composes toStaffView; does not recreate staff ratings or contracts.
 */

import type { GameState } from "@/state/game-state";
import type { ActionCenterItem } from "@/state/action-center-selectors";
import {
  buildActionCenterView,
  filterDomainDecisions,
} from "@/state/action-center-selectors";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toStaffView,
  type StaffMemberView,
} from "@/state/franchise-selectors";
import {
  STAFF_ROLE_DISPLAY,
  STAFF_ROLES,
  STARTER_STAFF_ROLES,
} from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";
import { isOpenStaffOffer } from "@/domain/entities/staff-offer";
import type { StaffId } from "@/domain/ids";
import {
  getLeagueStaffBudget,
  getTeamAmountOverStaffBudget,
  getTeamStaffBudgetSpace,
  getTeamStaffPayroll,
} from "@/systems/staff-budget";
import { STAFF_DEFAULT_CONTRACT_YEARS } from "@/systems/staff-config";
import { evaluateStaffInterest } from "@/systems/staff-interest";

export type StaffRoleGroup = {
  role: string;
  roleLabel: string;
  members: StaffMemberView[];
};

export type StaffVacantRoleEntry = {
  role: string;
  roleLabel: string;
};

export type StaffHubBudgetView = {
  payroll: number;
  remaining: number;
  total: number;
  percentageUsed: number;
  overBudget: boolean;
  amountOver: number;
};

export type StaffHubView = {
  saveId: string;
  teamId: string;
  teamName: string;
  currentDate: string;
  headCoach: StaffMemberView | null;
  staffCount: number;
  vacancyCount: number;
  vacantRoles: string[];
  vacantRoleEntries: StaffVacantRoleEntry[];
  directory: StaffRoleGroup[];
  available: StaffMemberView[];
  decisions: ActionCenterItem[];
  budget: StaffHubBudgetView;
};

export type StaffOfferView = {
  offerId: string;
  staffId: string;
  status: string;
  annualSalary: number;
  years: number;
};

export type StaffHiringMarketAgentView = StaffMemberView & {
  askingInterest: {
    level: string;
    interested: boolean;
  };
};

export type StaffHiringMarketView = {
  saveId: string;
  teamId: string;
  freeAgents: StaffHiringMarketAgentView[];
  roleFilters: string[];
  sortOptions: Array<"overall" | "potential" | "salary">;
  activeOffers: Record<string, StaffOfferView>;
};

/** Sort within a role: rating desc → name. */
function sortMembers(members: StaffMemberView[]): StaffMemberView[] {
  return [...members].sort((a, b) => {
    if (b.overall !== a.overall) return b.overall - a.overall;
    const an = `${a.lastName}${a.firstName}`;
    const bn = `${b.lastName}${b.firstName}`;
    return an.localeCompare(bn);
  });
}

function toStaffHubBudget(
  state: GameState,
  teamId: ReturnType<typeof getActiveOwnerTeamId>,
): StaffHubBudgetView {
  const year = state.competition.season.year;
  const payroll = getTeamStaffPayroll(teamId, year, state);
  const total = getLeagueStaffBudget(state);
  const remaining = getTeamStaffBudgetSpace(teamId, year, state, total);
  const amountOver = getTeamAmountOverStaffBudget(teamId, year, state, total);
  return {
    payroll,
    remaining,
    total,
    percentageUsed: total <= 0 ? 0 : Math.round((payroll / total) * 100),
    overBudget: amountOver > 0,
    amountOver,
  };
}

export function toStaffHubView(state: GameState): StaffHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const staff = toStaffView(state);
  const owner = toOwnerDashboardView(state);

  const byRole = new Map<string, StaffMemberView[]>();
  for (const member of staff.roster) {
    const list = byRole.get(member.role) ?? [];
    list.push(member);
    byRole.set(member.role, list);
  }

  const roleOrder = Object.keys(STAFF_ROLE_DISPLAY);
  const directory: StaffRoleGroup[] = [];
  for (const role of roleOrder) {
    const members = byRole.get(role);
    if (!members || members.length === 0) continue;
    directory.push({
      role,
      roleLabel: STAFF_ROLE_DISPLAY[role as StaffRole] ?? role,
      members: sortMembers(members),
    });
  }
  for (const [role, members] of byRole) {
    if (roleOrder.includes(role)) continue;
    directory.push({
      role,
      roleLabel: role.replaceAll("_", " "),
      members: sortMembers(members),
    });
  }

  const filledRoles = new Set(staff.roster.map((m) => m.role));
  const vacantStarterRoles = STARTER_STAFF_ROLES.filter(
    (r) => !filledRoles.has(r),
  );
  const vacantRoleEntries: StaffVacantRoleEntry[] = vacantStarterRoles.map(
    (r) => ({
      role: r,
      roleLabel: STAFF_ROLE_DISPLAY[r] ?? r,
    }),
  );
  const headCoach =
    staff.roster.find((m) => m.role === "head_coach") ?? null;

  const actionCenter = buildActionCenterView({
    actionItems: owner.actionItems,
    phaseResponsibility: owner.phaseResponsibility,
    currentDate: owner.currentDate,
    saveId: owner.saveId,
    daysUntilTradeDeadline: owner.daysUntilTradeDeadline,
  });
  const decisions = filterDomainDecisions(actionCenter.items, ["staff"], 8);

  return {
    saveId,
    teamId,
    teamName: team ? `${team.city} ${team.name}` : "Team",
    currentDate: owner.currentDate,
    headCoach,
    staffCount: staff.roster.length,
    vacancyCount: vacantStarterRoles.length,
    vacantRoles: vacantRoleEntries.map((entry) => entry.roleLabel),
    vacantRoleEntries,
    directory,
    available: staff.available,
    decisions,
    budget: toStaffHubBudget(state, teamId),
  };
}

export function toStaffHiringMarketView(
  state: GameState,
): StaffHiringMarketView {
  const teamId = getActiveOwnerTeamId(state);
  const staff = toStaffView(state);
  const activeOffers: Record<string, StaffOfferView> = {};
  for (const offer of Object.values(state.world.staffMarket.offers)) {
    if (offer.teamId !== teamId || !isOpenStaffOffer(offer.status)) {
      continue;
    }
    activeOffers[offer.staffId] = {
      offerId: offer.id,
      staffId: offer.staffId,
      status: offer.status,
      annualSalary: offer.terms.annualSalary,
      years: offer.terms.years,
    };
  }

  const freeAgents: StaffHiringMarketAgentView[] = staff.available.map(
    (member) => {
      const entity = state.world.staff[member.staffId as StaffId];
      const interest = entity
        ? evaluateStaffInterest(entity, teamId, state, {
            annualSalary: member.desiredSalary,
            years: STAFF_DEFAULT_CONTRACT_YEARS,
          })
        : { level: "unwilling", interested: false };
      return {
        ...member,
        askingInterest: {
          level: interest.level,
          interested: interest.interested,
        },
      };
    },
  );

  return {
    saveId: state.meta.saveId,
    teamId,
    freeAgents,
    roleFilters: [...STAFF_ROLES],
    sortOptions: ["overall", "potential", "salary"],
    activeOffers,
  };
}

export function applyStaffHiringMarketFilters(
  view: StaffHiringMarketView,
  role?: string,
  sort?: string,
): StaffHiringMarketAgentView[] {
  let available = [...view.freeAgents];
  if (role) {
    available = available.filter((member) => member.role === role);
  }
  if (sort === "potential") {
    available.sort((a, b) => b.potential - a.potential);
  } else if (sort === "salary") {
    available.sort((a, b) => a.desiredSalary - b.desiredSalary);
  } else {
    available.sort((a, b) => b.overall - a.overall);
  }
  return available;
}

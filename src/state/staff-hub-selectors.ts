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
  STARTER_STAFF_ROLES,
} from "@/domain/entities/staff-roles";
import type { StaffRole } from "@/domain/entities/staff";

export type StaffRoleGroup = {
  role: string;
  roleLabel: string;
  members: StaffMemberView[];
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
  directory: StaffRoleGroup[];
  available: StaffMemberView[];
  decisions: ActionCenterItem[];
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
  // Any unexpected roles
  for (const [role, members] of byRole) {
    if (roleOrder.includes(role)) continue;
    directory.push({
      role,
      roleLabel: role.replaceAll("_", " "),
      members: sortMembers(members),
    });
  }

  const filledRoles = new Set(staff.roster.map((m) => m.role));
  const vacantRoles = STARTER_STAFF_ROLES.filter((r) => !filledRoles.has(r));
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
    vacancyCount: vacantRoles.length,
    vacantRoles: vacantRoles.map(
      (r) => STAFF_ROLE_DISPLAY[r] ?? r,
    ),
    directory,
    available: staff.available,
    decisions,
  };
}

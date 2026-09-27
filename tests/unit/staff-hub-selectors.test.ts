import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import {
  applyStaffHiringMarketFilters,
  toStaffHiringMarketView,
  toStaffHubView,
} from "@/state/staff-hub-selectors";
import { toStaffView } from "@/state/franchise-selectors";
import { fireStaff } from "@/systems/staff";
import { makeStaffOffer } from "@/systems/staff-free-agency";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { asStaffId, asTeamId } from "@/domain/ids";
import {
  getLeagueStaffBudget,
  getTeamStaffPayroll,
} from "@/systems/staff-budget";
import { STAFF_ROLES } from "@/domain/entities/staff-roles";

function boot(saveId: string) {
  let state = createTestGameState({ saveId });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  return state;
}

describe("staff-hub-selectors", () => {
  it("builds staff directory grouped by role without inventing roles", () => {
    const state = boot("staff_hub_test");
    const hub = toStaffHubView(state);
    const staff = toStaffView(state);

    expect(hub.staffCount).toBe(staff.roster.length);
    const directoryCount = hub.directory.reduce(
      (sum, g) => sum + g.members.length,
      0,
    );
    expect(directoryCount).toBe(staff.roster.length);
    expect(hub.available.length).toBe(staff.available.length);

    for (const group of hub.directory) {
      expect(group.members.length).toBeGreaterThan(0);
      expect(group.roleLabel.length).toBeGreaterThan(0);
      expect(group.members[0]?.specialty.length).toBeGreaterThan(0);
    }
  });

  it("reports vacancies for missing starter roles with role ids", () => {
    let state = boot("staff_hub_vac");
    const hubBefore = toStaffHubView(state);
    expect(hubBefore.vacancyCount).toBe(hubBefore.vacantRoles.length);
    expect(hubBefore.vacantRoleEntries).toHaveLength(hubBefore.vacancyCount);

    const teamId = asTeamId(hubBefore.teamId);
    const medical = findTeamStaffByRole(state, teamId, "medical");
    expect(medical).toBeTruthy();
    state = fireStaff(state, teamId, medical!.id).state;

    const hub = toStaffHubView(state);
    expect(
      hub.vacantRoleEntries.some((entry) => entry.role === "medical"),
    ).toBe(true);
    expect(hub.vacantRoles).toContain("Medical Staff");
  });

  it("computes staff budget from staff-budget functions without clamping percent", () => {
    let state = boot("staff_hub_budget");
    const hub = toStaffHubView(state);
    const year = state.competition.season.year;
    const teamId = asTeamId(hub.teamId);
    const payroll = getTeamStaffPayroll(teamId, year, state);
    const total = getLeagueStaffBudget(state);

    expect(hub.budget.payroll).toBe(payroll);
    expect(hub.budget.total).toBe(total);
    expect(hub.budget.remaining).toBe(total - payroll);
    expect(hub.budget.percentageUsed).toBe(
      total <= 0 ? 0 : Math.round((payroll / total) * 100),
    );
    expect(hub.budget.overBudget).toBe(payroll > total);

    state = {
      ...state,
      settings: {
        ...state.settings,
        financialRules: {
          ...state.settings.financialRules,
          staffBudget: 1_000_000,
        },
      },
    };
    const over = toStaffHubView(state);
    expect(over.budget.total).toBe(1_000_000);
    expect(over.budget.overBudget).toBe(true);
    expect(over.budget.amountOver).toBeGreaterThan(0);
    expect(over.budget.percentageUsed).toBeGreaterThan(100);
  });

  it("builds hiring market view wrapping available staff and open offers", () => {
    let state = boot("staff_hub_market");
    const staff = toStaffView(state);
    const market = toStaffHiringMarketView(state);

    expect(market.freeAgents.map((m) => m.staffId).sort()).toEqual(
      staff.available.map((m) => m.staffId).sort(),
    );
    expect(market.roleFilters).toEqual([...STAFF_ROLES]);
    expect(market.sortOptions).toEqual(["overall", "potential", "salary"]);
    expect(Object.keys(market.activeOffers)).toHaveLength(0);
    expect(market.freeAgents[0]?.askingInterest.level).toBeTruthy();

    const agent = staff.available[0]!;
    state = makeStaffOffer(state, {
      staffId: asStaffId(agent.staffId),
      teamId: asTeamId(market.teamId),
      annualSalary: agent.desiredSalary,
      years: 3,
    }).state;

    const withOffer = toStaffHiringMarketView(state);
    expect(withOffer.activeOffers[agent.staffId]?.status).toBe("pending");
    expect(withOffer.activeOffers[agent.staffId]?.annualSalary).toBe(
      agent.desiredSalary,
    );
  });

  it("filters and sorts the hiring market without a second store", () => {
    const state = boot("staff_hub_filter");
    const market = toStaffHiringMarketView(state);
    const role = market.freeAgents[0]?.role;
    expect(role).toBeTruthy();

    const filtered = applyStaffHiringMarketFilters(market, role, "salary");
    expect(filtered.every((member) => member.role === role)).toBe(true);
    for (let i = 1; i < filtered.length; i += 1) {
      expect(filtered[i]!.desiredSalary).toBeGreaterThanOrEqual(
        filtered[i - 1]!.desiredSalary,
      );
    }

    const byOverall = applyStaffHiringMarketFilters(
      market,
      undefined,
      "overall",
    );
    for (let i = 1; i < byOverall.length; i += 1) {
      expect(byOverall[i - 1]!.overall).toBeGreaterThanOrEqual(
        byOverall[i]!.overall,
      );
    }
  });
});

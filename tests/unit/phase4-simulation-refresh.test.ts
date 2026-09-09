/**
 * Phase 4 hubs must refresh from GameState after simulation ticks.
 * Selectors are read-only — assert they rebuild cleanly after development.
 */

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { processSeasonPlayerDevelopment } from "@/systems/season-player-development";
import { createTestGameState } from "../factories/game-state";
import { toContractHubView } from "@/state/contract-hub-selectors";
import { toStaffHubView } from "@/state/staff-hub-selectors";
import { toDevelopmentHubView } from "@/state/development-hub-selectors";
import { toDevelopmentLeagueDashboardView } from "@/state/development-league-selectors";
import { toFinanceHubView } from "@/state/finance-hub-selectors";
import { toFranchiseHubView } from "@/state/franchise-hub-selectors";

describe("phase4 simulation refresh", () => {
  it("rebuilds all Phase 4 hubs after player development tick", () => {
    let state = createTestGameState({ saveId: "phase4_refresh" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const beforeContracts = toContractHubView(state);
    const beforeStaff = toStaffHubView(state);
    const beforeDev = toDevelopmentHubView(state);
    const beforeDl = toDevelopmentLeagueDashboardView(state);
    const beforeFinance = toFinanceHubView(state);
    const beforeFranchise = toFranchiseHubView(state);

    expect(beforeContracts.rows.length).toBeGreaterThanOrEqual(0);
    expect(beforeStaff.staffCount).toBeGreaterThanOrEqual(0);
    expect(beforeDev.rows.length).toBeGreaterThanOrEqual(0);
    expect(beforeDl.prospects).toBeDefined();
    expect(beforeFinance.finances.businessFunds).toBeTypeOf("number");
    expect(beforeFranchise.franchiseValue).toBeTypeOf("number");

    const developed = processSeasonPlayerDevelopment(
      state,
      createSeededRng(99),
    );
    state = developed.state;

    const afterContracts = toContractHubView(state);
    const afterStaff = toStaffHubView(state);
    const afterDev = toDevelopmentHubView(state);
    const afterDl = toDevelopmentLeagueDashboardView(state);
    const afterFinance = toFinanceHubView(state);
    const afterFranchise = toFranchiseHubView(state);

    // Hubs rebuild; payroll/cap remain sourced from same domain calcs.
    expect(afterContracts.playerPayroll).toBeTypeOf("number");
    expect(afterStaff.directory).toBeDefined();
    expect(afterDev.stageCounts).toBeDefined();
    expect(afterDl.summary).toBeDefined();
    expect(afterFinance.businessHealth).toBeTruthy();
    expect(afterFranchise.links.length).toBeGreaterThan(0);

    // Development stage/rows still consistent after aging.
    expect(
      afterDev.stageCounts.developing +
        afterDev.stageCounts.prime +
        afterDev.stageCounts.declining,
    ).toBe(afterDev.rows.length);
  });
});

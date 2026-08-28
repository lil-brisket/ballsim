import { describe, expect, it } from "vitest";
import { createDefaultFranchiseOps } from "@/domain/entities/franchise-ops";
import { asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  arenaCapacity,
  facilityDevelopmentMultiplier,
  processWeeklyFacilityUpgrades,
  startFacilityUpgrade,
} from "@/systems/facilities";
import { FACILITY_UPGRADE_WEEKS } from "@/systems/facilities-config";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("facilities", () => {
  function bootstrapped() {
    let state = createInitialGameState({
    saveId: "fac_test", rngSeed: 11,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    return state;
  }

  it("startFacilityUpgrade deducts cash and sets upgrade weeks", () => {
    const state = bootstrapped();
    const teamId = state.user.activeOwnerTeamId;
    const cashBefore = state.business.finances[teamId]!.cash;
    const result = startFacilityUpgrade(state, teamId, "practice");
    const after = result.state.business.finances[teamId]!.cash;
    expect(after).toBeLessThan(cashBefore);
    expect(
      result.state.business.franchiseOps[teamId]!.facilities.practice
        .upgradeWeeksRemaining,
    ).toBe(FACILITY_UPGRADE_WEEKS);
    expect(result.events.some((e) => e.type === "FacilityUpgradeStarted")).toBe(
      true,
    );
  });

  it("processWeeklyFacilityUpgrades completes after remaining weeks", () => {
    let state = bootstrapped();
    const teamId = state.user.activeOwnerTeamId;
    state = startFacilityUpgrade(state, teamId, "medical").state;
    for (let i = 0; i < FACILITY_UPGRADE_WEEKS; i += 1) {
      state = processWeeklyFacilityUpgrades(state).state;
    }
    const facility = state.business.franchiseOps[teamId]!.facilities.medical;
    expect(facility.level).toBe(2);
    expect(facility.upgradeWeeksRemaining).toBe(0);
  });

  it("arenaCapacity and development multiplier derive from levels", () => {
    const state = bootstrapped();
    const teamId = state.user.activeOwnerTeamId;
    expect(arenaCapacity(state, teamId)).toBeGreaterThan(10_000);
    const mult = facilityDevelopmentMultiplier(state, teamId);
    expect(mult).toBeGreaterThanOrEqual(1);
    expect(mult).toBeLessThanOrEqual(1.35);
  });

  it("rejects upgrade when already in progress", () => {
    const state = bootstrapped();
    const teamId = state.user.activeOwnerTeamId;
    const started = startFacilityUpgrade(state, teamId, "arena");
    expect(() =>
      startFacilityUpgrade(started.state, teamId, "arena"),
    ).toThrow(/already in progress/);
  });

  it("uses franchise ops for unknown team throws", () => {
    const state = bootstrapped();
    expect(() =>
      arenaCapacity(state, asTeamId("team_missing")),
    ).toThrow();
  });

  it("defaults franchise ops levels at 1", () => {
    const ops = createDefaultFranchiseOps();
    expect(ops.facilities.arena.level).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  combinedStaffDevelopmentMultiplier,
  financeOpexEfficiencyMultiplier,
  financeRevenueEfficiencyMultiplier,
  gmTradeAcceptanceThreshold,
  scoutNoiseScale,
  trainerDevelopmentMultiplier,
  buildTeamStaffGameContext,
  medicalPreventionMultiplier,
} from "@/systems/staff-effects";
import { asStaffId } from "@/domain/ids";
import { testStaff } from "../helpers/staff";
import { createStaff } from "@/domain/entities/staff";
import { attributesFromLegacyQuality } from "@/systems/staff-ratings";
import { computeStaffOverall } from "@/domain/entities/staff";

describe("staff effects", () => {
  function boot() {
    let state = createInitialGameState({
      saveId: "staff_fx_1",
      rngSeed: 44,
      settings: CBL_GAME_SETTINGS,
    });
    return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  }

  it("GM/scout/trainer modifiers stay bounded (regression)", () => {
    const state = boot();
    const teamId = state.user.activeOwnerTeamId;
    const gmThresh = gmTradeAcceptanceThreshold(state, teamId);
    expect(gmThresh).toBeGreaterThanOrEqual(-1);
    expect(gmThresh).toBeLessThanOrEqual(1);

    const noise = scoutNoiseScale(state, teamId);
    expect(noise).toBeGreaterThanOrEqual(0.35);
    expect(noise).toBeLessThanOrEqual(1.35);

    const trainer = trainerDevelopmentMultiplier(state, teamId);
    expect(trainer).toBeGreaterThanOrEqual(0.85);
    expect(trainer).toBeLessThanOrEqual(1.2);
  });

  it("hierarchical development clamp prevents stacking runaway", () => {
    let state = boot();
    const teamId = state.user.activeOwnerTeamId;

    const makeElite = (role: "trainer" | "head_coach" | "assistant_coach", id: string) => {
      const attrs = attributesFromLegacyQuality(role, 95, [], []);
      return createStaff({
        ...testStaff({ id: asStaffId(id), role, teamId, overall: 95 }),
        attributes: attrs,
        overall: computeStaffOverall(role, attrs),
        potential: 97,
      });
    };

    // Replace roster staff for these roles
    const trainer = makeElite("trainer", "elite_tr");
    const hc = makeElite("head_coach", "elite_hc");
    const ac = makeElite("assistant_coach", "elite_ac");

    const team = state.world.teams[teamId]!;
    const keep = team.staff.filter((id) => {
      const s = state.world.staff[id];
      return s && !["trainer", "head_coach", "assistant_coach"].includes(s.role);
    });

    state = {
      ...state,
      world: {
        ...state.world,
        staff: {
          ...state.world.staff,
          [trainer.id]: trainer,
          [hc.id]: hc,
          [ac.id]: ac,
        },
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...team,
            staff: [...keep, trainer.id, hc.id, ac.id],
          },
        },
      },
    };

    const mult = combinedStaffDevelopmentMultiplier(state, teamId);
    expect(mult).toBeLessThanOrEqual(1.2);
    expect(mult).toBeGreaterThan(1);
  });

  it("finance effects never mutate funds/cap/staff budget", () => {
    const state = boot();
    const teamId = state.user.activeOwnerTeamId;
    const fundsBefore = state.business.finances[teamId]!.businessFunds;
    const staffBudgetBefore = state.settings.financialRules.staffBudget;

    const rev = financeRevenueEfficiencyMultiplier(state, teamId);
    const opex = financeOpexEfficiencyMultiplier(state, teamId);
    expect(rev).toBeGreaterThanOrEqual(0.92);
    expect(rev).toBeLessThanOrEqual(1.08);
    expect(opex).toBeGreaterThanOrEqual(0.92);
    expect(opex).toBeLessThanOrEqual(1.08);

    expect(state.business.finances[teamId]!.businessFunds).toBe(fundsBefore);
    expect(state.settings.financialRules.staffBudget).toBe(staffBudgetBefore);
  });

  it("medical prevention scales with medical staff attributes", () => {
    const state = boot();
    const mult = medicalPreventionMultiplier(
      state,
      state.user.activeOwnerTeamId,
    );
    expect(mult).toBeGreaterThanOrEqual(0.75);
    expect(mult).toBeLessThanOrEqual(1.35);
  });

  it("builds TeamStaffGameContext once without throwing", () => {
    const state = boot();
    const ctx = buildTeamStaffGameContext(
      state,
      state.user.activeOwnerTeamId,
    );
    expect(ctx.offensiveModifier).toBeGreaterThanOrEqual(-0.1);
    expect(ctx.offensiveModifier).toBeLessThanOrEqual(0.1);
  });
});

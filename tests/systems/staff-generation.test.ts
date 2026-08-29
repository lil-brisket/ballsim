import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { computeStaffOverall } from "@/domain/entities/staff";
import {
  generateAttributesAroundOverall,
  generateStaffPotential,
  generateStaffProfile,
  pickCareerArchetype,
} from "@/systems/staff-ratings";
import { STAFF_ROLES } from "@/domain/entities/staff-roles";

describe("staff generation / ratings", () => {
  it("overall equals attribute average without experience bonus", () => {
    const rng = createSeededRng(1);
    const attrs = generateAttributesAroundOverall("head_coach", 75, rng);
    const overall = computeStaffOverall("head_coach", attrs);
    const values = Object.values(attrs as Record<string, number>);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(Math.abs(overall - Math.round(mean))).toBeLessThanOrEqual(1);
  });

  it("potential is independent but correlated for young staff", () => {
    const rng = createSeededRng(99);
    let highPotentialYoung = 0;
    for (let i = 0; i < 40; i += 1) {
      const pot = generateStaffPotential(55, 28, rng);
      if (pot >= 75) highPotentialYoung += 1;
    }
    expect(highPotentialYoung).toBeGreaterThan(5);
  });

  it("archetype distribution produces variety", () => {
    const rng = createSeededRng(3);
    const counts = { elite: 0, veteran: 0, average: 0, developmental: 0 };
    for (let i = 0; i < 200; i += 1) {
      counts[pickCareerArchetype(rng)] += 1;
    }
    expect(counts.elite).toBeGreaterThan(0);
    expect(counts.developmental).toBeGreaterThan(0);
    expect(counts.average).toBeGreaterThan(counts.elite);
  });

  it("league generation seeds all roles including medical and PR", () => {
    let state = createInitialGameState({
      saveId: "staff_gen_roles",
      rngSeed: 11,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    for (const role of STAFF_ROLES) {
      const found = Object.values(state.world.staff).some((s) => s.role === role);
      expect(found).toBe(true);
    }
  });

  it("generateStaffProfile sets preferences salary floor", () => {
    const rng = createSeededRng(5);
    const profile = generateStaffProfile("scout", rng);
    expect(profile.preferences.desiredSalary).toBeGreaterThanOrEqual(
      profile.preferences.minimumSalary,
    );
    expect(profile.overall).toBeGreaterThanOrEqual(1);
  });
});

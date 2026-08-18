import { describe, expect, it } from "vitest";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import type { FranchiseContext } from "@/systems/franchise-ai-context";
import {
  resolveFranchisePreferences,
  resolveFranchisePreferencesFromParts,
} from "@/systems/franchise-ai-preferences";
import {
  boundedPreferenceMultiplier,
  PREFERENCE_VALUE_MODIFIER_BAND,
} from "@/systems/franchise-ai-preferences-config";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import type { TeamId } from "@/domain/ids";

function baseContext(
  overrides: Partial<FranchiseContext> = {},
): FranchiseContext {
  return {
    teamId: "team_test" as TeamId,
    wins: 20,
    losses: 20,
    winPct: 0.5,
    rosterStrength: 55,
    rosterAge: 26,
    youngRosterSharePct: 40,
    cash: 50_000_000,
    financialHealth: "stable",
    capSpace: 20_000_000,
    marketSize: 50,
    reputation: 50,
    fanSentiment: 50,
    marketingAwareness: 40,
    draftAssetCount: 2,
    performancePressure: 0.4,
    ...overrides,
  };
}

function identity(
  profile: AiProfile,
  axes: { spending: number; patience: number; risk: number } = {
    spending: 50,
    patience: 50,
    risk: 50,
  },
) {
  return {
    aiProfile: profile,
    spendingTolerance: axes.spending,
    patience: axes.patience,
    riskTolerance: axes.risk,
    marketSize: 50,
  };
}

describe("resolveFranchisePreferences", () => {
  it("is pure and does not mutate identity inputs", () => {
    const id = identity("rebuild", { spending: 30, patience: 80, risk: 40 });
    const ctx = baseContext({ performancePressure: 0.2 });
    const a = resolveFranchisePreferencesFromParts(id, ctx);
    const b = resolveFranchisePreferencesFromParts(id, ctx);
    expect(a.preferences).toEqual(b.preferences);
    expect(a.identity.aiProfile).toBe("rebuild");
  });

  it("raises winNowPressure under poor performance without changing strategy", () => {
    const id = identity("rebuild", { spending: 40, patience: 30, risk: 50 });
    const calm = resolveFranchisePreferencesFromParts(
      id,
      baseContext({ performancePressure: 0.1, winPct: 0.55, rosterStrength: 62 }),
    );
    const pressed = resolveFranchisePreferencesFromParts(
      id,
      baseContext({
        performancePressure: 0.9,
        winPct: 0.25,
        rosterStrength: 42,
      }),
    );
    expect(pressed.debug.strategy).toBe("rebuild");
    expect(pressed.preferences.patiencePressure).toBeGreaterThan(
      calm.preferences.patiencePressure,
    );
  });

  it("differentiates win_now vs rebuild baselines", () => {
    const ctx = baseContext();
    const winNow = resolveFranchisePreferencesFromParts(
      identity("win_now", { spending: 70, patience: 30, risk: 60 }),
      ctx,
    );
    const rebuild = resolveFranchisePreferencesFromParts(
      identity("rebuild", { spending: 30, patience: 75, risk: 40 }),
      ctx,
    );
    expect(winNow.preferences.establishedPlayerValue).toBeGreaterThan(
      rebuild.preferences.establishedPlayerValue,
    );
    expect(rebuild.preferences.pickValue).toBeGreaterThan(
      winNow.preferences.pickValue,
    );
    expect(rebuild.preferences.youthValue).toBeGreaterThan(
      winNow.preferences.youthValue,
    );
  });

  it("cash-rich conservative still differs from cash-poor conservative", () => {
    const id = identity("conservative", {
      spending: 25,
      patience: 70,
      risk: 20,
    });
    const rich = resolveFranchisePreferencesFromParts(
      id,
      baseContext({ financialHealth: "healthy", cash: 200_000_000 }),
    );
    const poor = resolveFranchisePreferencesFromParts(
      id,
      baseContext({ financialHealth: "critical", cash: 2_000_000 }),
    );
    expect(rich.preferences.spendWillingness).toBeGreaterThan(
      poor.preferences.spendWillingness,
    );
    expect(poor.preferences.cashPreservation).toBeGreaterThan(
      rich.preferences.cashPreservation,
    );
  });

  it("bounded multipliers stay within band", () => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const m = boundedPreferenceMultiplier(p);
      expect(m).toBeGreaterThanOrEqual(1 - PREFERENCE_VALUE_MODIFIER_BAND);
      expect(m).toBeLessThanOrEqual(1 + PREFERENCE_VALUE_MODIFIER_BAND);
    }
  });

  it("resolves from live game state for every team", () => {
    let state = createInitialGameState({
      saveId: "pref_live",
      rngSeed: 44,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const resolved = resolveFranchisePreferences(state, teamId);
      expect(resolved).not.toBeNull();
      expect(resolved!.debug.primaryInfluences.length).toBeGreaterThan(0);
    }
  });
});

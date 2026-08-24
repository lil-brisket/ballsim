import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import { meanFingerprintsByProfile } from "@/systems/economy/franchise-identity-metrics";
import { snapshotAllFranchiseIdentities } from "@/systems/economy/franchise-identity-metrics";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

const PROFILE_CYCLE: AiProfile[] = [
  "win_now",
  "conservative",
  "development",
  "rebuild",
  "market_growth",
  "aggressive",
];

function assignDistinctProfiles(state: GameState): GameState {
  const teamIds = Object.keys(state.world.teams).sort() as TeamId[];
  const franchiseOps = { ...state.business.franchiseOps };
  for (let index = 0; index < teamIds.length; index += 1) {
    const teamId = teamIds[index]!;
    const ops = franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    const profile = PROFILE_CYCLE[index % PROFILE_CYCLE.length]!;
    franchiseOps[teamId] = {
      ...ops,
      aiProfile: profile,
      spendingTolerance:
        profile === "conservative"
          ? 25
          : profile === "win_now" || profile === "aggressive"
            ? 75
            : 50,
      patience: profile === "development" || profile === "rebuild" ? 70 : 45,
      riskTolerance:
        profile === "conservative"
          ? 25
          : profile === "aggressive"
            ? 75
            : 50,
    };
  }
  return {
    ...state,
    business: { ...state.business, franchiseOps },
  };
}

describe("behavioral harness smoke", () => {
  it("assigns divergent profiles and produces readable preference fingerprints", () => {
    let state = createInitialGameState({
      saveId: "harness_smoke",
      rngSeed: 77,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = assignDistinctProfiles(state);

    const prefsByProfile = new Map<AiProfile, number[]>();
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const resolved = resolveFranchisePreferences(state, teamId);
      expect(resolved).not.toBeNull();
      const spends = prefsByProfile.get(resolved!.identity.aiProfile) ?? [];
      spends.push(resolved!.preferences.spendWillingness);
      prefsByProfile.set(resolved!.identity.aiProfile, spends);
    }

    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;

    expect(mean(prefsByProfile.get("win_now")!)).toBeGreaterThan(
      mean(prefsByProfile.get("conservative")!),
    );
    expect(mean(prefsByProfile.get("market_growth")!)).toBeGreaterThan(0);

    const fingerprints = meanFingerprintsByProfile(
      snapshotAllFranchiseIdentities(state),
    );
    expect(fingerprints.length).toBeGreaterThanOrEqual(5);
  });
});

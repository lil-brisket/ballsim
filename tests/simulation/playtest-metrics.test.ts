import { describe, expect, it } from "vitest";
import { collectPlaytestMetrics } from "@/simulation/playtest/collect-playtest-metrics";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";

describe("collectPlaytestMetrics", () => {
  it("prints the same JSON twice for a known seed", () => {
    const state = bootstrapWorld(
      createTestGameState({ saveId: "playtest_metrics", rngSeed: 42_001 }),
      createSeededRng(42_001),
    ).state;
    const first = collectPlaytestMetrics(state);
    const second = collectPlaytestMetrics(state);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.talent.activePlayers).toBeGreaterThan(0);
    expect(first.talent.ovr90).toBeLessThanOrEqual(first.talent.activePlayers);
    expect(first.schemaVersion).toBe(state.meta.schemaVersion);
  });

  it("excludes retired players from the talent census", () => {
    const bootstrapped = bootstrapWorld(
      createTestGameState({ saveId: "playtest_retired", rngSeed: 42_002 }),
      createSeededRng(42_002),
    ).state;
    const player = Object.values(bootstrapped.world.players)[0]!;
    bootstrapped.world.players[player.id] = { ...player, retired: true };
    const metrics = collectPlaytestMetrics(bootstrapped);
    expect(metrics.talent.retiredPlayers).toBe(1);
    expect(metrics.talent.activePlayers).toBe(
      Object.values(bootstrapped.world.players).length - 1,
    );
  });
});

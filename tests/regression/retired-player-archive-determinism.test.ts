import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { withSaveHistory } from "@/persistence/save-history";
import type { GameState } from "@/state/game-state";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

/**
 * JSON with sorted keys, the save id masked and wall-clock fields dropped
 * (meta timestamps, report `generatedAt`).
 */
function canonical(state: GameState): string {
  const { meta, ...rest } = state;
  const { createdAt: _c, updatedAt: _u, saveId, ...stableMeta } = meta;
  const sort = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sort);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value)
          .filter((key) => key !== "generatedAt")
          .sort()
          .map((key) => [key, sort((value as Record<string, unknown>)[key])]),
      );
    }
    return value;
  };
  return JSON.stringify(sort({ ...rest, meta: stableMeta })).replaceAll(
    saveId,
    "<save>",
  );
}

async function fullLeague(archiveRetiredPlayers: boolean) {
  // Ids embed the save id, and seeds derive from ids: both runs need the
  // same save id to be the same league.
  let next = 0;
  const uuid = vi
    .spyOn(crypto, "randomUUID")
    .mockImplementation(
      () =>
        `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`,
    );
  const result = await runMultiYearSimulation({
    seasons: 4,
    managementPreset: "continuity",
    advanceMode: "until_phase",
    seed: TEST_RNG_SEED + 7,
    saveReloadEachSeason: true,
    archiveRetiredPlayers,
  });
  uuid.mockRestore();
  const loaded = (await result.store.load(result.saveId))!;
  const history = await result.store.loadHistory(result.saveId);
  return {
    hot: loaded.state,
    full: withSaveHistory(loaded.state, history),
  };
}

describe("retired player archive", () => {
  it(
    "plays the same league whether or not retired players are archived",
    async () => {
      const archived = await fullLeague(true);
      const kept = await fullLeague(false);

      // The archive actually happened in the archived run.
      const retired = Object.keys(archived.full.world.retiredPlayers);
      const archivedIds = retired.filter(
        (id) => archived.hot.world.players[id] === undefined,
      );
      expect(archivedIds.length).toBeGreaterThan(0);
      // (Player ids embed the save id, so each run is checked on its own.)
      for (const id of Object.keys(kept.full.world.retiredPlayers)) {
        expect(kept.hot.world.players[id]).toBeDefined();
      }

      // With history put back, both careers are the same league.
      expect(canonical(archived.full)).toBe(canonical(kept.full));
    },
    20 * 60_000,
  );
});

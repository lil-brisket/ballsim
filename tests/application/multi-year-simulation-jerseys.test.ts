import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import { isJerseyNumber } from "@/domain/jersey-number";
import type { GameState } from "@/state/game-state";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

function expectUniquePerFranchise(state: GameState): void {
  const byTeam = new Map<string, number[]>();
  for (const player of Object.values(state.world.players)) {
    expect(isJerseyNumber(player.jerseyNumber)).toBe(true);
    if (player.teamId !== null && player.retired !== true) {
      const list = byTeam.get(player.teamId) ?? [];
      list.push(player.jerseyNumber);
      byTeam.set(player.teamId, list);
    }
  }
  for (const [teamId, numbers] of byTeam) {
    expect(new Set(numbers).size, `${teamId} has a duplicate number`).toBe(
      numbers.length,
    );
  }
}

describe("jersey numbers across multiple seasons", () => {
  it(
    "stay unique per franchise and stay with players who never leave",
    async () => {
      // Checked at every saved step (numbers are reconciled on save), so a
      // player who leaves and later returns is seen leaving. Like the NBA,
      // a returning player's old number may have gone to someone else.
      let previous = new Map<string, { teamId: string; number: number }>();
      let stayed = 0;
      let moved = 0;
      const observe = (state: GameState) => {
        const current = new Map<string, { teamId: string; number: number }>();
        for (const player of Object.values(state.world.players)) {
          if (player.teamId === null || player.retired === true) {
            continue;
          }
          current.set(player.id, {
            teamId: player.teamId,
            number: player.jerseyNumber,
          });
          const before = previous.get(player.id);
          if (!before) {
            continue;
          }
          if (before.teamId === player.teamId) {
            stayed += 1;
            expect(
              player.jerseyNumber,
              `${player.id} changed number on ${state.world.calendar.currentDate}`,
            ).toBe(before.number);
          } else {
            moved += 1;
          }
        }
        previous = current;
      };

      const result = await runMultiYearSimulation({
        seasons: 2,
        managementPreset: "continuity",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 17,
        saveReloadEachSeason: true,
        onSeasonBoundary: (state) => expectUniquePerFranchise(state),
        onStep: observe,
      });
      expect(result.seasonsCompleted).toBe(2);
      expectUniquePerFranchise(result.finalState);
      observe(result.finalState);

      expect(stayed).toBeGreaterThan(0);
      expect(moved).toBeGreaterThan(0);
    },
    LONG_TIMEOUT_MS,
  );
});

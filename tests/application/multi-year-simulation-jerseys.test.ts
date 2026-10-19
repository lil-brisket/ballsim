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

type Snapshot = {
  /** playerId → { team, number } for players on a top-league roster. */
  rostered: Map<string, { teamId: string; number: number }>;
};

function snapshot(state: GameState): Snapshot {
  const rostered = new Map<string, { teamId: string; number: number }>();
  for (const team of Object.values(state.world.teams)) {
    for (const id of team.roster) {
      rostered.set(id, {
        teamId: team.id,
        number: state.world.players[id]!.jerseyNumber,
      });
    }
  }
  return { rostered };
}

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
    "stay unique per franchise and stay with players who stay put",
    async () => {
      const snapshots: Snapshot[] = [];
      const result = await runMultiYearSimulation({
        seasons: 2,
        managementPreset: "continuity",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 17,
        saveReloadEachSeason: true,
        onSeasonBoundary: (state) => {
          expectUniquePerFranchise(state);
          snapshots.push(snapshot(state));
        },
      });
      expect(result.seasonsCompleted).toBe(2);
      expectUniquePerFranchise(result.finalState);
      snapshots.push(snapshot(result.finalState));

      // Players who were on the same team's roster at two consecutive
      // boundaries kept their number; and some players did change teams.
      let stayed = 0;
      let moved = 0;
      for (let i = 1; i < snapshots.length; i += 1) {
        for (const [id, before] of snapshots[i - 1]!.rostered) {
          const after = snapshots[i]!.rostered.get(id);
          if (!after) {
            continue;
          }
          if (after.teamId === before.teamId) {
            stayed += 1;
            expect(after.number, `${id} changed number`).toBe(before.number);
          } else {
            moved += 1;
          }
        }
      }
      expect(stayed).toBeGreaterThan(0);
      expect(moved).toBeGreaterThan(0);
    },
    LONG_TIMEOUT_MS,
  );
});

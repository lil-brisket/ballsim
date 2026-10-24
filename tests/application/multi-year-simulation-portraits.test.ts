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

import {
  isValidPortraitAssignment,
  portraitTraitSignature,
  type PlayerPortraitAssignment,
} from "@/domain/entities/player-portrait";
import type { GameState } from "@/state/game-state";
import { runMultiYearSimulation } from "../helpers/multi-year-simulation";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

type Snapshot = {
  portraits: Record<string, PlayerPortraitAssignment>;
  teamByPlayer: Record<string, string | null>;
  draftYears: number[];
};

function snapshot(state: GameState): Snapshot {
  const teamByPlayer: Record<string, string | null> = {};
  for (const player of Object.values(state.world.players)) {
    teamByPlayer[player.id] = player.teamId;
  }
  return {
    portraits: structuredClone(state.world.playerPortraits),
    teamByPlayer,
    draftYears: Object.values(state.world.drafts).map((d) => d.seasonYear),
  };
}

function expectCoverage(state: GameState): void {
  const ids = new Set(Object.keys(state.world.players));
  for (const draft of Object.values(state.world.drafts)) {
    for (const id of Object.keys(draft.prospects)) ids.add(id);
  }
  const missing = [...ids].filter(
    (id) => !isValidPortraitAssignment(state.world.playerPortraits[id]),
  );
  expect(missing).toEqual([]);
}

describe("player portraits across multiple seasons", () => {
  it(
    "covers every draft class and never changes an existing portrait",
    async () => {
      const snapshots: Snapshot[] = [];
      const result = await runMultiYearSimulation({
        seasons: 2,
        managementPreset: "continuity",
        advanceMode: "until_phase",
        seed: TEST_RNG_SEED + 11,
        saveReloadEachSeason: true,
        onSeasonBoundary: (state) => {
          expectCoverage(state);
          snapshots.push(snapshot(state));
        },
      });
      expect(result.seasonsCompleted).toBe(2);
      expectCoverage(result.finalState);

      const final = snapshot(result.finalState);
      snapshots.push(final);
      // Two completed seasons → at least two generated draft classes, each
      // covered while it was current (older classes leave the save
      // snapshot for its history store).
      expect(
        new Set(snapshots.flatMap((entry) => entry.draftYears)).size,
      ).toBeGreaterThanOrEqual(2);

      // Append-only: every assignment ever seen is preserved verbatim.
      for (const earlier of snapshots) {
        for (const [id, entry] of Object.entries(earlier.portraits)) {
          expect(final.portraits[id]).toEqual(entry);
        }
      }

      // Players changed teams (FA / trades / draft) yet kept their portrait.
      const first = snapshots[0]!;
      const moved = Object.keys(first.teamByPlayer).filter(
        (id) =>
          id in final.teamByPlayer &&
          final.teamByPlayer[id] !== first.teamByPlayer[id],
      );
      expect(moved.length).toBeGreaterThan(0);
      for (const id of moved) {
        expect(final.portraits[id]).toEqual(first.portraits[id]);
      }

      // Uniqueness among active players holds after many generations.
      const active = Object.values(result.finalState.world.players)
        .filter((p) => p.retired !== true)
        .map((p) => result.finalState.world.playerPortraits[p.id]!)
        .filter((entry) => entry.duplicate !== true)
        .map((entry) => portraitTraitSignature(entry.traits));
      expect(new Set(active).size).toBe(active.length);
    },
    LONG_TIMEOUT_MS,
  );
});

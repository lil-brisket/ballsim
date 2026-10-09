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
  createNewOwnerSave,
  executeOwnerTrade,
  listOwnerTradeCandidates,
} from "@/application/game-service";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { TEST_RNG_SEED } from "../helpers/determinism";

async function seedSave() {
  const store = createMemorySaveGameStore();
  const created = await createNewOwnerSave(
    {
      name: "Execute Owner Trade",
      rngSeed: TEST_RNG_SEED,
      settings: CBL_GAME_SETTINGS,
    },
    store,
  );
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error(created.error);
  }
  const loaded = await store.load(created.save.id);
  expect(loaded).not.toBeNull();
  return { store, saveId: created.save.id, state: loaded!.state };
}

async function firstCandidate(
  saveId: string,
  store: ReturnType<typeof createMemorySaveGameStore>,
  teamId: TeamId,
  roster: PlayerId[],
) {
  for (const playerId of roster) {
    const listed = await listOwnerTradeCandidates(saveId, playerId, store);
    if (listed.ok && listed.candidates.length > 0) {
      return { playerId, row: listed.candidates[0]! };
    }
  }
  throw new Error("Expected at least one Finder candidate in a new owner save.");
}

describe("executeOwnerTrade", () => {
  it("executes the supplied proposal for that player and does not persist AI trade-block prep", async () => {
    const { store, saveId, state } = await seedSave();
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]!.roster;
    const { playerId, row } = await firstCandidate(
      saveId,
      store,
      teamId,
      roster,
    );

    const before = await store.load(saveId);
    const blocksBefore = before!.state.business.tradeBlocks;
    const counterpartId = row.counterpartyTeamId;

    const traded = await executeOwnerTrade(
      saveId,
      { outgoingPlayerId: playerId, proposal: row.proposal },
      store,
    );
    expect(traded.ok).toBe(true);
    if (!traded.ok) {
      throw new Error(traded.error);
    }

    const after = await store.load(saveId);
    const afterRoster = after!.state.world.teams[teamId]!.roster;
    expect(afterRoster).not.toContain(playerId);

    for (const otherTeamId of Object.keys(after!.state.world.teams)) {
      if (otherTeamId === teamId || otherTeamId === counterpartId) {
        continue;
      }
      expect(after!.state.business.tradeBlocks[otherTeamId]).toEqual(
        blocksBefore[otherTeamId],
      );
    }
  });

  it("rejects a proposal that does not send the selected player", async () => {
    const { store, saveId, state } = await seedSave();
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]!.roster;
    const { playerId, row } = await firstCandidate(
      saveId,
      store,
      teamId,
      roster,
    );
    const otherId = roster.find((id) => id !== playerId);
    expect(otherId).toBeDefined();

    const rosterBefore = [...roster];
    const rejected = await executeOwnerTrade(
      saveId,
      { outgoingPlayerId: otherId!, proposal: row.proposal },
      store,
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error).toMatch(/does not send the selected player/i);
    }

    const after = await store.load(saveId);
    expect(after!.state.world.teams[teamId]!.roster).toEqual(rosterBefore);
  });

  it("auto-search without a proposal only moves the requested player", async () => {
    const { store, saveId, state } = await seedSave();
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]!.roster;
    const { playerId } = await firstCandidate(saveId, store, teamId, roster);

    const traded = await executeOwnerTrade(
      saveId,
      { outgoingPlayerId: playerId },
      store,
    );
    expect(traded.ok).toBe(true);
    if (!traded.ok) {
      throw new Error(traded.error);
    }

    const after = await store.load(saveId);
    expect(after!.state.world.teams[teamId]!.roster).not.toContain(playerId);
  });
});

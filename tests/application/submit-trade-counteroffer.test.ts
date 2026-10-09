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
  submitTradeCounteroffer,
} from "@/application/game-service";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { GameState } from "@/state/game-state";
import { TEST_RNG_SEED } from "../helpers/determinism";
import { enqueueTradeOfferForOwner } from "@/systems/owner-decisions";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";

async function seedSave() {
  const store = createMemorySaveGameStore();
  const created = await createNewOwnerSave(
    {
      name: "Submit Trade Counter",
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

function otherTeamId(state: GameState): TeamId {
  const userId = state.user.activeOwnerTeamId;
  const ids = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== userId)
    .sort();
  return ids[0]!;
}

function boostOverall(state: GameState, playerId: string, rating: number) {
  const player = state.world.players[playerId];
  if (!player) return state;
  const attributes = { ...player.attributes };
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attributes[key] = rating;
  }
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          attributes,
          potential: { ...player.potential, overall: Math.min(99, rating + 2) },
        },
      },
    },
  };
}

describe("submitTradeCounteroffer", () => {
  it("rebalances the CPU package instead of keeping the original outgoing set", async () => {
    const { store, saveId, state } = await seedSave();
    const userTeamId = state.user.activeOwnerTeamId;
    const cpuTeamId = otherTeamId(state);
    const cpuPlayer = state.world.teams[cpuTeamId]!.roster[0]!;
    const userGood = state.world.teams[userTeamId]!.roster[0]!;
    const userWorse = state.world.teams[userTeamId]!.roster[7]!;
    let working = boostOverall(state, cpuPlayer, 84);
    working = boostOverall(working, userGood, 80);
    working = boostOverall(working, userWorse, 60);

    const original: TradeProposal = {
      sideA: {
        teamId: cpuTeamId,
        playerIds: [cpuPlayer],
        draftPickIds: [],
      },
      sideB: {
        teamId: userTeamId,
        playerIds: [userGood],
        draftPickIds: [],
      },
    };
    const queued = enqueueTradeOfferForOwner(working, cpuTeamId, original, {
      targetOwnedTeamId: userTeamId,
    });
    expect(queued.outcome).toBe("queued");
    const existing = await store.load(saveId);
    await store.save({
      id: saveId,
      state: queued.state,
      ifUpdatedAt: existing?.updatedAt,
    });

    const counter: TradeProposal = {
      sideA: original.sideA,
      sideB: {
        teamId: userTeamId,
        playerIds: [userWorse],
        draftPickIds: [],
      },
    };
    const decisionId = queued.state.user.pendingOwnerDecisions[0]!.id;
    const result = await submitTradeCounteroffer(
      saveId,
      decisionId,
      counter,
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = await store.load(saveId);
    const pending = after!.state.user.pendingOwnerDecisions[0];
    if (pending && pending.type === "trade_offer") {
      const current = pending.payload.currentProposal ?? pending.payload.proposal;
      const cpuSide =
        current.sideA.teamId === cpuTeamId ? current.sideA : current.sideB;
      expect(
        cpuSide.playerIds.length + cpuSide.draftPickIds.length,
      ).toBeGreaterThan(1);
    } else {
      expect(after!.state.user.ownerDecisionHistory.length).toBeGreaterThan(0);
    }
  });
});

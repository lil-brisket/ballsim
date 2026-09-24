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
  listOwnerTradeCandidates,
} from "@/application/game-service";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { TEST_RNG_SEED } from "../helpers/determinism";

describe("listOwnerTradeCandidates", () => {
  it("returns presentation rows and does not persist AI trade-block prep", async () => {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      {
        name: "Trade Candidates Test",
        rngSeed: TEST_RNG_SEED,
        settings: CBL_GAME_SETTINGS,
      },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const loaded = await store.load(created.save.id);
    expect(loaded).not.toBeNull();
    const teamId = loaded!.state.user.activeOwnerTeamId;
    const playerId = loaded!.state.world.teams[teamId]!.roster[0]!;
    const blocksBefore = JSON.stringify(loaded!.state.business.tradeBlocks);

    const result = await listOwnerTradeCandidates(
      created.save.id,
      playerId,
      store,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(Array.isArray(result.candidates)).toBe(true);
    for (const row of result.candidates) {
      expect(row).toHaveProperty("counterpartyTeamId");
      expect(row).toHaveProperty("outgoingSummary");
      expect(row).toHaveProperty("incomingSummary");
      expect(row).toHaveProperty("reviewHref");
      expect(row.acceptedByCounterparty).toBe(true);
    }

    const after = await store.load(created.save.id);
    expect(JSON.stringify(after!.state.business.tradeBlocks)).toBe(
      blocksBefore,
    );
  });
});

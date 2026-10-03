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

vi.mock("@/persistence/custom-content-repository", () => ({
  prismaCustomContentStore: {
    list: vi.fn(),
    getByContentId: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}));

import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  createNewOwnerSave,
  resolveOwnerDraftClassDecision,
} from "@/application/game-service";
import { createSeededRng } from "@/domain/rng";
import { setActivePhase } from "@/systems/phase-engine";
import { processPhaseEnter } from "@/systems/simulation/offseason-lifecycle";
import { draftYearForSeason } from "@/systems/draft";
import { draftClassIdFor } from "@/domain/entities/draft";
import { makeDraftClassPackage, makePlayerSource } from "../helpers/custom-content";

describe("new-season custom class decision", () => {
  it("prompts once and does not recreate after resolved", async () => {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      { name: "Decision Save", settings: CBL_GAME_SETTINGS, rngSeed: 31 },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const loaded = await store.load(created.save.id);
    let state = loaded!.state;
    state = setActivePhase(state, "offseason.draft_preparation");
    const rng = createSeededRng(state.meta.rngState);
    state = processPhaseEnter(state, "offseason.draft_preparation", rng).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    expect(state.user.pendingDraftClassDecisions[String(draftYear)]?.resolved).toBe(
      false,
    );
    expect(state.world.drafts[draftClassIdFor(draftYear)]).toBeUndefined();

    await store.save({ id: created.save.id, state });
    const first = await resolveOwnerDraftClassDecision(
      created.save.id,
      { source: "generated" },
      store,
    );
    expect(first.ok).toBe(true);
    const after = await store.load(created.save.id);
    expect(
      after!.state.user.pendingDraftClassDecisions[String(draftYear)]?.resolved,
    ).toBe(true);
    expect(after!.state.world.drafts[draftClassIdFor(draftYear)]).toBeDefined();

    const second = await resolveOwnerDraftClassDecision(
      created.save.id,
      { source: "generated" },
      store,
    );
    expect(second.ok).toBe(true);
    const again = await store.load(created.save.id);
    expect(Object.keys(again!.state.world.drafts)).toEqual(
      Object.keys(after!.state.world.drafts),
    );
  });

  it("imports a custom class when resolved as custom", async () => {
    const store = createMemorySaveGameStore();
    const created = await createNewOwnerSave(
      { name: "Custom Class Save", settings: CBL_GAME_SETTINGS, rngSeed: 32 },
      store,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const loaded = await store.load(created.save.id);
    let state = loaded!.state;
    state = setActivePhase(state, "offseason.draft_preparation");
    await store.save({ id: created.save.id, state });
    const pkg = makeDraftClassPackage({
      draftYear: 2027,
      prospects: [
        makePlayerSource({
          sourceId: "star",
          firstName: "Custom",
          lastName: "Rookie",
          age: 21,
          position: "PG",
          archetype: "floor_general",
          heightInches: 74,
          weightPounds: 190,
        }),
      ],
    });
    const result = await resolveOwnerDraftClassDecision(
      created.save.id,
      { source: "custom", packageRaw: pkg },
      store,
    );
    expect(result.ok).toBe(true);
    const after = await store.load(created.save.id);
    const draft = Object.values(after!.state.world.drafts)[0]!;
    const prospect = Object.values(draft.prospects).find(
      (entry) => entry.player.lastName === "Rookie",
    );
    expect(prospect).toBeDefined();
    expect(after!.state.world.players[prospect!.playerId]).toBeUndefined();
  });
});

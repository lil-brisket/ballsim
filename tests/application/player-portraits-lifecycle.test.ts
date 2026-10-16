import { beforeEach, describe, expect, it, vi } from "vitest";

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

const portraitFailure = vi.hoisted(() => ({ enabled: false }));

vi.mock(
  "@/systems/portraits/assign-player-portraits",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/systems/portraits/assign-player-portraits")
      >();
    return {
      ...actual,
      ensurePlayerPortraits: (
        ...args: Parameters<typeof actual.ensurePlayerPortraits>
      ) => {
        if (portraitFailure.enabled) {
          throw new Error("portrait generator unavailable");
        }
        return actual.ensurePlayerPortraits(...args);
      },
    };
  },
);

import {
  createNewOwnerSave,
  executeOwnerTrade,
  listOwnerTradeCandidates,
  loadOwnerSaveView,
  resolveOwnerDraftClassDecision,
} from "@/application/game-service";
import { repairPlayerPortraits } from "@/application/repair-player-portraits";
import { isValidPortraitAssignment } from "@/domain/entities/player-portrait";
import { cloneGameSettings, CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { GameState } from "@/state/game-state";
import { setActivePhase } from "@/systems/phase-engine";
import { processPhaseEnter } from "@/systems/simulation/offseason-lifecycle";
import {
  makeDraftClassPackage,
  makeFullRosterPackage,
  makePlayerSource,
} from "../helpers/custom-content";
import { TEST_RNG_SEED } from "../helpers/determinism";

type Store = ReturnType<typeof createMemorySaveGameStore>;

function portraitSubjectIds(state: GameState): string[] {
  const ids = new Set(Object.keys(state.world.players));
  for (const draft of Object.values(state.world.drafts)) {
    for (const id of Object.keys(draft.prospects)) ids.add(id);
  }
  return [...ids];
}

function expectFullCoverage(state: GameState): void {
  const ids = portraitSubjectIds(state);
  expect(ids.length).toBeGreaterThan(0);
  const missing = ids.filter(
    (id) => !isValidPortraitAssignment(state.world.playerPortraits[id]),
  );
  expect(missing).toEqual([]);
}

async function createSave(
  store: Store,
  input: Parameters<typeof createNewOwnerSave>[0] = {
    name: "Portrait Save",
    settings: CBL_GAME_SETTINGS,
    rngSeed: TEST_RNG_SEED,
  },
): Promise<{ saveId: string; state: GameState }> {
  const created = await createNewOwnerSave(input, store);
  if (!created.ok) throw new Error(created.error);
  const loaded = await store.load(created.save.id);
  return { saveId: created.save.id, state: loaded!.state };
}

async function enterDraftPreparation(store: Store, saveId: string) {
  const loaded = await store.load(saveId);
  let state = setActivePhase(loaded!.state, "offseason.draft_preparation");
  state = processPhaseEnter(
    state,
    "offseason.draft_preparation",
    createSeededRng(state.meta.rngState),
  ).state;
  await store.save({ id: saveId, state });
}

describe("player portrait lifecycle", () => {
  beforeEach(() => {
    portraitFailure.enabled = false;
  });

  it("assigns portraits to every player in a new standard save", async () => {
    const store = createMemorySaveGameStore();
    const { state } = await createSave(store);
    expectFullCoverage(state);
  });

  it("assigns portraits in custom-roster and fantasy saves", async () => {
    for (const mode of ["custom", "fantasy"] as const) {
      const store = createMemorySaveGameStore();
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.draft.mode = mode;
      const { state } = await createSave(store, {
        name: `Portrait ${mode}`,
        settings,
        rngSeed: 21,
        rosterPackage: makeFullRosterPackage({
          teamCount: settings.league.teamCount,
        }),
      });
      expectFullCoverage(state);
    }
  });

  it("assigns portraits to a generated draft class without touching existing players", async () => {
    const store = createMemorySaveGameStore();
    const { saveId, state: initial } = await createSave(store);
    await enterDraftPreparation(store, saveId);
    const result = await resolveOwnerDraftClassDecision(
      saveId,
      { source: "generated" },
      store,
    );
    expect(result.ok).toBe(true);
    const after = (await store.load(saveId))!.state;
    const draft = Object.values(after.world.drafts)[0]!;
    expect(Object.keys(draft.prospects).length).toBeGreaterThan(0);
    expectFullCoverage(after);
    for (const [id, entry] of Object.entries(initial.world.playerPortraits)) {
      expect(after.world.playerPortraits[id]).toEqual(entry);
    }
  });

  it("assigns portraits to an imported custom draft class", async () => {
    const store = createMemorySaveGameStore();
    const { saveId } = await createSave(store);
    const loaded = await store.load(saveId);
    await store.save({
      id: saveId,
      state: setActivePhase(loaded!.state, "offseason.draft_preparation"),
    });
    const result = await resolveOwnerDraftClassDecision(
      saveId,
      {
        source: "custom",
        packageRaw: makeDraftClassPackage({
          draftYear: 2027,
          prospects: [
            makePlayerSource({ sourceId: "a", lastName: "Alpha" }),
            makePlayerSource({ sourceId: "b", lastName: "Beta" }),
          ],
        }),
      },
      store,
    );
    expect(result.ok).toBe(true);
    expectFullCoverage((await store.load(saveId))!.state);
  });

  it("keeps portraits unchanged through a trade", async () => {
    const store = createMemorySaveGameStore();
    const { saveId, state } = await createSave(store);
    const roster = state.world.teams[state.user.activeOwnerTeamId]!.roster;
    let traded = false;
    for (const playerId of roster) {
      const listed = await listOwnerTradeCandidates(saveId, playerId, store);
      if (!listed.ok || listed.candidates.length === 0) continue;
      const outcome = await executeOwnerTrade(
        saveId,
        {
          outgoingPlayerId: playerId,
          proposal: listed.candidates[0]!.proposal,
        },
        store,
      );
      expect(outcome.ok).toBe(true);
      traded = true;
      break;
    }
    expect(traded).toBe(true);
    const after = (await store.load(saveId))!.state;
    expect(after.world.playerPortraits).toEqual(state.world.playerPortraits);
  });

  it("does not write on ordinary page loads", async () => {
    const store = createMemorySaveGameStore();
    const { saveId } = await createSave(store);
    const before = (await store.load(saveId))!;
    await loadOwnerSaveView(saveId, store);
    const after = (await store.load(saveId))!;
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(after.state.world.playerPortraits).toEqual(
      before.state.world.playerPortraits,
    );
  });

  it("still creates and advances a save when portrait assignment fails, then recovers", async () => {
    portraitFailure.enabled = true;
    const store = createMemorySaveGameStore();
    const { saveId, state } = await createSave(store);
    expect(Object.keys(state.world.players).length).toBeGreaterThan(0);
    expect(state.world.playerPortraits).toEqual({});

    await enterDraftPreparation(store, saveId);
    const drafted = await resolveOwnerDraftClassDecision(
      saveId,
      { source: "generated" },
      store,
    );
    expect(drafted.ok).toBe(true);

    portraitFailure.enabled = false;
    const repaired = await repairPlayerPortraits(store);
    expect(repaired).toEqual([
      expect.objectContaining({ saveId, status: "repaired" }),
    ]);
    expectFullCoverage((await store.load(saveId))!.state);
  });

  it("repair backfills missing portraits deterministically and is re-runnable", async () => {
    const store = createMemorySaveGameStore();
    const { saveId, state } = await createSave(store);
    const original = state.world.playerPortraits;
    await store.save({
      id: saveId,
      state: { ...state, world: { ...state.world, playerPortraits: {} } },
    });

    const first = await repairPlayerPortraits(store);
    expect(first[0]).toMatchObject({ saveId, status: "repaired" });
    expect(first[0]!.assigned).toBe(Object.keys(original).length);
    const afterFirst = (await store.load(saveId))!;
    expect(afterFirst.state.world.playerPortraits).toEqual(original);

    const second = await repairPlayerPortraits(store);
    expect(second[0]).toMatchObject({
      saveId,
      status: "unchanged",
      assigned: 0,
    });
    const afterSecond = (await store.load(saveId))!;
    expect(afterSecond.updatedAt.getTime()).toBe(
      afterFirst.updatedAt.getTime(),
    );
  });
});

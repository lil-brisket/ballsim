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

/** Swappable shipped library: the real manifest is empty until art is approved. */
const shipped = vi.hoisted(() => ({
  library: [] as Array<
    import("@/domain/portrait-library").PortraitLibraryEntry
  >,
}));

vi.mock("@/systems/portraits/portrait-library", () => ({
  get PORTRAIT_LIBRARY() {
    return shipped.library;
  },
  isShippedPortraitLibraryId: (id: string) =>
    shipped.library.some((entry) => entry.id === id),
}));

import {
  createNewOwnerSave,
  executeOwnerTrade,
  listOwnerTradeCandidates,
  resolveOwnerDraftClassDecision,
} from "@/application/game-service";
import { repairPlayerPortraits } from "@/application/repair-player-portraits";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { GameState } from "@/state/game-state";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { getPortraitUsageReport } from "@/systems/portraits/assign-player-portraits";
import { setActivePhase } from "@/systems/phase-engine";
import { processPhaseEnter } from "@/systems/simulation/offseason-lifecycle";
import { TEST_RNG_SEED } from "../helpers/determinism";
import { makeTestLibrary } from "../factories/portrait-library";

type Store = ReturnType<typeof createMemorySaveGameStore>;

async function createSave(store: Store, rngSeed = TEST_RNG_SEED) {
  const created = await createNewOwnerSave(
    { name: "Library Save", settings: CBL_GAME_SETTINGS, rngSeed },
    store,
  );
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

function subjectIds(state: GameState): string[] {
  const ids = new Set(Object.keys(state.world.players));
  for (const draft of Object.values(state.world.drafts)) {
    for (const id of Object.keys(draft.prospects)) ids.add(id);
  }
  return [...ids];
}

describe("portrait library across the save lifecycle", () => {
  beforeEach(() => {
    shipped.library = makeTestLibrary(4000);
  });

  it("links every player in a fresh league to a library image, uniquely", async () => {
    const store = createMemorySaveGameStore();
    const { state } = await createSave(store);
    const ids = new Set(shipped.library.map((entry) => entry.id));
    for (const id of subjectIds(state)) {
      expect(ids.has(state.world.playerPortraits[id]?.libraryId ?? "")).toBe(
        true,
      );
    }
    const usage = getPortraitUsageReport(state, shipped.library);
    expect(usage.unlinked).toBe(0);
    expect(usage.sameTeamConflicts).toEqual([]);
    expect(usage.maxUses).toBe(1);
    expect(usage.sharedImages).toBe(0);
  });

  it("gives a generated draft class unique images and leaves veterans alone", async () => {
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
    const prospects = Object.keys(draft.prospects);
    expect(prospects.length).toBeGreaterThan(0);
    for (const id of prospects) {
      expect(after.world.playerPortraits[id]?.libraryId).toBeDefined();
    }
    const usage = getPortraitUsageReport(after, shipped.library);
    expect(usage.unlinked).toBe(0);
    expect(usage.maxUses).toBe(1);
    for (const [id, entry] of Object.entries(initial.world.playerPortraits)) {
      expect(after.world.playerPortraits[id]).toEqual(entry);
    }
  });

  it("migrates an existing save: faces stay, library ids are added and persisted by repair", async () => {
    shipped.library = [];
    const store = createMemorySaveGameStore();
    const { saveId, state: legacy } = await createSave(store);
    expect(
      Object.values(legacy.world.playerPortraits).every(
        (entry) => entry.libraryId === undefined,
      ),
    ).toBe(true);

    shipped.library = makeTestLibrary(4000);
    const [first] = await repairPlayerPortraits(store);
    expect(first).toMatchObject({ saveId, status: "repaired" });
    const migrated = (await store.load(saveId))!.state;
    for (const [id, before] of Object.entries(legacy.world.playerPortraits)) {
      const after = migrated.world.playerPortraits[id]!;
      expect(after.traits).toEqual(before.traits);
      expect(after.salt).toBe(before.salt);
      expect(after.libraryId).toBeDefined();
    }
    const [second] = await repairPlayerPortraits(store);
    expect(second).toMatchObject({ saveId, status: "unchanged" });
  });

  it("spreads portraits across every team without a same-team repeat", async () => {
    const store = createMemorySaveGameStore();
    const { state } = await createSave(store);
    const teams = Object.values(state.world.teams);
    expect(teams.length).toBeGreaterThan(1);
    const seen = new Set<string>();
    for (const team of teams) {
      const images = team.roster.map(
        (id) => state.world.playerPortraits[id]?.libraryId,
      );
      expect(images.every((image) => image !== undefined)).toBe(true);
      expect(new Set(images).size).toBe(images.length);
      for (const image of images) seen.add(image!);
    }
    expect(seen.size).toBeGreaterThan(teams[0]!.roster.length * 3);
  });

  it("reuses the least-used images after exhaustion, flags them, and never repeats on a team", async () => {
    const rosterSize = 20;
    shipped.library = makeTestLibrary(60);
    const store = createMemorySaveGameStore();
    const { state } = await createSave(store);
    expect(
      Math.max(...Object.values(state.world.teams).map((t) => t.roster.length)),
    ).toBeLessThanOrEqual(rosterSize);
    const active = Object.values(state.world.players).filter(
      (player) => player.retired !== true,
    );
    expect(active.length).toBeGreaterThan(shipped.library.length);

    const usage = getPortraitUsageReport(state, shipped.library);
    expect(usage.unlinked).toBe(0);
    expect(usage.sameTeamConflicts).toEqual([]);
    expect(usage.sharedImages).toBeGreaterThan(0);
    // Reuse is spread, not piled on a handful of images.
    expect(usage.maxUses).toBeLessThanOrEqual(
      Math.ceil((active.length * 3) / shipped.library.length),
    );
    // Every wearer of a shared image after the first is flagged.
    const flagged = Object.values(state.world.playerPortraits).filter(
      (entry) => entry.duplicate === true,
    ).length;
    expect(flagged).toBeGreaterThanOrEqual(
      usage.sharedSubjects - usage.sharedImages,
    );
  });

  it("keeps a traded player's portrait while the team changes", async () => {
    const store = createMemorySaveGameStore();
    const { saveId, state } = await createSave(store);
    const ownerTeam = state.user.activeOwnerTeamId;
    let tradedId: string | null = null;
    for (const playerId of state.world.teams[ownerTeam]!.roster) {
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
      tradedId = playerId;
      break;
    }
    expect(tradedId).not.toBeNull();
    const after = (await store.load(saveId))!.state;
    expect(after.world.players[tradedId!]!.teamId).not.toBe(ownerTeam);
    expect(selectPlayerPortrait(after, tradedId!)).toEqual(
      selectPlayerPortrait(state, tradedId!),
    );
    expect(after.world.playerPortraits).toEqual(state.world.playerPortraits);
  });
});

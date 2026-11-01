import { describe, expect, it } from "vitest";
import {
  isValidPortraitAssignment,
  type PlayerPortraitAssignment,
} from "@/domain/entities/player-portrait";
import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  derivePortraitTraits,
  ensurePlayerPortraits,
} from "@/systems/portraits/assign-player-portraits";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../../factories/game-state";

function bootstrappedState(saveId = "save_library"): GameState {
  const base = createTestGameState({ saveId });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function makeLibrary(count: number): PortraitLibraryEntry[] {
  return Array.from({ length: count }, (_, index) => {
    const {
      ears: _ears,
      accessory: _accessory,
      ...traits
    } = derivePortraitTraits("library", `entry_${index}`, 0);
    void _ears;
    void _accessory;
    const id = `p${String(index + 1).padStart(4, "0")}`;
    return { id, file: `${id}.webp`, traits };
  });
}

function activeEntries(state: GameState): PlayerPortraitAssignment[] {
  return Object.values(state.world.players)
    .filter((player) => player.retired !== true)
    .map((player) => state.world.playerPortraits[player.id]!)
    .filter(isValidPortraitAssignment);
}

describe("ensurePlayerPortraits with a library", () => {
  it("assigns no library ids while the library is empty", () => {
    const state = bootstrappedState();
    const { state: next } = ensurePlayerPortraits(state, { library: [] });
    for (const entry of Object.values(next.world.playerPortraits)) {
      expect(entry.libraryId).toBeUndefined();
    }
  });

  it("gives every new assignment a library image from the manifest", () => {
    const state = bootstrappedState();
    const library = makeLibrary(Object.keys(state.world.players).length * 3);
    const ids = new Set(library.map((entry) => entry.id));
    const result = ensurePlayerPortraits(state, { library });
    for (const entry of Object.values(result.state.world.playerPortraits)) {
      expect(isValidPortraitAssignment(entry)).toBe(true);
      expect(ids.has(entry.libraryId!)).toBe(true);
    }
  });

  it("prefers unused images: active players only share when flagged", () => {
    const state = bootstrappedState();
    const library = makeLibrary(Object.keys(state.world.players).length * 3);
    const { state: next } = ensurePlayerPortraits(state, { library });
    const entries = activeEntries(next);
    const unflagged = entries.filter((entry) => entry.duplicate !== true);
    expect(new Set(unflagged.map((entry) => entry.libraryId)).size).toBe(
      unflagged.length,
    );
  });

  it("is idempotent and deterministic", () => {
    const state = bootstrappedState();
    const library = makeLibrary(Object.keys(state.world.players).length * 2);
    const first = ensurePlayerPortraits(state, { library });
    const again = ensurePlayerPortraits(first.state, { library });
    expect(again.state).toBe(first.state);
    expect(again.assigned + again.resolved).toBe(0);
    const second = ensurePlayerPortraits(state, { library });
    expect(second.state.world.playerPortraits).toEqual(
      first.state.world.playerPortraits,
    );
  });

  it("shares images only when the pool is exhausted, and flags them", () => {
    const state = bootstrappedState();
    const players = Object.keys(state.world.players).length;
    const library = makeLibrary(3);
    expect(players).toBeGreaterThan(library.length);
    const result = ensurePlayerPortraits(state, { library });
    const ids = new Set(library.map((entry) => entry.id));
    const entries = activeEntries(result.state);
    for (const entry of entries) {
      expect(ids.has(entry.libraryId!)).toBe(true);
    }
    expect(result.duplicates).toBeGreaterThan(0);
    const flagged = entries.filter((entry) => entry.duplicate === true);
    expect(flagged.length).toBeGreaterThanOrEqual(entries.length - 3);
    // The shared pool is used evenly rather than piling onto one image.
    const counts = library.map(
      (lib) => entries.filter((entry) => entry.libraryId === lib.id).length,
    );
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(
      Math.ceil(entries.length / 3),
    );
  });

  it("resolves old assignments without changing their face", () => {
    const state = bootstrappedState();
    const legacy = ensurePlayerPortraits(state, { library: [] }).state;
    const library = makeLibrary(Object.keys(state.world.players).length * 2);
    const result = ensurePlayerPortraits(legacy, { library });
    expect(result.assigned).toBe(0);
    expect(result.resolved).toBe(Object.keys(state.world.players).length);
    for (const [id, before] of Object.entries(legacy.world.playerPortraits)) {
      const after = result.state.world.playerPortraits[id]!;
      expect(after.traits).toEqual(before.traits);
      expect(after.salt).toBe(before.salt);
      expect(after.libraryId).toBeDefined();
    }
    const again = ensurePlayerPortraits(result.state, { library });
    expect(again.state).toBe(result.state);
  });

  it("re-resolves only the entries whose image left the manifest", () => {
    const state = bootstrappedState();
    const library = makeLibrary(Object.keys(state.world.players).length * 3);
    const first = ensurePlayerPortraits(state, { library }).state;
    const [victimId, keeperId] = Object.keys(first.world.playerPortraits);
    const victim = first.world.playerPortraits[victimId!]!;
    const trimmed = library.filter((entry) => entry.id !== victim.libraryId);

    const second = ensurePlayerPortraits(first, { library: trimmed });
    const after = second.state.world.playerPortraits[victimId!]!;
    expect(second.resolved).toBeGreaterThanOrEqual(1);
    expect(after.traits).toEqual(victim.traits);
    expect(after.libraryId).not.toBe(victim.libraryId);
    expect(trimmed.some((entry) => entry.id === after.libraryId)).toBe(true);
    const keeper = first.world.playerPortraits[keeperId!]!;
    if (keeper.libraryId !== victim.libraryId) {
      expect(second.state.world.playerPortraits[keeperId!]).toBe(keeper);
    }
    expect(
      ensurePlayerPortraits(second.state, { library: trimmed }).state,
    ).toBe(second.state);
  });

  it("repairs an invalid entry and still assigns it an image", () => {
    const state = bootstrappedState();
    const library = makeLibrary(Object.keys(state.world.players).length * 2);
    const first = ensurePlayerPortraits(state, { library }).state;
    const [id] = Object.keys(first.world.playerPortraits);
    const broken: GameState = {
      ...first,
      world: {
        ...first.world,
        playerPortraits: {
          ...first.world.playerPortraits,
          [id!]: { version: 99 } as unknown as PlayerPortraitAssignment,
        },
      },
    };
    const repaired = ensurePlayerPortraits(broken, { library });
    expect(repaired.assigned).toBe(1);
    const entry = repaired.state.world.playerPortraits[id!]!;
    expect(isValidPortraitAssignment(entry)).toBe(true);
    expect(entry.libraryId).toBeDefined();
  });
});

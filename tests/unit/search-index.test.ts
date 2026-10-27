import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toSearchIndex } from "@/state/search-index";

function bootstrapped() {
  const state = createTestGameState({ saveId: "search_index_test" });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

describe("toSearchIndex", () => {
  it("lists every team and the active players", () => {
    const state = bootstrapped();
    const index = toSearchIndex(state);
    expect(index.teams).toHaveLength(Object.keys(state.world.teams).length);
    const active = Object.values(state.world.players).filter(
      (p) => p.retired !== true,
    );
    expect(index.players.length).toBeGreaterThan(0);
    expect(index.players.length).toBeLessThanOrEqual(active.length);
    for (const team of index.teams) {
      const source = state.world.teams[team.id]!;
      expect(team.name).toBe(`${source.city} ${source.name}`);
      expect(team.abbreviation).toBe(source.abbreviation);
    }
  });

  it("labels rostered players by team abbreviation", () => {
    const state = bootstrapped();
    const rostered = Object.values(state.world.players).find((p) => p.teamId)!;
    const abbreviation = state.world.teams[rostered.teamId!]!.abbreviation;
    const row = toSearchIndex(state).players.find((p) => p.id === rostered.id)!;
    expect(row.team).toBe(abbreviation);
    expect(row.name).toBe(`${rostered.firstName} ${rostered.lastName}`);
    expect(row.overall).toBeGreaterThan(0);
    expect(row.prospect).toBe(false);
  });

  it("skips retired players and sorts your team first, then by name", () => {
    const state = bootstrapped();
    const victim = Object.values(state.world.players)[0]!;
    const next = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [victim.id]: { ...victim, retired: true },
        },
      },
    };
    const index = toSearchIndex(next);
    expect(index.players.some((p) => p.id === victim.id)).toBe(false);
    for (let i = 1; i < index.players.length; i += 1) {
      const a = index.players[i - 1]!;
      const b = index.players[i]!;
      // Your players come first; each group is alphabetical.
      expect(Number(a.mine) >= Number(b.mine)).toBe(true);
      if (a.mine === b.mine) expect(a.name <= b.name).toBe(true);
    }
    expect(index.players[0]!.mine).toBe(true);
    expect(toSearchIndex(next)).toEqual(index);
  });

  it("lists draft prospects without revealing their rating", () => {
    const index = toSearchIndex(bootstrapped());
    for (const row of index.players.filter((p) => p.prospect)) {
      expect(row.team).toBe("Draft");
      expect(row.overall).toBeNull();
      expect(row.mine).toBe(false);
    }
  });
});

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
  });

  it("skips retired players and sorts by name then id", () => {
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
      expect(index.players[i - 1]!.name <= index.players[i]!.name).toBe(true);
    }
    expect(toSearchIndex(next)).toEqual(index);
  });
});

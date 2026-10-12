import { describe, expect, it } from "vitest";
import {
  createDraftProspect,
  createEmptyDraftClass,
  draftClassIdFor,
} from "@/domain/entities/draft";
import { asPlayerId } from "@/domain/ids";
import {
  isValidPortraitAssignment,
  PORTRAIT_TRAIT_CARDINALITY,
  PORTRAIT_TRAIT_KEYS,
  portraitTraitSignature,
  type PortraitTraitCardinality,
} from "@/domain/entities/player-portrait";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  derivePortraitTraits,
  ensurePlayerPortraits,
  getPortraitCapacityReport,
  PORTRAIT_MAX_SALT_PROBES,
} from "@/systems/portraits/assign-player-portraits";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../../factories/game-state";
import { createPlayer } from "../../factories/player";

function bootstrappedState(saveId = "save_portraits"): GameState {
  const base = createTestGameState({ saveId });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function withProspects(state: GameState, count: number): GameState {
  const year = state.competition.season.year;
  const draft = createEmptyDraftClass({
    id: draftClassIdFor(year),
    seasonYear: year,
  });
  const prospects: typeof draft.prospects = {};
  for (let index = 0; index < count; index += 1) {
    const prospect = createDraftProspect({
      player: createPlayer({
        id: asPlayerId(`prospect_test_${index}`),
        teamId: null,
        contractId: null,
      }),
      ranking: index + 1,
    });
    prospects[prospect.playerId] = prospect;
  }
  return {
    ...state,
    world: {
      ...state.world,
      drafts: { [draft.id]: { ...draft, prospects } },
    },
  };
}

const TINY: PortraitTraitCardinality = Object.fromEntries(
  PORTRAIT_TRAIT_KEYS.map((key) => [key, 1]),
) as PortraitTraitCardinality;

describe("derivePortraitTraits", () => {
  it("is deterministic and in range", () => {
    const a = derivePortraitTraits("save_a", "player_1", 0);
    expect(derivePortraitTraits("save_a", "player_1", 0)).toEqual(a);
    for (const key of PORTRAIT_TRAIT_KEYS) {
      expect(a[key]).toBeGreaterThanOrEqual(0);
      expect(a[key]).toBeLessThan(PORTRAIT_TRAIT_CARDINALITY[key]);
    }
  });

  it("varies by save and salt", () => {
    const base = portraitTraitSignature(derivePortraitTraits("s1", "p", 0));
    expect(portraitTraitSignature(derivePortraitTraits("s2", "p", 0))).not.toBe(
      base,
    );
    expect(portraitTraitSignature(derivePortraitTraits("s1", "p", 1))).not.toBe(
      base,
    );
  });
});

describe("ensurePlayerPortraits", () => {
  it("assigns a valid portrait to every player and prospect", () => {
    const state = withProspects(bootstrappedState(), 20);
    const result = ensurePlayerPortraits(state);
    const ids = [
      ...Object.keys(state.world.players),
      ...Object.keys(Object.values(state.world.drafts)[0]!.prospects),
    ];
    expect(ids.length).toBeGreaterThan(100);
    expect(result.assigned).toBe(ids.length);
    for (const id of ids) {
      expect(isValidPortraitAssignment(result.state.world.playerPortraits[id])).toBe(
        true,
      );
    }
  });

  it("gives active players unique faces", () => {
    const { state } = ensurePlayerPortraits(withProspects(bootstrappedState(), 40));
    const signatures = Object.values(state.world.playerPortraits).map((entry) =>
      portraitTraitSignature(entry.traits),
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it("is idempotent and returns the same reference when nothing is missing", () => {
    const first = ensurePlayerPortraits(bootstrappedState()).state;
    const second = ensurePlayerPortraits(first);
    expect(second.state).toBe(first);
    expect(second.assigned).toBe(0);
  });

  it("is reproducible for the same save", () => {
    const a = ensurePlayerPortraits(bootstrappedState()).state;
    const b = ensurePlayerPortraits(bootstrappedState()).state;
    expect(a.world.playerPortraits).toEqual(b.world.playerPortraits);
  });

  it("never overwrites a valid assignment and repairs invalid ones", () => {
    const assigned = ensurePlayerPortraits(bootstrappedState()).state;
    const [keepId, brokenId] = Object.keys(assigned.world.players);
    const custom = {
      ...assigned.world.playerPortraits[keepId!]!,
      salt: 99,
    };
    const tampered: GameState = {
      ...assigned,
      world: {
        ...assigned.world,
        playerPortraits: {
          ...assigned.world.playerPortraits,
          [keepId!]: custom,
          [brokenId!]: { version: 1, traits: { skinTone: 999 } } as never,
        },
      },
    };
    const repaired = ensurePlayerPortraits(tampered);
    expect(repaired.assigned).toBe(1);
    expect(repaired.state.world.playerPortraits[keepId!]).toBe(custom);
    expect(
      isValidPortraitAssignment(repaired.state.world.playerPortraits[brokenId!]),
    ).toBe(true);
  });

  it("does not change portraits when unrelated player data changes", () => {
    const assigned = ensurePlayerPortraits(bootstrappedState()).state;
    const playerId = Object.keys(assigned.world.players)[0]!;
    const player = assigned.world.players[playerId]!;
    const before = assigned.world.playerPortraits[playerId];
    const mutated: GameState = {
      ...assigned,
      world: {
        ...assigned.world,
        players: {
          ...assigned.world.players,
          [playerId]: {
            ...player,
            age: player.age + 5,
            teamId: null,
            contractId: null,
            firstName: "Renamed",
            retired: true,
          },
        },
      },
    };
    const after = ensurePlayerPortraits(mutated);
    expect(after.state).toBe(mutated);
    expect(after.state.world.playerPortraits[playerId]).toBe(before);
  });

  it("assigns only to newly added players", () => {
    const assigned = ensurePlayerPortraits(bootstrappedState()).state;
    const rookieId = asPlayerId("rookie_new_1");
    const withRookie: GameState = {
      ...assigned,
      world: {
        ...assigned.world,
        players: {
          ...assigned.world.players,
          [rookieId]: createPlayer({ id: rookieId, teamId: null, contractId: null }),
        },
      },
    };
    const result = ensurePlayerPortraits(withRookie);
    expect(result.assigned).toBe(1);
    for (const [id, entry] of Object.entries(assigned.world.playerPortraits)) {
      expect(result.state.world.playerPortraits[id]).toBe(entry);
    }
    expect(
      isValidPortraitAssignment(result.state.world.playerPortraits[rookieId]),
    ).toBe(true);
  });

  it("falls back to flagged duplicates when the trait space is exhausted", () => {
    const state = bootstrappedState();
    const result = ensurePlayerPortraits(state, { cardinality: TINY });
    const total = Object.keys(state.world.players).length;
    expect(result.assigned).toBe(total);
    expect(result.duplicates).toBe(total - 1);
    const flagged = Object.values(result.state.world.playerPortraits).filter(
      (entry) => entry.duplicate === true,
    );
    expect(flagged).toHaveLength(total - 1);
    expect(PORTRAIT_MAX_SALT_PROBES).toBeGreaterThan(1);
    const report = getPortraitCapacityReport(result.state, TINY);
    expect(report.capacity).toBe(1);
    expect(report.duplicates).toBe(total - 1);
    expect(report.activeMissing).toBe(0);
  });

  it("tolerates a legacy state with no registry", () => {
    const state = bootstrappedState();
    const legacy = {
      ...state,
      world: { ...state.world, playerPortraits: undefined },
    } as unknown as GameState;
    const result = ensurePlayerPortraits(legacy);
    expect(Object.keys(result.state.world.playerPortraits)).toHaveLength(
      Object.keys(state.world.players).length,
    );
  });
});

describe("getPortraitCapacityReport", () => {
  it("reports missing active players before assignment", () => {
    const state = bootstrappedState();
    const before = getPortraitCapacityReport(state);
    expect(before.activeAssigned).toBe(0);
    expect(before.activeMissing).toBe(Object.keys(state.world.players).length);
    const after = getPortraitCapacityReport(ensurePlayerPortraits(state).state);
    expect(after.activeMissing).toBe(0);
    expect(after.utilization).toBeLessThan(0.0001);
  });
});

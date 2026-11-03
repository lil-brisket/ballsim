import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  createPlayer,
  PLAYER_ATTRIBUTE_KEYS,
  PLAYER_POSITIONS,
  type Player,
  type PlayerAttributes,
} from "@/domain/entities/player";
import { createInitialGameState } from "@/state/create-initial-state";
import { ARCHETYPE_COMPATIBLE_POSITIONS } from "@/domain/entities/player-archetype";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { generatePlayer } from "@/systems/player-generation";
import { POSITION_BODY_RANGES } from "@/systems/player-generation-config";
import {
  PAIR_OVERALL_BASELINE,
  SECONDARY_POSITION_CONFIG,
  gainSecondaryPosition,
  secondaryPositionFor,
} from "@/systems/player-secondary-position";
import { processSeasonPlayerDevelopment } from "@/systems/season-player-development";
import { bootstrapWorld } from "@/systems/world-pipeline";

const POPULATION = 1500;

function population(): Player[] {
  return Array.from({ length: POPULATION }, (_, index) =>
    generatePlayer(`secondary_${index}`),
  );
}

describe("secondary position rule", () => {
  it("gives a minority of generated players a secondary, never equal to the primary", () => {
    const players = population();
    const withSecondary = players.filter((p) => p.secondaryPosition);
    const share = withSecondary.length / players.length;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.25);
    for (const player of withSecondary) {
      expect(player.secondaryPosition).not.toBe(player.position);
    }
  });

  it("only offers positions that suit the archetype and fit the body", () => {
    for (const player of population()) {
      if (player.secondaryPosition === undefined) continue;
      expect(ARCHETYPE_COMPATIBLE_POSITIONS[player.archetype]).toContain(
        player.secondaryPosition,
      );
      const range = POSITION_BODY_RANGES[player.secondaryPosition];
      expect(player.heightInches).toBeGreaterThanOrEqual(range.minHeightInches);
      expect(player.heightInches).toBeLessThanOrEqual(range.maxHeightInches);
      expect(player.weightPounds).toBeGreaterThanOrEqual(range.minWeightPounds);
      expect(player.weightPounds).toBeLessThanOrEqual(range.maxWeightPounds);
    }
  });

  it("spreads across every primary position and never pairs PG with C", () => {
    const players = population();
    for (const position of PLAYER_POSITIONS) {
      const group = players.filter((p) => p.position === position);
      const share =
        group.filter((p) => p.secondaryPosition).length / group.length;
      expect(share, position).toBeGreaterThan(0.02);
      expect(share, position).toBeLessThan(0.35);
    }
    expect(
      players.filter(
        (p) =>
          (p.position === "PG" && p.secondaryPosition === "C") ||
          (p.position === "C" && p.secondaryPosition === "PG"),
      ),
    ).toHaveLength(0);
  });

  it("never gives a Floor General a secondary", () => {
    const generals = population().filter(
      (p) => p.archetype === "floor_general",
    );
    expect(generals.length).toBeGreaterThan(0);
    for (const player of generals) {
      expect(player.secondaryPosition).toBeUndefined();
    }
  });

  it("keeps the baseline table in line with generated players", () => {
    const sample = population();
    for (const from of PLAYER_POSITIONS) {
      const group = sample.filter((p) => p.position === from);
      for (const to of PLAYER_POSITIONS) {
        if (to === from) continue;
        const deltas = group
          .map(
            (p) =>
              calculatePlayerOverall(to, p.attributes) -
              calculatePlayerOverall(from, p.attributes),
          )
          .sort((x, y) => x - y);
        const median = deltas[Math.floor(deltas.length / 2)]!;
        expect(
          Math.abs(median - PAIR_OVERALL_BASELINE[from][to]),
          `${from}>${to}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic and draws no RNG", () => {
    const player = population().find((p) => p.secondaryPosition)!;
    expect(secondaryPositionFor(player)).toBe(player.secondaryPosition);
    expect(secondaryPositionFor(player)).toBe(secondaryPositionFor(player));
  });
});

describe("gainSecondaryPosition", () => {
  it("returns the same player when he already has one", () => {
    const player = population().find((p) => p.secondaryPosition)!;
    expect(gainSecondaryPosition(player)).toBe(player);
  });

  it("returns the same player when none qualifies", () => {
    const player = population().find((p) => !p.secondaryPosition)!;
    expect(gainSecondaryPosition(player)).toBe(player);
  });

  it("adds the secondary a player now qualifies for and keeps everything else", () => {
    const source = population().find(
      (p) =>
        p.secondaryPosition !== undefined &&
        secondaryPositionFor(p, SECONDARY_POSITION_CONFIG.gainOverallEdge) !==
          undefined,
    )!;
    const { secondaryPosition, ...rest } = source;
    const without = createPlayer({ ...rest });
    expect(without.secondaryPosition).toBeUndefined();
    const gained = gainSecondaryPosition(without);
    expect(gained.secondaryPosition).toBe(
      secondaryPositionFor(without, SECONDARY_POSITION_CONFIG.gainOverallEdge),
    );
    expect({ ...gained, secondaryPosition: undefined }).toEqual({
      ...without,
      secondaryPosition: undefined,
    });
    expect(secondaryPosition).toBeDefined();
  });

  it("asks for a bigger edge than generation does", () => {
    const borderline = population().find(
      (p) =>
        p.secondaryPosition !== undefined &&
        secondaryPositionFor(p, SECONDARY_POSITION_CONFIG.gainOverallEdge) ===
          undefined,
    )!;
    expect(borderline).toBeDefined();
    const { secondaryPosition, ...rest } = borderline;
    const without = createPlayer({ ...rest });
    expect(secondaryPosition).toBeDefined();
    expect(gainSecondaryPosition(without)).toBe(without);
  });
});

describe("secondary position through yearly development", () => {
  function bootstrapped() {
    let state = createInitialGameState({
      saveId: "secondary_dev",
      rngSeed: 211,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    return state;
  }

  it("never removes a secondary, even when the ratings collapse", () => {
    const state = bootstrapped();
    const player = Object.values(state.world.players).find(
      (p) => p.secondaryPosition !== undefined && p.retired !== true,
    )!;
    const collapsed = Object.fromEntries(
      PLAYER_ATTRIBUTE_KEYS.map((key) => [key, 20]),
    ) as PlayerAttributes;
    const weak = createPlayer({ ...player, attributes: collapsed });
    const next = processSeasonPlayerDevelopment(
      {
        ...state,
        world: {
          ...state.world,
          players: { ...state.world.players, [weak.id]: weak },
        },
      },
      createSeededRng(9),
    ).state.world.players[weak.id]!;
    expect(next.secondaryPosition).toBe(player.secondaryPosition);
  });

  it("only ever adds secondaries across a season", () => {
    const state = bootstrapped();
    const next = processSeasonPlayerDevelopment(state, createSeededRng(9));
    for (const before of Object.values(state.world.players)) {
      const after = next.state.world.players[before.id]!;
      if (before.secondaryPosition !== undefined) {
        expect(after.secondaryPosition).toBe(before.secondaryPosition);
      }
      expect(after.secondaryPosition).not.toBe(after.position);
    }
  });
});

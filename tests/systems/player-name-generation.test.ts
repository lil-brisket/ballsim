import { describe, expect, it } from "vitest";
import { FIRST_NAMES } from "@/data/names/first-names";
import { LAST_NAMES } from "@/data/names/last-names";
import {
  isPlayerNationality,
  PLAYER_NATIONALITIES,
  type PlayerNationality,
} from "@/domain/entities/player-nationality";
import type { Rng } from "@/domain/rng";
import { createSeededRng } from "@/domain/rng";
import {
  generatePlayerName,
  type PlayerNamePools,
} from "@/systems/player-name-generation";

function createIndexRng(indexes: number[]): Rng {
  let call = 0;
  const nextInt = (): number => {
    const value = indexes[call];
    if (value === undefined) {
      throw new Error(`Unexpected nextInt call at index ${call}.`);
    }
    call += 1;
    return value;
  };
  return {
    next(): number {
      return 0;
    },
    nextInt,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("Rng.pick requires a non-empty list.");
      }
      return items[nextInt()]!;
    },
    chance(): boolean {
      return nextInt() === 0;
    },
    getState(): number {
      return call;
    },
  };
}

const TINY_POOLS: PlayerNamePools = {
  firstNames: ["Alpha", "Beta", "Gamma"],
  lastNames: ["One", "Two", "Three"],
  nationalities: ["USA", "Canada", "Spain"],
};

describe("generatePlayerName", () => {
  it("returns non-empty firstName, lastName, and a valid nationality", () => {
    const name = generatePlayerName(createSeededRng(42));
    expect(name.firstName.length).toBeGreaterThan(0);
    expect(name.lastName.length).toBeGreaterThan(0);
    expect(name.firstName.trim()).toBe(name.firstName);
    expect(name.lastName.trim()).toBe(name.lastName);
    expect(isPlayerNationality(name.nationality)).toBe(true);
  });

  it("selects values from the configured pools", () => {
    const name = generatePlayerName(createIndexRng([1, 2, 0]), TINY_POOLS);
    expect(name.firstName).toBe("Beta");
    expect(name.lastName).toBe("Three");
    expect(name.nationality).toBe("USA");
  });

  it("can select the first and last valid indexes", () => {
    const first = generatePlayerName(createIndexRng([0, 0, 0]), TINY_POOLS);
    expect(first).toEqual({
      firstName: "Alpha",
      lastName: "One",
      nationality: "USA",
    });

    const last = generatePlayerName(createIndexRng([2, 2, 2]), TINY_POOLS);
    expect(last).toEqual({
      firstName: "Gamma",
      lastName: "Three",
      nationality: "Spain",
    });
  });

  it("does not mutate pools across repeated generation", () => {
    const firstNames = ["Alpha", "Beta"];
    const lastNames = ["One", "Two"];
    const nationalities: PlayerNationality[] = ["USA", "Canada"];
    const pools: PlayerNamePools = { firstNames, lastNames, nationalities };
    const snapshot = {
      firstNames: [...firstNames],
      lastNames: [...lastNames],
      nationalities: [...nationalities],
    };

    const rng = createSeededRng(7);
    for (let i = 0; i < 20; i += 1) {
      const name = generatePlayerName(rng, pools);
      expect(pools.firstNames).toContain(name.firstName);
      expect(pools.lastNames).toContain(name.lastName);
      expect(pools.nationalities).toContain(name.nationality);
    }

    expect(firstNames).toEqual(snapshot.firstNames);
    expect(lastNames).toEqual(snapshot.lastNames);
    expect(nationalities).toEqual(snapshot.nationalities);
  });

  it("rejects empty pools", () => {
    expect(() =>
      generatePlayerName(createIndexRng([0]), {
        firstNames: [],
        lastNames: ["One"],
        nationalities: ["USA"],
      }),
    ).toThrow(/firstNames/);

    expect(() =>
      generatePlayerName(createIndexRng([0, 0]), {
        firstNames: ["Alpha"],
        lastNames: [],
        nationalities: ["USA"],
      }),
    ).toThrow(/lastNames/);

    expect(() =>
      generatePlayerName(createIndexRng([0, 0, 0]), {
        firstNames: ["Alpha"],
        lastNames: ["One"],
        nationalities: [],
      }),
    ).toThrow(/nationalities/);
  });

  it("rejects empty or whitespace-only name entries", () => {
    expect(() =>
      generatePlayerName(createIndexRng([0]), {
        firstNames: [""],
        lastNames: ["One"],
        nationalities: ["USA"],
      }),
    ).toThrow(/empty name/);

    expect(() =>
      generatePlayerName(createIndexRng([0, 0]), {
        firstNames: ["Alpha"],
        lastNames: ["   "],
        nationalities: ["USA"],
      }),
    ).toThrow(/whitespace-only/);
  });

  it("rejects invalid nationality pool entries", () => {
    expect(() =>
      generatePlayerName(createIndexRng([0, 0, 0]), {
        firstNames: ["Alpha"],
        lastNames: ["One"],
        nationalities: ["Atlantis" as PlayerNationality],
      }),
    ).toThrow(/invalid nationality/);
  });
});

describe("name data pools", () => {
  it("contains no duplicate first or last names", () => {
    expect(new Set(FIRST_NAMES).size).toBe(FIRST_NAMES.length);
    expect(new Set(LAST_NAMES).size).toBe(LAST_NAMES.length);
  });

  it("default pools include enough variety for roster generation", () => {
    expect(FIRST_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(LAST_NAMES.length).toBeGreaterThanOrEqual(60);
    expect(PLAYER_NATIONALITIES.length).toBeGreaterThan(0);
  });
});

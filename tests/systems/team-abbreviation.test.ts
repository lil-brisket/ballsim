import { describe, expect, it } from "vitest";
import { getTeamCitiesForArea } from "@/data/league/team-cities-by-area";
import { LEAGUE_AREA_LABELS, type LeagueArea } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { uniqueTeamAbbreviation } from "@/systems/team-abbreviation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

const LETTERS_ONLY = /^[A-Z]{3}$/;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function assignAll(cities: readonly string[]): string[] {
  const used = new Set<string>();
  return cities.map((city) => {
    const abbreviation = uniqueTeamAbbreviation(city, used);
    used.add(abbreviation);
    return abbreviation;
  });
}

describe("uniqueTeamAbbreviation", () => {
  it("derives a 3-letter base from the city", () => {
    expect(uniqueTeamAbbreviation("Los Angeles", new Set())).toBe("LOS");
    expect(uniqueTeamAbbreviation("Toronto", new Set())).toBe("TOR");
  });

  it("pads short letter sequences", () => {
    expect(uniqueTeamAbbreviation("LA", new Set())).toBe("LAX");
  });

  it("falls back to later consonants for a one-word city", () => {
    expect(uniqueTeamAbbreviation("Toronto", new Set(["TOR"]))).toBe("TRN");
    expect(uniqueTeamAbbreviation("Toronto", new Set(["TOR", "TRN"]))).toBe(
      "TRT",
    );
  });

  it("uses word initials for a multi-word city", () => {
    const used = new Set(["NEW", "SAN"]);
    expect(uniqueTeamAbbreviation("New Orleans", used)).toBe("NOS");
    expect(uniqueTeamAbbreviation("New York", used)).toBe("NYK");
    expect(uniqueTeamAbbreviation("San Francisco", used)).toBe("SFO");
    expect(uniqueTeamAbbreviation("Mar del Plata", new Set(["MAR"]))).toBe(
      "MDP",
    );
  });

  it("tries the first two letters plus A–Z before any digit", () => {
    // "Ada" has no letter candidates beyond its base.
    expect(uniqueTeamAbbreviation("Ada", new Set(["ADA"]))).toBe("ADB");
    const lettersTaken = new Set([...ALPHABET].map((c) => `AD${c}`));
    expect(uniqueTeamAbbreviation("Ada", lettersTaken)).toBe("AD0");
  });

  it("fails deterministically when namespace is exhausted", () => {
    const used = new Set<string>();
    for (const c of ALPHABET) used.add(`AD${c}`);
    for (let digit = 0; digit < 10; digit += 1) used.add(`AD${digit}`);
    expect(() => uniqueTeamAbbreviation("Ada", used)).toThrow(
      /unique abbreviation/,
    );
  });

  it("gives every city in every league area a letters-only abbreviation", () => {
    for (const area of Object.keys(LEAGUE_AREA_LABELS) as LeagueArea[]) {
      const cities = getTeamCitiesForArea(area);
      for (const order of [cities, [...cities].reverse()]) {
        const abbreviations = assignAll(order);
        expect(abbreviations.filter((a) => !LETTERS_ONLY.test(a))).toEqual([]);
        expect(new Set(abbreviations).size).toBe(abbreviations.length);
      }
    }
  });

  it("generates a new league with letters-only abbreviations", () => {
    const base = createTestGameState({ saveId: "abbr_league" });
    const state = bootstrapWorld(
      base,
      createSeededRng(base.meta.rngState),
    ).state;
    const abbreviations = Object.values(state.world.teams).map(
      (team) => team.abbreviation,
    );
    expect(abbreviations.filter((a) => !LETTERS_ONLY.test(a))).toEqual([]);
  });
});

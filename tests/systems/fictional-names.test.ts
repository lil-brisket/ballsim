import { describe, expect, it } from "vitest";
import {
  firstFictionalNickname,
  isReservedTeamName,
} from "@/data/league/reserved-team-names";
import { TEAM_NICKNAMES } from "@/data/league/team-nicknames";
import { FIRST_NAMES } from "@/data/names/first-names";
import { LAST_NAMES } from "@/data/names/last-names";
import {
  isReservedPlayerName,
  RESERVED_PLAYER_NAMES,
} from "@/data/names/reserved-player-names";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { PLAYER_NATIONALITIES } from "@/domain/entities/player-nationality";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { withoutReservedPairs } from "@/systems/league-generation";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import { randomizeTeamIdentityDraft } from "@/systems/owner-franchise-branding";
import { generatePlayerName } from "@/systems/player-name-generation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { TEST_RNG_SEED } from "../helpers/determinism";

/** Current and former NBA/WNBA nicknames; none may be in the generated pool. */
const BASKETBALL_NICKNAMES = [
  "Hawks",
  "Celtics",
  "Nets",
  "Hornets",
  "Bulls",
  "Cavaliers",
  "Mavericks",
  "Nuggets",
  "Pistons",
  "Warriors",
  "Rockets",
  "Pacers",
  "Clippers",
  "Lakers",
  "Grizzlies",
  "Heat",
  "Bucks",
  "Timberwolves",
  "Wolves",
  "Pelicans",
  "Knicks",
  "Thunder",
  "Magic",
  "76ers",
  "Suns",
  "Blazers",
  "Trail Blazers",
  "Kings",
  "Spurs",
  "Raptors",
  "Jazz",
  "Wizards",
  "SuperSonics",
  "Bobcats",
  "Braves",
  "Bullets",
  "Dream",
  "Sky",
  "Sun",
  "Wings",
  "Valkyries",
  "Fever",
  "Aces",
  "Sparks",
  "Lynx",
  "Liberty",
  "Mercury",
  "Fire",
  "Storm",
  "Tempo",
  "Mystics",
  "Comets",
  "Monarchs",
  "Shock",
  "Sting",
  "Rockers",
  "Sol",
  "Starzz",
  "Miracle",
];

function teamNames(state: GameState): string[] {
  return Object.values(state.world.teams).map((t) => `${t.city} ${t.name}`);
}

describe("fictional team names", () => {
  it("keeps NBA and WNBA nicknames out of the generated pool", () => {
    const pool = new Set<string>(TEAM_NICKNAMES);
    expect(BASKETBALL_NICKNAMES.filter((name) => pool.has(name))).toEqual([]);
  });

  it("re-pairs a real city + nickname without touching other teams", () => {
    const cities = ["Calgary", "Boston", "Denver"];
    const nicknames = withoutReservedPairs(cities, [
      "Flames",
      "Harriers",
      "Fury",
    ]);
    expect(nicknames).toEqual(["Harriers", "Flames", "Fury"]);
    expect(
      cities.some((city, i) => isReservedTeamName(city, nicknames[i]!)),
    ).toBe(false);
  });

  it("never generates a real team across seeds", () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const base = createTestGameState({
        saveId: `fictional_${seed}`,
        rngSeed: seed,
      });
      const state = bootstrapWorld(
        base,
        createSeededRng(base.meta.rngState),
      ).state;
      const real = Object.values(state.world.teams).filter((t) =>
        isReservedTeamName(t.city, t.name),
      );
      expect(real.map((t) => `${t.city} ${t.name}`)).toEqual([]);
    }
  });

  it("renames the owner's team when the chosen city would make it real", () => {
    const settings = cloneGameSettings(CBL_GAME_SETTINGS);
    settings.league.area = "north_america";
    const initial = createInitialGameState({
      saveId: "fictional_city_pick",
      rngSeed: TEST_RNG_SEED,
      settings,
    });
    const placeholderId = initial.user.activeOwnerTeamId;
    const state: GameState = {
      ...initial,
      world: {
        ...initial.world,
        teams: {
          ...initial.world.teams,
          [placeholderId]: {
            ...initial.world.teams[placeholderId]!,
            name: "Flames",
          },
        },
      },
    };

    const result = applyOwnerCitySelection(state, "Calgary");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const team = result.state.world.teams[placeholderId]!;
    expect(team.city).toBe("Calgary");
    expect(team.name).not.toBe("Flames");
    expect(isReservedTeamName(team.city, team.name)).toBe(false);
    const others = Object.values(result.state.world.teams)
      .filter((t) => t.id !== placeholderId)
      .map((t) => t.name);
    expect(others).not.toContain(team.name);
    expect(
      teamNames(result.state).filter((n) => n === "Calgary Flames"),
    ).toEqual([]);
  });

  it("never suggests a real team from Randomize", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const next = randomizeTeamIdentityDraft({
        currentNickname: "Harriers",
        currentPaletteId: null,
        currentLogoId: "shield",
        usedNicknames: [],
        city: "Calgary",
        rng: createSeededRng(seed),
      });
      expect(isReservedTeamName("Calgary", next.nickname)).toBe(false);
    }
  });

  it("finds a fictional replacement nickname in pool order", () => {
    expect(
      firstFictionalNickname("Calgary", ["Flames", "Fury"], new Set()),
    ).toBe("Fury");
    expect(
      firstFictionalNickname("Calgary", ["Flames", "Fury"], new Set(["Fury"])),
    ).toBeNull();
  });
});

describe("fictional player names", () => {
  it("lists only names the pools can actually form", () => {
    const first = new Set<string>(FIRST_NAMES);
    const last = new Set<string>(LAST_NAMES);
    for (const fullName of RESERVED_PLAYER_NAMES) {
      const [firstName, lastName] = fullName.split(" ");
      expect(first.has(firstName!) && last.has(lastName!), fullName).toBe(true);
    }
  });

  it("swaps the last name of a reserved draw", () => {
    const pools = {
      firstNames: ["Blake"],
      lastNames: ["Griffin", "Stone"],
      nationalities: PLAYER_NATIONALITIES,
    };
    for (let seed = 1; seed <= 20; seed += 1) {
      const name = generatePlayerName(createSeededRng(seed), pools);
      expect(name.firstName).toBe("Blake");
      expect(name.lastName).toBe("Stone");
    }
  });

  it("never generates a reserved name from the default pools", () => {
    const rng = createSeededRng(9);
    for (let i = 0; i < 5000; i += 1) {
      const { firstName, lastName } = generatePlayerName(rng);
      expect(isReservedPlayerName(firstName, lastName)).toBe(false);
    }
  });
});

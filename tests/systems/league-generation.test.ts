import { describe, expect, it, vi } from "vitest";
import { CONFERENCE_NAMES } from "@/data/league/conference-names";
import { DIVISION_NAMES } from "@/data/league/division-names";
import {
  EUROPE_TEAM_CITIES,
  getTeamCitiesForArea,
  GLOBAL_TEAM_CITIES,
  NORTH_AMERICA_TEAM_CITIES,
} from "@/data/league/team-cities-by-area";
import { TEAM_NICKNAMES } from "@/data/league/team-nicknames";
import type { LeagueArea } from "@/domain/game-settings";
import {
  isArchetypeCompatible,
  isPlayerArchetype,
} from "@/domain/entities/player-archetype";
import { isPlayerNationality } from "@/domain/entities/player-nationality";
import {
  PLAYER_ATTRIBUTE_KEYS,
  PLAYER_POSITIONS,
  RATING_MAX,
  RATING_MIN,
  type Player,
} from "@/domain/entities/player";
import { createSeededRng } from "@/domain/rng";
import {
  deriveLeagueAbbreviation,
  generateLeague,
  type LeagueGenerationConfig,
} from "@/systems/league-generation";
import { rosterPositionForSlot } from "@/systems/roster-generation-config";

const BASE_CONFIG: LeagueGenerationConfig = {
  leagueName: "Continental Basketball League",
  conferenceCount: 2,
  divisionsPerConference: 3,
  teamsPerDivision: 5,
  rosterSize: 12,
};

const LEAGUE_AREAS: readonly LeagueArea[] = [
  "north_america",
  "europe",
  "africa",
  "asia",
  "south_america",
  "global",
];

function config(
  overrides: Partial<LeagueGenerationConfig> = {},
): LeagueGenerationConfig {
  return { ...BASE_CONFIG, ...overrides };
}

describe("league generation", () => {
  describe("structure", () => {
    it("generates 2×3×5×12 → 2 conferences, 6 divisions, 30 teams, 360 players", () => {
      const generated = generateLeague(config(), createSeededRng(42));

      expect(generated.conferences).toHaveLength(2);
      expect(generated.divisions).toHaveLength(6);
      expect(generated.teams).toHaveLength(30);
      expect(generated.players).toHaveLength(360);
      expect(generated.league.conferenceIds).toHaveLength(2);
    });

    it.each([
      { conferenceCount: 1, divisionsPerConference: 1, teamsPerDivision: 1, rosterSize: 10 },
      { conferenceCount: 2, divisionsPerConference: 2, teamsPerDivision: 3, rosterSize: 10 },
      { conferenceCount: 2, divisionsPerConference: 3, teamsPerDivision: 5, rosterSize: 10 },
    ])(
      "supports league size $conferenceCount×$divisionsPerConference×$teamsPerDivision",
      (size) => {
        const generated = generateLeague(config(size), createSeededRng(7));
        const expectedDivisions =
          size.conferenceCount * size.divisionsPerConference;
        const expectedTeams = expectedDivisions * size.teamsPerDivision;
        const expectedPlayers = expectedTeams * size.rosterSize;

        expect(generated.conferences).toHaveLength(size.conferenceCount);
        expect(generated.divisions).toHaveLength(expectedDivisions);
        expect(generated.teams).toHaveLength(expectedTeams);
        expect(generated.players).toHaveLength(expectedPlayers);

        for (const conference of generated.conferences) {
          expect(conference.divisionIds).toHaveLength(
            size.divisionsPerConference,
          );
        }
        for (const division of generated.divisions) {
          expect(division.teamIds).toHaveLength(size.teamsPerDivision);
        }
        for (const team of generated.teams) {
          expect(team.roster).toHaveLength(size.rosterSize);
        }
      },
    );
  });

  describe("relationships", () => {
    it("links conferences, divisions, teams, and players without orphans", () => {
      const generated = generateLeague(config(), createSeededRng(99));

      const conferenceIds = new Set(generated.conferences.map((c) => c.id));
      const divisionIds = new Set(generated.divisions.map((d) => d.id));
      const teamIds = new Set(generated.teams.map((t) => t.id));
      const playerIds = new Set(generated.players.map((p) => p.id));

      expect(generated.league.conferenceIds).toEqual(
        generated.conferences.map((c) => c.id),
      );

      for (const conference of generated.conferences) {
        expect(conference.leagueId).toBe(generated.league.id);
        for (const divisionId of conference.divisionIds) {
          expect(divisionIds.has(divisionId)).toBe(true);
        }
      }

      for (const division of generated.divisions) {
        expect(conferenceIds.has(division.conferenceId)).toBe(true);
        for (const teamId of division.teamIds) {
          expect(teamIds.has(teamId)).toBe(true);
        }
      }

      for (const team of generated.teams) {
        expect(divisionIds.has(team.divisionId)).toBe(true);
        expect(conferenceIds.has(team.conferenceId)).toBe(true);
        for (const playerId of team.roster) {
          expect(playerIds.has(playerId)).toBe(true);
        }
      }

      for (const player of generated.players) {
        expect(player.teamId).not.toBeNull();
        expect(teamIds.has(player.teamId!)).toBe(true);
      }
    });

    it("assigns each player to exactly one team roster", () => {
      const generated = generateLeague(config(), createSeededRng(11));
      const ownerCounts = new Map<string, number>();

      for (const team of generated.teams) {
        for (const playerId of team.roster) {
          ownerCounts.set(playerId, (ownerCounts.get(playerId) ?? 0) + 1);
        }
      }

      expect(ownerCounts.size).toBe(generated.players.length);
      for (const player of generated.players) {
        expect(ownerCounts.get(player.id)).toBe(1);
        expect(player.teamId).not.toBeNull();
        const team = generated.teams.find((t) => t.id === player.teamId);
        expect(team?.roster).toContain(player.id);
      }
    });

    it("produces unique ids across the hierarchy", () => {
      const generated = generateLeague(config(), createSeededRng(3));
      const allIds = [
        generated.league.id,
        ...generated.conferences.map((c) => c.id),
        ...generated.divisions.map((d) => d.id),
        ...generated.teams.map((t) => t.id),
        ...generated.players.map((p) => p.id),
      ];
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it("uses unique cities and nicknames for every team", () => {
      const generated = generateLeague(config(), createSeededRng(5));
      const cities = generated.teams.map((team) => team.city);
      const nicknames = generated.teams.map((team) => team.name);
      expect(new Set(cities).size).toBe(cities.length);
      expect(new Set(nicknames).size).toBe(nicknames.length);
    });
  });

  describe("determinism", () => {
    it("produces identical leagues for the same seed", () => {
      const first = generateLeague(config(), createSeededRng(42));
      const second = generateLeague(config(), createSeededRng(42));
      expect(first).toEqual(second);
    });

    it("normally produces different leagues for different seeds", () => {
      const first = generateLeague(config(), createSeededRng(1));
      const second = generateLeague(config(), createSeededRng(2));
      expect(first).not.toEqual(second);
    });

    it("is stable across repeated generation with fresh RNGs from the same seed", () => {
      const results = Array.from({ length: 3 }, () =>
        generateLeague(config({ rosterSize: 5 }), createSeededRng(123)),
      );
      expect(results[1]).toEqual(results[0]);
      expect(results[2]).toEqual(results[0]);
    });

    it("does not call Math.random or Date.now", () => {
      const randomSpy = vi.spyOn(Math, "random");
      const dateSpy = vi.spyOn(Date, "now");

      generateLeague(config({ rosterSize: 4 }), createSeededRng(55));

      expect(randomSpy).not.toHaveBeenCalled();
      expect(dateSpy).not.toHaveBeenCalled();

      randomSpy.mockRestore();
      dateSpy.mockRestore();
    });
  });

  describe("invalid configuration", () => {
    it.each([
      { field: "conferenceCount", value: 0 },
      { field: "conferenceCount", value: -1 },
      { field: "conferenceCount", value: 1.5 },
      { field: "divisionsPerConference", value: 0 },
      { field: "divisionsPerConference", value: -2 },
      { field: "teamsPerDivision", value: 0 },
      { field: "teamsPerDivision", value: -3 },
      { field: "rosterSize", value: -1 },
    ] as const)("rejects invalid $field=$value", ({ field, value }) => {
      expect(() =>
        generateLeague(config({ [field]: value }), createSeededRng(1)),
      ).toThrow(/League generation/);
    });

    it("allows rosterSize 0 for empty-roster hierarchy generation", () => {
      const generated = generateLeague(
        config({ rosterSize: 0 }),
        createSeededRng(1),
      );
      expect(generated.players).toHaveLength(0);
      expect(generated.teams.every((team) => team.roster.length === 0)).toBe(
        true,
      );
    });

    it("rejects empty league name", () => {
      expect(() =>
        generateLeague(config({ leagueName: "" }), createSeededRng(1)),
      ).toThrow(/leagueName must be a non-empty string/);
    });

    it("rejects whitespace-only league name", () => {
      expect(() =>
        generateLeague(config({ leagueName: "   " }), createSeededRng(1)),
      ).toThrow(/leagueName cannot be whitespace-only/);
    });

    it("rejects empty leagueId when provided", () => {
      expect(() =>
        generateLeague(config({ leagueId: "" }), createSeededRng(1)),
      ).toThrow(/leagueId must be a non-empty string/);
    });
  });

  describe("pool exhaustion", () => {
    it("throws when requesting more conferences than available names", () => {
      expect(() =>
        generateLeague(
          config({
            conferenceCount: CONFERENCE_NAMES.length + 1,
            divisionsPerConference: 1,
            teamsPerDivision: 1,
            rosterSize: 1,
          }),
          createSeededRng(1),
        ),
      ).toThrow(/conference name pool exhausted/);
    });

    it("throws when requesting more divisions per conference than available names", () => {
      expect(() =>
        generateLeague(
          config({
            conferenceCount: 1,
            divisionsPerConference: DIVISION_NAMES.length + 1,
            teamsPerDivision: 1,
            rosterSize: 1,
          }),
          createSeededRng(1),
        ),
      ).toThrow(/division name pool exhausted/);
    });

    it("throws when requesting more teams than unique cities", () => {
      const cityPool = getTeamCitiesForArea("europe");
      expect(() =>
        generateLeague(
          config({
            conferenceCount: 1,
            divisionsPerConference: 1,
            teamsPerDivision: cityPool.length + 1,
            rosterSize: 1,
            leagueArea: "europe",
          }),
          createSeededRng(1),
        ),
      ).toThrow(
        new RegExp(
          `Cannot generate ${cityPool.length + 1} teams for league area "europe": only ${cityPool.length} cities are available`,
        ),
      );
    });

    it("throws when requesting more teams than unique nicknames", () => {
      const cityPool = getTeamCitiesForArea("north_america");
      expect(TEAM_NICKNAMES.length).toBeLessThan(cityPool.length);
      expect(() =>
        generateLeague(
          config({
            conferenceCount: 1,
            divisionsPerConference: 1,
            teamsPerDivision: TEAM_NICKNAMES.length + 1,
            rosterSize: 1,
            leagueArea: "north_america",
          }),
          createSeededRng(1),
        ),
      ).toThrow(/nickname name pool exhausted/);
    });
  });

  describe("league area city pools", () => {
    it.each(LEAGUE_AREAS)(
      "%s pool has at least 40 unique cities",
      (area) => {
        const pool = getTeamCitiesForArea(area);
        expect(pool.length).toBeGreaterThanOrEqual(40);
        expect(new Set(pool).size).toBe(pool.length);
      },
    );

    it.each(LEAGUE_AREAS)(
      "%s generation uses only that area's cities with unique markets and franchise names",
      (area) => {
        const pool = new Set(getTeamCitiesForArea(area));
        const generated = generateLeague(
          config({ leagueArea: area, rosterSize: 0 }),
          createSeededRng(42),
        );

        const cities = generated.teams.map((team) => team.city);
        expect(new Set(cities).size).toBe(cities.length);

        const fullNames = generated.teams.map(
          (team) => `${team.city} ${team.name}`,
        );
        expect(new Set(fullNames).size).toBe(fullNames.length);

        for (const city of cities) {
          expect(pool.has(city)).toBe(true);
        }
      },
    );

    it("defaults omitted leagueArea to north_america city behavior", () => {
      const omitted = generateLeague(
        config({ leagueArea: undefined, rosterSize: 0 }),
        createSeededRng(7),
      );
      const explicit = generateLeague(
        config({ leagueArea: "north_america", rosterSize: 0 }),
        createSeededRng(7),
      );

      expect(omitted.teams.map((team) => team.city)).toEqual(
        explicit.teams.map((team) => team.city),
      );
      expect(omitted.teams.map((team) => team.name)).toEqual(
        explicit.teams.map((team) => team.name),
      );

      const naPool = new Set<string>(NORTH_AMERICA_TEAM_CITIES);
      for (const team of omitted.teams) {
        expect(naPool.has(team.city)).toBe(true);
      }
    });

    it("same seed and same area produce identical cities", () => {
      const first = generateLeague(
        config({ leagueArea: "europe", rosterSize: 0 }),
        createSeededRng(99),
      );
      const second = generateLeague(
        config({ leagueArea: "europe", rosterSize: 0 }),
        createSeededRng(99),
      );
      expect(first.teams.map((team) => team.city)).toEqual(
        second.teams.map((team) => team.city),
      );
    });

    it("europe and north_america pools are regionally distinct for membership checks", () => {
      const europe = generateLeague(
        config({ leagueArea: "europe", rosterSize: 0 }),
        createSeededRng(15),
      );
      const northAmerica = generateLeague(
        config({ leagueArea: "north_america", rosterSize: 0 }),
        createSeededRng(15),
      );
      const europePool = new Set<string>(EUROPE_TEAM_CITIES);
      const naPool = new Set<string>(NORTH_AMERICA_TEAM_CITIES);

      for (const team of europe.teams) {
        expect(europePool.has(team.city)).toBe(true);
        expect(naPool.has(team.city)).toBe(false);
      }
      for (const team of northAmerica.teams) {
        expect(naPool.has(team.city)).toBe(true);
        expect(europePool.has(team.city)).toBe(false);
      }
    });

    it("exposes global pool membership for worldwide markets", () => {
      const generated = generateLeague(
        config({ leagueArea: "global", rosterSize: 0 }),
        createSeededRng(3),
      );
      const globalPool = new Set<string>(GLOBAL_TEAM_CITIES);
      for (const team of generated.teams) {
        expect(globalPool.has(team.city)).toBe(true);
      }
    });
  });

  describe("leagueId and abbreviation", () => {
    it("defaults leagueId to league_fictional when omitted", () => {
      const generated = generateLeague(
        config({ leagueId: undefined, rosterSize: 2 }),
        createSeededRng(1),
      );
      expect(generated.league.id).toBe("league_fictional");
    });

    it("uses the supplied leagueId", () => {
      const generated = generateLeague(
        config({ leagueId: "league_custom", rosterSize: 2 }),
        createSeededRng(1),
      );
      expect(generated.league.id).toBe("league_custom");
      expect(generated.conferences[0]!.id).toContain("league_custom");
    });

    it("uses the supplied leagueAbbreviation", () => {
      const generated = generateLeague(
        config({ leagueAbbreviation: "XYZ", rosterSize: 2 }),
        createSeededRng(1),
      );
      expect(generated.league.abbreviation).toBe("XYZ");
    });

    it("derives a deterministic abbreviation from leagueName when omitted", () => {
      const name = "Continental Basketball League";
      const first = generateLeague(
        config({ leagueName: name, rosterSize: 2 }),
        createSeededRng(1),
      );
      const second = generateLeague(
        config({ leagueName: name, rosterSize: 2 }),
        createSeededRng(9),
      );
      expect(first.league.abbreviation).toBe(deriveLeagueAbbreviation(name));
      expect(second.league.abbreviation).toBe(first.league.abbreviation);
      expect(first.league.abbreviation).toBe("CBL");
    });

    it("rejects an invalid supplied abbreviation via createLeague", () => {
      expect(() =>
        generateLeague(
          config({ leagueAbbreviation: "   ", rosterSize: 1 }),
          createSeededRng(1),
        ),
      ).toThrow(/abbreviation cannot be whitespace-only/);
    });
  });

  describe("roster position cycling", () => {
    it("assigns PG SG SF PF C repeating for rosterSize 12", () => {
      const generated = generateLeague(
        config({
          conferenceCount: 1,
          divisionsPerConference: 1,
          teamsPerDivision: 1,
          rosterSize: 12,
        }),
        createSeededRng(8),
      );

      const expected = Array.from({ length: 12 }, (_, slot) =>
        rosterPositionForSlot(slot),
      );
      expect(expected).toEqual([
        "PG",
        "SG",
        "SF",
        "PF",
        "C",
        "PG",
        "SG",
        "SF",
        "PF",
        "C",
        "PG",
        "SG",
      ]);

      const team = generated.teams[0]!;
      const positions = team.roster.map((playerId) => {
        const player = generated.players.find((p) => p.id === playerId)!;
        return player.position;
      });
      expect(positions).toEqual(expected);
    });
  });

  describe("contracts and finances boundary", () => {
    it("does not assign contractIds to generated players", () => {
      const generated = generateLeague(
        config({ rosterSize: 3 }),
        createSeededRng(4),
      );
      for (const player of generated.players) {
        expect(player.contractId).toBeNull();
      }
    });

    it("initializes team finances to empty objects", () => {
      const generated = generateLeague(
        config({ rosterSize: 2 }),
        createSeededRng(4),
      );
      for (const team of generated.teams) {
        expect(team.finances).toEqual({});
      }
    });
  });

  describe("integration", () => {
    it("produces players that satisfy Player validation rules", () => {
      const generated = generateLeague(
        config({
          conferenceCount: 1,
          divisionsPerConference: 1,
          teamsPerDivision: 2,
          rosterSize: 10,
        }),
        createSeededRng(21),
      );

      for (const player of generated.players) {
        expectValidGeneratedPlayer(player);
      }
    });

    it("assigns arenaId placeholders without returning Arena entities", () => {
      const generated = generateLeague(
        config({ rosterSize: 1 }),
        createSeededRng(2),
      );
      for (const team of generated.teams) {
        expect(team.arenaId).toBe(`arena_${team.id}`);
      }
      expect(generated).not.toHaveProperty("arenas");
    });
  });
});

function expectValidGeneratedPlayer(player: Player): void {
  expect(player.id.length).toBeGreaterThan(0);
  expect(player.firstName.trim().length).toBeGreaterThan(0);
  expect(player.lastName.trim().length).toBeGreaterThan(0);
  expect(isPlayerNationality(player.nationality)).toBe(true);
  expect(PLAYER_POSITIONS).toContain(player.position);
  expect(isPlayerArchetype(player.archetype)).toBe(true);
  expect(isArchetypeCompatible(player.archetype, player.position)).toBe(true);

  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    expect(Number.isInteger(player.attributes[key])).toBe(true);
    expect(player.attributes[key]).toBeGreaterThanOrEqual(RATING_MIN);
    expect(player.attributes[key]).toBeLessThanOrEqual(RATING_MAX);
  }

  expect(player.contractId).toBeNull();
  expect(player.teamId).not.toBeNull();
  expect(player.injury.kind).toBe("healthy");
}

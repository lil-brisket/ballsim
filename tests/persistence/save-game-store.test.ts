import { describe, expect, it } from "vitest";
import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { asSaveId, asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { generateLeague } from "@/systems/league-generation";
import { generateRosters } from "@/systems/roster-generation";
import { simulateSeason } from "@/systems/season-simulation";
import { createTestGameState } from "../factories/game-state";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

function createEightTeamPopulatedState(rngSeed: number): GameState {
  const rng = createSeededRng(rngSeed);
  const generated = generateLeague(
    {
      leagueId: "league_save_full",
      leagueName: "Save Full League",
      conferenceCount: 2,
      divisionsPerConference: 2,
      teamsPerDivision: 2,
      rosterSize: 10,
    },
    rng,
  );

  const seasonId = asSeasonId("season_save_full");
  const teams = Object.fromEntries(
    generated.teams.map((team) => [team.id, team]),
  );
  const conferences = Object.fromEntries(
    generated.conferences.map((conference) => [conference.id, conference]),
  );
  const divisions = Object.fromEntries(
    generated.divisions.map((division) => [division.id, division]),
  );
  const finances = Object.fromEntries(
    generated.teams.map((team) => [
      team.id,
      { teamId: team.id, cash: 50_000_000, payroll: 0 },
    ]),
  );
  const standings = {
    byTeamId: Object.fromEntries(
      generated.teams.map((team) => [
        team.id,
        createEmptyTeamStanding(team.id),
      ]),
    ),
  };

  const base: GameState = {
    meta: {
      saveId: asSaveId("save_full_roundtrip"),
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      createdAt: TEST_NOW_ISO,
      updatedAt: TEST_NOW_ISO,
      rngSeed,
      rngState: rng.getState(),
    },
    world: {
      calendar: { currentDate: "2026-10-01" },
      league: generated.league,
      conferences,
      divisions,
      teams,
      players: {},
      coaches: {},
      staff: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: 2026,
        phase: "preseason",
      },
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
    },
    business: {
      contracts: {},
      finances,
    },
    user: {
      controlledTeamId: generated.teams[0]!.id as TeamId,
      mode: "owner",
    },
  };

  const rostered = generateRosters(base, rng).state;
  resetDomainEventSequenceForTests();
  return simulateSeason(rostered, rng).state;
}

describe("MemorySaveGameStore", () => {
  it("round-trips minimal GameState with deep equality", async () => {
    const store = createMemorySaveGameStore();
    const state = createTestGameState({ saveId: "save_minimal" });

    const created = await store.create({
      id: state.meta.saveId,
      name: "Minimal",
      state,
    });
    expect(created.state).toEqual(state);

    const loaded = await store.load(state.meta.saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(state);
  });

  it("round-trips a fully populated simulated GameState", async () => {
    resetDomainEventSequenceForTests();
    const store = createMemorySaveGameStore();
    const state = createEightTeamPopulatedState(TEST_RNG_SEED);

    expect(Object.keys(state.world.teams).length).toBe(8);
    expect(Object.keys(state.world.players).length).toBeGreaterThan(0);
    expect(Object.keys(state.business.contracts).length).toBeGreaterThan(0);
    expect(Object.keys(state.business.finances).length).toBe(8);
    expect(state.competition.schedule.gameIds.length).toBeGreaterThan(0);
    expect(
      Object.values(state.competition.games).some((game) => game.status === "final"),
    ).toBe(true);
    expect(
      Object.values(state.competition.games).some(
        (game) => game.playerStats.length > 0,
      ),
    ).toBe(true);
    expect(Object.keys(state.competition.standings.byTeamId).length).toBe(8);
    expect(state.competition.playoffs.status).toBe("complete");
    expect(state.world.calendar.currentDate.length).toBeGreaterThan(0);

    const created = await store.create({
      id: state.meta.saveId,
      name: "Full Season",
      state,
    });
    expect(created.state).toEqual(state);

    const loaded = await store.load(state.meta.saveId);
    expect(loaded!.state).toEqual(state);
    expect(loaded!.state.world.league).toEqual(state.world.league);
    expect(loaded!.state.world.teams).toEqual(state.world.teams);
    expect(loaded!.state.world.players).toEqual(state.world.players);
    expect(loaded!.state.competition.standings).toEqual(
      state.competition.standings,
    );
    expect(loaded!.state.competition.schedule).toEqual(
      state.competition.schedule,
    );
    expect(loaded!.state.competition.games).toEqual(state.competition.games);
    expect(loaded!.state.business.contracts).toEqual(state.business.contracts);
    expect(loaded!.state.business.finances).toEqual(state.business.finances);
    expect(loaded!.state.world.calendar).toEqual(state.world.calendar);
    expect(loaded!.state.competition.season).toEqual(state.competition.season);
    expect(loaded!.state.competition.playoffs).toEqual(
      state.competition.playoffs,
    );
    expect(loaded!.state.meta.rngState).toBe(state.meta.rngState);
  });

  it("does not mutate input on successful save", async () => {
    const store = createMemorySaveGameStore();
    const state = createTestGameState({ saveId: "save_no_mutate" });
    const snapshot = structuredClone(state);

    await store.create({
      id: state.meta.saveId,
      name: "No Mutate",
      state,
    });
    expect(state).toEqual(snapshot);

    const next = {
      ...state,
      meta: { ...state.meta, updatedAt: "2026-08-15T00:00:00.000Z" },
    };
    const nextSnapshot = structuredClone(next);
    await store.save({ id: state.meta.saveId, state: next });
    expect(next).toEqual(nextSnapshot);
  });

  it("returns a loaded state independent from the stored representation", async () => {
    const store = createMemorySaveGameStore();
    const state = createTestGameState({ saveId: "save_independent" });
    await store.create({
      id: state.meta.saveId,
      name: "Independent",
      state,
    });

    const loaded = await store.load(state.meta.saveId);
    loaded!.state.world.calendar.currentDate = "2099-01-01";

    const reloaded = await store.load(state.meta.saveId);
    expect(reloaded!.state.world.calendar.currentDate).toBe(
      state.world.calendar.currentDate,
    );
  });

  it("does not mutate input or store on failed save validation", async () => {
    const store = createMemorySaveGameStore();
    const valid = createTestGameState({ saveId: "save_fail_path" });
    await store.create({
      id: valid.meta.saveId,
      name: "Fail Path",
      state: valid,
    });

    const before = await store.load(valid.meta.saveId);
    const invalid: GameState = {
      ...valid,
      competition: {
        ...valid.competition,
        schedule: {
          ...valid.competition.schedule,
          gameIds: ["game_does_not_exist" as never],
        },
      },
    };
    const invalidSnapshot = structuredClone(invalid);

    await expect(
      store.save({ id: valid.meta.saveId, state: invalid }),
    ).rejects.toThrow(/schedule\.gameIds/);

    expect(invalid).toEqual(invalidSnapshot);

    const after = await store.load(valid.meta.saveId);
    expect(after!.state).toEqual(before!.state);
    expect(after!.state).toEqual(valid);
  });

  it("overwrites the whole blob on save", async () => {
    const store = createMemorySaveGameStore();
    const first = createTestGameState({ saveId: "save_overwrite" });
    await store.create({
      id: first.meta.saveId,
      name: "Overwrite",
      state: first,
    });

    const second: GameState = {
      ...first,
      world: {
        ...first.world,
        calendar: { currentDate: "2026-11-15" },
      },
      competition: {
        ...first.competition,
        season: {
          ...first.competition.season,
          phase: "regular",
        },
      },
      meta: {
        ...first.meta,
        updatedAt: "2026-08-16T00:00:00.000Z",
        rngState: first.meta.rngState + 1,
      },
    };

    await store.save({ id: first.meta.saveId, state: second });
    const loaded = await store.load(first.meta.saveId);
    expect(loaded!.state).toEqual(second);
    expect(loaded!.state.world.calendar.currentDate).toBe("2026-11-15");
  });
});

describe("validateGameState / deserialize invalid saves", () => {
  it("rejects malformed JSON", () => {
    expect(() => deserializeGameState("{not-json")).toThrow(/Malformed GameState JSON/);
  });

  it("rejects missing root slices", () => {
    const state = createTestGameState();
    const { world: _w, ...broken } = state;
    expect(() => deserializeGameState(JSON.stringify(broken))).toThrow(
      /Invalid GameState envelope|missing required/,
    );
  });

  it("rejects unsupported schemaVersion", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      meta: { ...state.meta, schemaVersion: 99 },
    });
    expect(() => deserializeGameState(json)).toThrow(/Unsupported GameState schemaVersion/);
  });

  it("rejects schemaVersion 0", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      meta: { ...state.meta, schemaVersion: 0 },
    });
    expect(() => deserializeGameState(json)).toThrow(/Unsupported GameState schemaVersion/);
  });

  it("rejects invalid calendar date", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      world: {
        ...state.world,
        calendar: { currentDate: "not-a-date" },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/calendar/);
  });

  it("rejects dangling schedule.gameIds", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      competition: {
        ...state.competition,
        schedule: {
          ...state.competition.schedule,
          gameIds: ["missing_game"],
        },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/schedule\.gameIds/);
  });

  it("rejects unknown controlledTeamId", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      user: {
        ...state.user,
        controlledTeamId: "team_does_not_exist",
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/controlledTeamId/);
  });

  it("rejects missing playoffs property on v14 blob", () => {
    const state = createTestGameState();
    const { playoffs: _removed, ...competitionWithoutPlayoffs } =
      state.competition;
    const json = JSON.stringify({
      ...state,
      competition: competitionWithoutPlayoffs,
    });
    expect(() => deserializeGameState(json)).toThrow(/playoffs/);
  });

  it("rejects null playoffs on v14 blob", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      competition: {
        ...state.competition,
        playoffs: null,
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/playoffs/);
  });

  it("accepts empty inactive playoffs tournament", () => {
    const state = createTestGameState();
    expect(state.competition.playoffs).toEqual(createEmptyPlayoffTournament());
    expect(() => validateGameState(state)).not.toThrow();
    expect(deserializeGameState(serializeGameState(state))).toEqual(state);
  });

  it("rejects null controlledTeamId", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      user: {
        ...state.user,
        controlledTeamId: null,
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/controlledTeamId/);
  });
});

describe("serializeGameState", () => {
  it("does not call deserialize and leaves state unchanged", () => {
    const state = createInitialGameState({
      saveId: "save_serialize_only",
      rngSeed: 1,
      nowIso: TEST_NOW_ISO,
    });
    const snapshot = structuredClone(state);
    const json = serializeGameState(state);
    expect(state).toEqual(snapshot);
    expect(typeof json).toBe("string");
    expect(JSON.parse(json)).toEqual(state);
  });
});

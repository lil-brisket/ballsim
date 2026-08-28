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
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createPhaseEBusinessDefaults } from "@/state/phase-e-defaults";
import {
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
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
      {
        teamId: team.id,
        cash: 50_000_000,
        payroll: 0,
        booksByYear: {},
        attendanceByYear: {},
        booksByMonth: {},
        cashLedgerByMonth: {},
      },
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
    settings: {
      league: {
        teamCount: 8,
        conferenceCount: 2,
        divisionsEnabled: true,
        area: "north_america",
      },
      injuryFrequency: "medium",
      ownership: { controlledTeamCount: 1 },
      regularSeason: { gamesPerTeam: 14, tradeDeadlineRule: { kind: "fraction_of_season_span", seasonSpanFraction: 0.55 } },
      playoffs: {
        playoffTeams: 8,
        seriesLength: 7,
        playInEnabled: false,
      },
      simulation: { frequency: "daily" },
      ai: {
        difficulty: "normal",
        managementPreset: "continuity",
        assistance: {
          injuriesEmergencyRoster: "continuity",
          rotationsDepthChart: "continuity",
          freeAgency: "continuity",
          trades: "off",
          waiversReleases: "continuity",
          contracts: "off",
          draftScouting: "off",
          draftSelection: "off",
          coachingStaff: "continuity",
          frontOfficeStaff: "continuity",
          strategicRosterDecisions: "off",
          longTermPlanning: "off",
        },
      },
      financialRules: {
        salaryCapEnabled: true,
        luxuryTaxEnabled: true,
        revenueSharingEnabled: true,
      },
      draft: {
        mode: "standard",
        userPickPosition: null,
        randomizeUserPick: false,
      },
      history: { mode: "new" },
      offseason: {
        freeAgency: { durationDays: 30, allowExtension: true },
      },
    },
    world: {
      calendar: {
        currentDate: "2026-10-01",
        lastSimulatedDate: null,
        lastSimulatedWeekId: null,
        lastSimulatedMonthId: null,
      },
      league: generated.league,
      conferences,
      divisions,
      teams,
      players: {},
      coaches: {},
      staff: {},
      draftPicks: {},
      drafts: {},
      scheduledEvents: {},
    },
    competition: {
      season: {
        id: seasonId,
        year: 2026,
        phase: "preseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
        offseasonStageEnteredDate: null,
        freeAgencyExtendedUntil: null,
      },
      schedule: {
        seasonId,
        gameIds: [],
      },
      games: {},
      standings,
      playoffs: createEmptyPlayoffTournament(),
      seasonEventLog: [],
    },
    business: {
      contracts: {},
      finances,
      freeAgency: {
        offers: {},
      },
      tradeBlocks: {},
      ...createPhaseEBusinessDefaults(generated.teams.map((t) => t.id as TeamId)),
    },
    user: {
      ownedTeamIds: [generated.teams[0]!.id as TeamId],
      activeOwnerTeamId: generated.teams[0]!.id as TeamId,
      ownedFranchises: {
        [generated.teams[0]!.id]: createDefaultOwnedFranchiseState({
          seasonYear: 2026,
          currentDate: "2026-10-01",
          citySelectionConfirmed: true,
          franchiseIdentityConfirmed: true,
        }),
      },
      mode: "owner",
      pendingOwnerDecisions: [],
      ownerDecisionHistory: [],
    },
  };

  const rostered = generateRosters(base, rng).state;
  resetDomainEventSequenceForTests();
  return simulateSeason(rostered, rng).state;
}

function assertPopulatedFixture(state: GameState): void {
  expect(Object.keys(state.world.teams).length).toBeGreaterThan(1);
  expect(Object.keys(state.world.players).length).toBeGreaterThan(0);

  const sampleTeam = Object.values(state.world.teams)[0]!;
  expect(sampleTeam.playStyle).toBeDefined();
  expect(sampleTeam.coachingPhilosophy).toBeDefined();
  expect(sampleTeam.playStyle.pace).toBeTypeOf("number");
  expect(sampleTeam.coachingPhilosophy.pace).toBeTruthy();

  const samplePlayer = Object.values(state.world.players)[0]!;
  expect(samplePlayer.attributes).toBeDefined();
  expect(samplePlayer.attributes.speed).toBeTypeOf("number");
  expect(samplePlayer.firstName.length).toBeGreaterThan(0);

  expect(Object.keys(state.competition.standings.byTeamId).length).toBeGreaterThan(
    1,
  );
  expect(state.competition.schedule.gameIds.length).toBeGreaterThan(0);

  const finalGames = Object.values(state.competition.games).filter(
    (game) => game.status === "final",
  );
  expect(finalGames.length).toBeGreaterThan(0);
  expect(finalGames.some((game) => game.events.length > 0)).toBe(true);
  expect(finalGames.some((game) => game.playerStats.length > 0)).toBe(true);

  expect(Object.keys(state.business.contracts).length).toBeGreaterThan(0);
  expect(Object.keys(state.business.finances).length).toBeGreaterThan(1);

  expect(state.competition.playoffs.status).toBe("complete");
  expect(state.competition.playoffs.series.length).toBeGreaterThan(0);

  expect(state.competition.season.year).toBeGreaterThan(0);
  expect(state.world.calendar.currentDate.length).toBeGreaterThan(0);
  expect(state.meta.rngSeed).toBeTypeOf("number");
  expect(state.meta.rngState).toBeTypeOf("number");
  expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
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

    expect(created.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(created.state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const expected = structuredClone(state);
    let runtimeState: GameState | undefined = state;
    runtimeState = undefined;
    void runtimeState;

    const loaded = await store.load(expected.meta.saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded!.state).toEqual(expected);
    expect(loaded!.state).not.toBe(expected);
  });

  it("save → discard runtime → load preserves fully populated GameState", async () => {
    resetDomainEventSequenceForTests();
    const store = createMemorySaveGameStore();
    let runtimeState: GameState | undefined =
      createEightTeamPopulatedState(TEST_RNG_SEED);

    assertPopulatedFixture(runtimeState);

    const saveId = runtimeState.meta.saveId;
    const created = await store.create({
      id: saveId,
      name: "Full Season",
      state: runtimeState,
    });
    expect(created.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

    const expected = structuredClone(runtimeState);
    runtimeState = undefined;

    const loaded = await store.load(saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(saveId);
    expect(loaded!.name).toBe("Full Season");
    expect(loaded!.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded!.state).toEqual(expected);
    expect(loaded!.state).not.toBe(expected);
    expect(() => validateGameState(loaded!.state)).not.toThrow();
  });

  it("does not mutate input on successful create or save", async () => {
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
        calendar: {
          ...first.world.calendar,
          currentDate: "2026-11-15",
        },
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

  it("returns null for a missing save and throws when saving a missing id", async () => {
    const store = createMemorySaveGameStore();
    const missing = await store.load("does-not-exist");
    expect(missing).toBeNull();

    const state = createTestGameState({ saveId: "save_orphan" });
    await expect(
      store.save({ id: "does-not-exist", state }),
    ).rejects.toThrow(/not found/);
  });

  it("deletes an existing save and leaves unrelated saves intact", async () => {
    const store = createMemorySaveGameStore();
    const stateA = createTestGameState({ saveId: "save_delete_a" });
    const stateB = createTestGameState({ saveId: "save_delete_b" });
    await store.create({ id: stateA.meta.saveId, name: "Keep", state: stateA });
    await store.create({
      id: stateB.meta.saveId,
      name: "Remove",
      state: stateB,
    });

    const removed = await store.delete(stateB.meta.saveId);
    expect(removed).toBe(true);
    expect(await store.load(stateB.meta.saveId)).toBeNull();
    expect(await store.load(stateA.meta.saveId)).not.toBeNull();

    const listed = await store.list();
    expect(listed.map((row) => row.id)).toEqual([stateA.meta.saveId]);
  });

  it("returns false when deleting a missing save", async () => {
    const store = createMemorySaveGameStore();
    const removed = await store.delete("does-not-exist");
    expect(removed).toBe(false);
  });

  it("loads distinct states and envelope identity for multiple saves", async () => {
    const store = createMemorySaveGameStore();
    const stateA = createTestGameState({ saveId: "save_multi_a" });
    const baseB = createTestGameState({ saveId: "save_multi_b" });
    const stateB: GameState = {
      ...baseB,
      world: {
        ...baseB.world,
        calendar: {
          ...baseB.world.calendar,
          currentDate: "2026-12-25",
        },
      },
      competition: {
        ...baseB.competition,
        season: {
          ...baseB.competition.season,
          phase: "regular",
          year: 2027,
        },
      },
    };

    await store.create({
      id: stateA.meta.saveId,
      name: "Save Alpha",
      state: stateA,
    });
    await store.create({
      id: stateB.meta.saveId,
      name: "Save Beta",
      state: stateB,
    });

    const expectedA = structuredClone(stateA);
    const expectedB = structuredClone(stateB);

    const loadedA = await store.load(stateA.meta.saveId);
    const loadedB = await store.load(stateB.meta.saveId);

    expect(loadedA).not.toBeNull();
    expect(loadedB).not.toBeNull();
    expect(loadedA!.id).toBe(stateA.meta.saveId);
    expect(loadedA!.name).toBe("Save Alpha");
    expect(loadedA!.state).toEqual(expectedA);
    expect(loadedB!.id).toBe(stateB.meta.saveId);
    expect(loadedB!.name).toBe("Save Beta");
    expect(loadedB!.state).toEqual(expectedB);
    expect(loadedA!.state).not.toEqual(loadedB!.state);
  });

  it("fails load when persisted blob is malformed JSON", async () => {
    const store = createMemorySaveGameStore();
    store.seedPersistedBlob({
      id: "save_malformed_json",
      name: "Malformed",
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      stateJson: "{not-json",
    });

    await expect(store.load("save_malformed_json")).rejects.toThrow(
      /Malformed GameState JSON/,
    );
  });

  it("fails load when persisted JSON has an invalid GameState envelope", async () => {
    const store = createMemorySaveGameStore();
    store.seedPersistedBlob({
      id: "save_invalid_envelope",
      name: "Invalid Envelope",
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      stateJson: JSON.stringify({ meta: { schemaVersion: 1 } }),
    });

    await expect(store.load("save_invalid_envelope")).rejects.toThrow(
      /Invalid GameState envelope|missing required/,
    );
  });

  it("loads a v13 persisted blob through deserialize → migrate → validate", async () => {
    const store = createMemorySaveGameStore();
    const modern = createTestGameState({ saveId: "save_v13_through_load" });
    const { playoffs: _removed, ...competitionWithoutPlayoffs } =
      modern.competition;

    const stateV13 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 13,
      },
      competition: competitionWithoutPlayoffs,
    };

    store.seedPersistedBlob({
      id: modern.meta.saveId,
      name: "Legacy v13",
      schemaVersion: 13,
      stateJson: JSON.stringify(stateV13),
    });

    const loaded = await store.load(modern.meta.saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(13);
    expect(loaded!.state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded!.state.competition.playoffs).toEqual(
      createEmptyPlayoffTournament(),
    );
    expect(() => validateGameState(loaded!.state)).not.toThrow();
  });

  it("loads a v12 persisted blob through deserialize → migrate → validate", async () => {
    const store = createMemorySaveGameStore();
    const modern = createTestGameState({ saveId: "save_v12_through_load" });
    const { playoffs: _removed, ...competitionWithoutPlayoffs } =
      modern.competition;

    const v12Standings = Object.fromEntries(
      Object.keys(modern.world.teams).map((teamId) => [
        teamId,
        { teamId, wins: 0, losses: 0 },
      ]),
    );

    const stateV12 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 12,
      },
      competition: {
        ...competitionWithoutPlayoffs,
        standings: { byTeamId: v12Standings },
      },
    };

    store.seedPersistedBlob({
      id: modern.meta.saveId,
      name: "Legacy v12",
      schemaVersion: 12,
      stateJson: JSON.stringify(stateV12),
    });

    const loaded = await store.load(modern.meta.saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(12);
    expect(loaded!.state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded!.state.competition.playoffs).toEqual(
      createEmptyPlayoffTournament(),
    );
    expect(() => validateGameState(loaded!.state)).not.toThrow();
  });

  it("migrates from JSON schemaVersion even when envelope schemaVersion is current", async () => {
    const store = createMemorySaveGameStore();
    const modern = createTestGameState({ saveId: "save_envelope_ignored" });
    const { playoffs: _removed, ...competitionWithoutPlayoffs } =
      modern.competition;

    const stateV13 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 13,
      },
      competition: competitionWithoutPlayoffs,
    };

    store.seedPersistedBlob({
      id: modern.meta.saveId,
      name: "Stale Envelope",
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      stateJson: JSON.stringify(stateV13),
    });

    const loaded = await store.load(modern.meta.saveId);
    expect(loaded).not.toBeNull();
    expect(loaded!.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded!.state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded!.state.competition.playoffs).toEqual(
      createEmptyPlayoffTournament(),
    );
    expect(() => validateGameState(loaded!.state)).not.toThrow();
  });

  it("rejects a future-version persisted blob on load", async () => {
    const store = createMemorySaveGameStore();
    const modern = createTestGameState({ saveId: "save_future_load" });
    const futureJson = JSON.stringify({
      ...modern,
      meta: { ...modern.meta, schemaVersion: GAME_STATE_SCHEMA_VERSION + 1 },
    });

    store.seedPersistedBlob({
      id: modern.meta.saveId,
      name: "Future",
      schemaVersion: GAME_STATE_SCHEMA_VERSION + 1,
      stateJson: futureJson,
    });

    await expect(store.load(modern.meta.saveId)).rejects.toThrow(
      new RegExp(
        `Save schema version ${GAME_STATE_SCHEMA_VERSION + 1} is newer than the supported version ${GAME_STATE_SCHEMA_VERSION}`,
      ),
    );
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

  it("rejects future schemaVersion with a clear newer-save error", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      meta: { ...state.meta, schemaVersion: GAME_STATE_SCHEMA_VERSION + 1 },
    });
    expect(() => deserializeGameState(json)).toThrow(
      new RegExp(
        `Save schema version ${GAME_STATE_SCHEMA_VERSION + 1} is newer than the supported version ${GAME_STATE_SCHEMA_VERSION}`,
      ),
    );
    expect(() => deserializeGameState(json)).toThrow(
      /This save was created by a newer version of the game/,
    );
  });

  it("rejects schemaVersion 0 without treating it as a future save", () => {
    const state = createTestGameState();
    const json = JSON.stringify({
      ...state,
      meta: { ...state.meta, schemaVersion: 0 },
    });
    expect(() => deserializeGameState(json)).toThrow(
      /Unsupported GameState schemaVersion 0/,
    );
    expect(() => deserializeGameState(json)).not.toThrow(
      /newer version of the game/,
    );
  });

  it("rejects missing schemaVersion via envelope validation", () => {
    const state = createTestGameState();
    const { schemaVersion: _removed, ...metaWithoutVersion } = state.meta;
    const json = JSON.stringify({
      ...state,
      meta: metaWithoutVersion,
    });
    expect(() => deserializeGameState(json)).toThrow(/Invalid GameState envelope/);
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
        activeOwnerTeamId: "team_does_not_exist",
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/activeOwnerTeamId/);
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
        activeOwnerTeamId: null,
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/activeOwnerTeamId/);
  });

  it("rejects duplicate owner objective ids", () => {
    const state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    const franchise = state.user.ownedFranchises[teamId]!;
    const json = JSON.stringify({
      ...state,
      user: {
        ...state.user,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamId]: {
            ...franchise,
            objectives: [
              {
                id: "obj_dup",
                type: "make_playoffs",
                description: "Make playoffs",
                status: "active",
                seasonYear: 2026,
                category: "competitive",
                lifecycle: "seasonal",
                role: "primary",
                consequenceApplied: false,
              },
              {
                id: "obj_dup",
                type: "win_championship",
                description: "Win title",
                status: "active",
                seasonYear: 2026,
                category: "competitive",
                lifecycle: "seasonal",
                role: "primary",
                consequenceApplied: false,
              },
            ],
          },
        },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/duplicate id/);
  });

  it("rejects invalid owner objective type", () => {
    const state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    const franchise = state.user.ownedFranchises[teamId]!;
    const json = JSON.stringify({
      ...state,
      user: {
        ...state.user,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamId]: {
            ...franchise,
            objectives: [
              {
                id: "obj_bad",
                type: "win_lottery",
                description: "Invalid",
                status: "active",
                seasonYear: 2026,
                category: "competitive",
                lifecycle: "seasonal",
                role: "primary",
                consequenceApplied: false,
              },
            ],
          },
        },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/type must be one of/);
  });

  it("rejects negative objective progress", () => {
    const state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    const franchise = state.user.ownedFranchises[teamId]!;
    const json = JSON.stringify({
      ...state,
      user: {
        ...state.user,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamId]: {
            ...franchise,
            objectives: [
              {
                id: "obj_prog",
                type: "minimum_win_total",
                description: "Wins",
                progress: -1,
                status: "active",
                seasonYear: 2026,
                category: "competitive",
                lifecycle: "seasonal",
                role: "primary",
                consequenceApplied: false,
              },
            ],
          },
        },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/progress must be >= 0/);
  });

  it("rejects non-finite finance book amounts", () => {
    const state = createTestGameState();
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const json = JSON.stringify({
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId],
            booksByYear: {
              [String(year)]: {
                revenue: {
                  tickets: Number.NaN,
                  sponsorships: 0,
                  merchandise: 0,
                  other: 0,
                },
                expenses: {
                  staff: 0,
                  facilities: 0,
                  operations: 0,
                  marketing: 0,
                },
              },
            },
          },
        },
      },
    });
    expect(() => deserializeGameState(json)).toThrow(/tickets/);
  });
});

describe("serializeGameState", () => {
  it("does not call deserialize and leaves state unchanged", () => {
    const state = createInitialGameState({
    saveId: "save_serialize_only",
      rngSeed: 1,
      nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
    const snapshot = structuredClone(state);
    const json = serializeGameState(state);
    expect(state).toEqual(snapshot);
    expect(typeof json).toBe("string");
    expect(JSON.parse(json)).toEqual(state);
  });
});

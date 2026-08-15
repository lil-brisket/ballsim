import { describe, expect, it } from "vitest";
import {
  generateDraftPicksForSeason,
  mergeDraftPicksForSeason,
  expectedDraftPickCount,
} from "@/domain/draft-picks/generate-draft-picks";
import { draftPickIdFor } from "@/domain/entities/draft-pick";
import { asTeamId } from "@/domain/ids";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import { ensureDraftPicks } from "@/systems/world-pipeline";
import { createTeam } from "../../factories/team";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../../helpers/determinism";

describe("draft pick generation", () => {
  it("generates deterministic picks for the next three seasons", () => {
    const teams = [
      createTeam({ id: "team_x" }),
      createTeam({ id: "team_y" }),
    ];
    const picks = generateDraftPicksForSeason(teams, 2026);
    expect(Object.keys(picks)).toHaveLength(expectedDraftPickCount(2));
    expect(picks[draftPickIdFor(teams[0]!.id, 2027, 1)]).toBeDefined();
    expect(picks[draftPickIdFor(teams[0]!.id, 2029, 2)]).toBeDefined();
  });

  it("merge preserves existing picks and fills missing ones", () => {
    const teams = [createTeam({ id: "team_z" })];
    const full = generateDraftPicksForSeason(teams, 2026);
    const partialId = draftPickIdFor(teams[0]!.id, 2027, 1);
    const mutated = {
      ...full[partialId]!,
      ownerTeamId: teams[0]!.id,
    };
    const merged = mergeDraftPicksForSeason(
      { [partialId]: mutated },
      teams,
      2026,
    );
    expect(merged[partialId]).toBe(mutated);
    expect(Object.keys(merged)).toHaveLength(expectedDraftPickCount(1));
  });

  it("ensureDraftPicks is idempotent and extends horizon", () => {
    const state = createInitialGameState({
    saveId: "save_picks",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
    const once = ensureDraftPicks(state);
    const twice = ensureDraftPicks(once);
    expect(Object.keys(once.world.draftPicks).length).toBe(
      expectedDraftPickCount(Object.keys(state.world.teams).length),
    );
    expect(twice.world.draftPicks).toEqual(once.world.draftPicks);

    const advanced: GameState = {
      ...once,
      competition: {
        ...once.competition,
        season: { ...once.competition.season, year: once.competition.season.year + 1 },
      },
    };
    const extended = ensureDraftPicks(advanced);
    const year = advanced.competition.season.year;
    const teamId = asTeamId(Object.keys(advanced.world.teams)[0]!);
    expect(
      extended.world.draftPicks[draftPickIdFor(teamId, year + 3, 1)],
    ).toBeDefined();
  });
});

describe("schema v17 → v18 migration", () => {
  it("migrates v17 saves to draft picks and empty trade blocks", () => {
    const modern = createInitialGameState({
    saveId: "save_v17_migrate",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
    const v17 = {
      ...modern,
      meta: { ...modern.meta, schemaVersion: 17 },
      world: {
        calendar: modern.world.calendar,
        league: modern.world.league,
        conferences: modern.world.conferences,
        divisions: modern.world.divisions,
        teams: modern.world.teams,
        players: modern.world.players,
        coaches: modern.world.coaches,
        staff: modern.world.staff,
      },
      business: {
        contracts: modern.business.contracts,
        finances: modern.business.finances,
        freeAgency: modern.business.freeAgency,
      },
    };

    const migrated = deserializeGameState(JSON.stringify(v17));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.business.tradeBlocks).toEqual({});
    const teamCount = Object.keys(migrated.world.teams).length;
    expect(Object.keys(migrated.world.draftPicks)).toHaveLength(
      expectedDraftPickCount(teamCount),
    );
    const teamId = asTeamId(Object.keys(migrated.world.teams)[0]!);
    const year = migrated.competition.season.year;
    expect(
      migrated.world.draftPicks[draftPickIdFor(teamId, year + 1, 1)],
    ).toBeDefined();
  });

  it("does not duplicate picks when loading a v18 save", () => {
    const state = createInitialGameState({
    saveId: "save_v18_roundtrip",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
    const withPicks = ensureDraftPicks(state);
    const restored = deserializeGameState(serializeGameState(withPicks));
    expect(Object.keys(restored.world.draftPicks)).toEqual(
      Object.keys(withPicks.world.draftPicks),
    );
  });
});

import { describe, expect, it } from "vitest";
import type { PlayerSeasonRecord } from "@/domain/entities/player-history";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { migrateV80ToV81 } from "@/persistence/mappers/game-state-migrations/v66-v75";
import { deserializeGameState } from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { careerBasisFromHistory } from "@/systems/legacy";
import { bootstrapWorld } from "@/systems/world-pipeline";

function line(points: number) {
  return {
    games: 60,
    minutes: 1800,
    points,
    rebounds: 240,
    assists: 120,
    steals: 30,
    blocks: 10,
    turnovers: 50,
    fgMade: 400,
    fgAttempted: 900,
    threeMade: 60,
    threeAttempted: 180,
    ftMade: 150,
    ftAttempted: 200,
  };
}

/** A v80 save with one retired player who has two seasons and leftover morale. */
function v80State() {
  const initial = createInitialGameState({
    saveId: "migration_v81",
    rngSeed: 41,
    settings: CBL_GAME_SETTINGS,
  });
  const base = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const year = base.competition.season.year;
  const teamId = base.user.activeOwnerTeamId as TeamId;
  const playerId = base.world.teams[teamId]!.roster[0]!;
  const player = base.world.players[playerId]!;
  const activeId = base.world.teams[teamId]!.roster[1]!;
  const seasons = [year - 2, year - 1].map((seasonYear) => ({
    seasonYear,
    attributes: player.attributes,
    contractSnapshot: { contractId: null, salary: null, teamId },
    competition: {
      regular: line(1000),
      playoffs: line(0),
      development: line(0),
      combined: line(1000),
    },
  })) as unknown as PlayerSeasonRecord[];
  const { retiredPlayers: _none, ...world } = base.world;
  const state = {
    ...base,
    meta: { ...base.meta, schemaVersion: 80 },
    world: {
      ...world,
      players: {
        ...base.world.players,
        [playerId]: {
          ...player,
          retired: true,
          teamId: null,
          contractId: null,
        },
      },
    },
    business: {
      ...base.business,
      playerHistory: {
        ...base.business.playerHistory,
        [playerId]: { playerId, seasons, trackingStartedSeasonYear: year - 2 },
      },
      playerMorale: {
        [playerId]: {
          value: 40,
          reason: "settled",
          lowWeeks: 0,
          tradeRequestSeason: null,
          complaintSeason: null,
        },
        [activeId]: {
          value: 70,
          reason: "settled",
          lowWeeks: 0,
          tradeRequestSeason: null,
          complaintSeason: null,
        },
      },
    },
  } as unknown as GameState;
  return { state, playerId, activeId, year };
}

describe("migration v80 -> v81", () => {
  it("archives retired players with their career basis", () => {
    const { state, playerId, year } = v80State();
    const migrated = migrateV80ToV81(state);
    expect(migrated.meta.schemaVersion).toBe(81);
    const record = migrated.world.retiredPlayers[playerId]!;
    expect(record).toMatchObject({
      id: playerId,
      firstName: state.world.players[playerId]!.firstName,
      retiredSeasonYear: year - 1,
    });
    // Frozen copy of the rule the legacy system uses today.
    expect(record.career).toEqual(careerBasisFromHistory(state, playerId));
    expect(record.career.totals.points).toBe(2000);
  });

  it("drops retired players' morale but keeps active players'", () => {
    const { state, playerId, activeId } = v80State();
    const migrated = migrateV80ToV81(state);
    expect(migrated.business.playerMorale[playerId]).toBeUndefined();
    expect(migrated.business.playerMorale[activeId]).toBeDefined();
  });

  it("loads a v80 save through the mapper", () => {
    const { state, playerId } = v80State();
    const loaded = deserializeGameState(JSON.stringify(state));
    expect(loaded.world.retiredPlayers[playerId]).toBeDefined();
  });
});

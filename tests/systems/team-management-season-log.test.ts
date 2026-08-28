import { describe, expect, it } from "vitest";
import { createDomainEvent } from "@/domain/events";
import { appendSeasonEventLog, GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { toSeasonTransactionsView } from "@/state/team-management-selectors";
import { generateRosters } from "@/systems/roster-generation";
import { deserializeGameState } from "@/persistence/mappers/game-state-mapper";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

describe("seasonEventLog", () => {
  it("captures league-wide events regardless of active franchise", () => {
    let state = generateRosters(createTestGameState(), createTestRng(1)).state;
    const teamIds = Object.keys(state.world.teams);
    const teamA = teamIds[0]!;
    const teamB = teamIds[1]!;
    state = {
      ...state,
      user: {
        ...state.user,
        activeOwnerTeamId: state.user.activeOwnerTeamId,
      },
    };

    const events = [
      createDomainEvent({
        type: "FreeAgentSigned",
        occurredOn: state.world.calendar.currentDate,
        payload: {
          teamId: teamA,
          playerId: state.world.teams[teamA]!.roster[0],
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: state.world.calendar.currentDate,
        payload: {
          playerId: state.world.teams[teamB]!.roster[0],
          fromTeamId: teamB,
          toTeamId: teamA,
        },
      }),
    ];
    state = appendSeasonEventLog(state, events);
    expect(state.competition.seasonEventLog).toHaveLength(2);

    const leagueView = toSeasonTransactionsView(state, {
      scope: "league",
      type: "all",
      sort: "newest",
      page: 0,
      pageSize: 50,
    });
    expect(leagueView.total).toBe(2);
  });
});

describe("migration v45", () => {
  it("adds rosterManagement and seasonEventLog when loading v44-shaped saves", () => {
    const state = generateRosters(createTestGameState(), createTestRng(2)).state;
    // Simulate a serialized v44 payload missing the new fields
    const legacy = structuredClone(state) as Record<string, unknown>;
    const meta = legacy.meta as { schemaVersion: number };
    meta.schemaVersion = 44;
    const world = legacy.world as {
      teams: Record<string, Record<string, unknown>>;
    };
    for (const team of Object.values(world.teams)) {
      delete team.rosterManagement;
    }
    const competition = legacy.competition as Record<string, unknown>;
    delete competition.seasonEventLog;

    const migrated = deserializeGameState(JSON.stringify(legacy));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.competition.seasonEventLog).toEqual([]);
    for (const team of Object.values(migrated.world.teams)) {
      expect(team.rosterManagement).toBeDefined();
      expect(team.rosterManagement.startingLineup.length).toBeGreaterThan(0);
    }
  });
});

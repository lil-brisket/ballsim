import { describe, expect, it } from "vitest";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { asPlayerId } from "@/domain/ids";
import { projectSaveEntities } from "@/persistence/mappers/save-projection-mapper";
import { createPlayer } from "../factories/player";
import { createTestGameState } from "../factories/game-state";

describe("projectSaveEntities", () => {
  it("projects teams from GameState in domain-id order", () => {
    const state = createTestGameState({ saveId: "save_project_teams" });
    const { teams } = projectSaveEntities(state);
    const domainTeams = Object.values(state.world.teams);

    expect(teams).toHaveLength(domainTeams.length);
    expect(teams.map((row) => row.teamId)).toEqual(
      [...domainTeams.map((team) => team.id)].sort(),
    );

    const sample = domainTeams[0]!;
    expect(teams.find((row) => row.teamId === sample.id)).toEqual({
      teamId: sample.id,
      name: sample.name,
      city: sample.city,
      abbreviation: sample.abbreviation,
      conferenceId: sample.conferenceId,
      divisionId: sample.divisionId,
      arenaId: sample.arenaId,
      reputation: sample.reputation,
    });
  });

  it("projects players including free agents, overall, and retired flag", () => {
    const state = createTestGameState({ saveId: "save_project_players" });
    const rostered = createPlayer({
      id: "player_b",
      teamId: Object.keys(state.world.teams)[0]!,
      firstName: "Bea",
      lastName: "Bench",
      position: "SG",
      potential: { overall: 88 },
    });
    const freeAgent = {
      ...createPlayer({
        id: "player_a",
        teamId: null,
        firstName: "Ada",
        lastName: "Agent",
        position: "C",
        availability: "out",
      }),
      retired: true as const,
    };
    const withPlayers = {
      ...state,
      world: {
        ...state.world,
        players: {
          [rostered.id]: rostered,
          [freeAgent.id]: freeAgent,
        },
      },
    };

    const { players } = projectSaveEntities(withPlayers);
    expect(players.map((row) => row.playerId)).toEqual([
      asPlayerId("player_a"),
      asPlayerId("player_b"),
    ]);
    expect(players[0]).toEqual({
      playerId: freeAgent.id,
      teamId: null,
      firstName: "Ada",
      lastName: "Agent",
      position: "C",
      age: freeAgent.age,
      overall: calculatePlayerOverall(freeAgent.position, freeAgent.attributes),
      potentialOverall: freeAgent.potential.overall,
      availability: "out",
      retired: true,
    });
    expect(players[1]).toMatchObject({
      playerId: rostered.id,
      teamId: rostered.teamId,
      retired: false,
      overall: calculatePlayerOverall(rostered.position, rostered.attributes),
      potentialOverall: 88,
    });
  });

  it("returns empty projections when the world has no teams or players", () => {
    const state = createTestGameState({ saveId: "save_project_empty" });
    const empty = {
      ...state,
      world: {
        ...state.world,
        teams: {},
        players: {},
      },
    };
    expect(projectSaveEntities(empty)).toEqual({ teams: [], players: [] });
  });
});

import { describe, expect, it } from "vitest";
import { generateRosters } from "@/systems/roster-generation";
import { getEmergencyLineup } from "@/systems/roster-management";
import { simulateScheduledGame } from "@/systems/game-simulation";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

describe("lineup simulation integration", () => {
  it("uses saved starting lineup player ids when available", () => {
    const state = generateRosters(createTestGameState(), createTestRng(3)).state;
    const teamIds = Object.keys(state.world.teams).sort();
    const homeId = asTeamId(teamIds[0]!);
    const awayId = asTeamId(teamIds[1]!);
    const homeLineup = getEmergencyLineup(state, homeId);
    expect(homeLineup.emergency).toBe(false);
    expect(homeLineup.players).toHaveLength(5);

    const game = createGame({
      id: asGameId("game_lineup_test"),
      seasonId: state.competition.season.id,
      date: state.world.calendar.currentDate,
      homeTeamId: homeId,
      awayTeamId: awayId,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });

    const { finalGame } = simulateScheduledGame(state, game, createTestRng(9));
    expect(finalGame.status).toBe("final");
    const starterIds = new Set(homeLineup.players.map((player) => player.id));
    const homeMinutes = finalGame.playerStats.filter(
      (row) => row.teamId === homeId && row.minutes > 0,
    );
    expect(homeMinutes.some((row) => starterIds.has(row.playerId))).toBe(true);
  });
});

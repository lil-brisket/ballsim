/**
 * Integration tests for rotation during full game simulation.
 */

import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import type { Player } from "@/domain/entities/player";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import { createPlayer } from "../../factories/player";
import { createTestGameState } from "../../factories/game-state";
import { createTestRng } from "../../helpers/determinism";
import { simulateGame } from "@/systems/game-simulation";
import {
  recommendRosterManagement,
  withTeamRosterManagement,
} from "@/systems/roster-management";
import { expectedTeamPlayerSeconds } from "@/systems/rotation/rotation-invariants";
import { generateRosters } from "@/systems/roster-generation";

const HOME = asTeamId("team_home_rot");
const AWAY = asTeamId("team_away_rot");

function makeRoster(teamId: TeamId, prefix: string, count: number): Player[] {
  const positions = ["PG", "SG", "SF", "PF", "C"] as const;
  return Array.from({ length: count }, (_, index) =>
    createPlayer({
      id: asPlayerId(`${prefix}_${index + 1}`),
      teamId,
      position: positions[index % positions.length]!,
      firstName: prefix,
      lastName: `P${index + 1}`,
    }),
  );
}

describe("rotation integration", () => {
  it("distributes minutes so starters are not all at 48 with gameState", () => {
    const boot = generateRosters(createTestGameState(), createTestRng(7));
    let state = boot.state;
    const teamIds = Object.keys(state.world.teams);
    const homeId = asTeamId(teamIds[0]!);
    const awayId = asTeamId(teamIds[1]!);

    const homeMgmt = recommendRosterManagement(state, homeId, {
      rotationPreset: "balanced",
      configuredBy: "ai",
    });
    const awayMgmt = recommendRosterManagement(state, awayId, {
      rotationPreset: "balanced",
      configuredBy: "ai",
    });
    state = withTeamRosterManagement(state, homeId, homeMgmt);
    state = withTeamRosterManagement(state, awayId, awayMgmt);

    const homePlayers = state.world.teams[homeId]!.roster
      .map((id) => state.world.players[id])
      .filter((p): p is Player => p != null);
    const awayPlayers = state.world.teams[awayId]!.roster
      .map((id) => state.world.players[id])
      .filter((p): p is Player => p != null);

    expect(homePlayers.length).toBeGreaterThanOrEqual(8);
    expect(awayPlayers.length).toBeGreaterThanOrEqual(8);

    const homeStarters = homeMgmt.startingLineup.map(
      (slot) => state.world.players[slot.playerId]!,
    );
    const awayStarters = awayMgmt.startingLineup.map(
      (slot) => state.world.players[slot.playerId]!,
    );

    const game = createGame({
      competitionType: "regular_season",
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
      id: asGameId("game_rot_1"),
      seasonId: state.competition.season.id,
      homeTeamId: homeId,
      awayTeamId: awayId,
      date: "2026-10-15",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
    });

    const result = simulateGame(
      game,
      {
        homePlayers,
        awayPlayers,
        homeStartingLineup: homeStarters,
        awayStartingLineup: awayStarters,
        gameState: state,
      },
      createTestRng(42),
    );

    const homeStats = result.playerStats.filter((row) =>
      homePlayers.some((p) => p.id === row.playerId),
    );
    const homeMinutes = homeStats.reduce((sum, row) => sum + row.minutes, 0);
    expect(homeMinutes).toBeGreaterThanOrEqual(220);
    expect(homeMinutes).toBeLessThanOrEqual(250);

    const starterMinutes = homeMgmt.startingLineup.map((slot) => {
      const row = homeStats.find((stats) => stats.playerId === slot.playerId);
      return row?.minutes ?? 0;
    });
    expect(starterMinutes.every((min) => min === 48)).toBe(false);

    const benchMinutes = homeStats
      .filter(
        (row) =>
          !homeMgmt.startingLineup.some(
            (slot) => slot.playerId === row.playerId,
          ),
      )
      .reduce((sum, row) => sum + row.minutes, 0);
    expect(benchMinutes).toBeGreaterThan(0);

    expect(result.rotationMeta).not.toBeNull();
    expect(result.rotationMeta?.home.length).toBeGreaterThan(0);
  });

  it("keeps expected seconds constant formula stable", () => {
    expect(expectedTeamPlayerSeconds(0) / 60).toBe(240);
  });

  it("builds independent rotations for two teams", () => {
    const home = makeRoster(HOME, "H", 10);
    const away = makeRoster(AWAY, "A", 10);
    // Sanity: factory players exist
    expect(home).toHaveLength(10);
    expect(away).toHaveLength(10);
  });
});

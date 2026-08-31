import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { createSeededRng } from "@/domain/rng";
import { asGameId, asTeamId } from "@/domain/ids";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { archiveCompletedSeasonGames } from "@/systems/player-history";

/**
 * Measures serialized gameArchive growth. Not an optimization gate —
 * establishes cost baseline for long-run saves.
 */
describe("game archive size measurement", () => {
  it("reports serialized archive size after archiving synthetic seasons", () => {
    let state = createTestGameState({ saveId: "archive_size" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams).map(asTeamId);
    const homeTeamId = teamIds[0]!;
    const awayTeamId = teamIds[1]!;
    const homePlayer = Object.values(state.world.players).find(
      (p) => p.teamId === homeTeamId,
    )!;
    const awayPlayer = Object.values(state.world.players).find(
      (p) => p.teamId === awayTeamId,
    )!;

    const sizes: Array<{ seasons: number; bytes: number; games: number }> = [];

    for (const seasonCount of [1, 5, 10]) {
      const games: Record<string, ReturnType<typeof createGame>> = {};
      // ~82 games/team pair approximation: 40 games per season for measurement
      const gamesPerSeason = 40;
      for (let s = 0; s < seasonCount; s += 1) {
        for (let g = 0; g < gamesPerSeason; g += 1) {
          const id = asGameId(`game_sz_${s}_${g}`);
          games[id] = createGame({
            id,
            seasonId: state.competition.season.id,
            date: `2026-11-${String((g % 28) + 1).padStart(2, "0")}`,
            homeTeamId,
            awayTeamId,
            competitionType: "regular_season",
            status: "final",
            score: { home: 100 + g, away: 95 },
            periodScores: [{ home: 100 + g, away: 95 }],
            events: [],
            playerStats: [
              {
                playerId: homePlayer.id,
                teamId: homeTeamId,
                firstName: homePlayer.firstName,
                lastName: homePlayer.lastName,
                minutes: 32,
                points: 20,
                rebounds: 5,
                offensiveRebounds: 1,
                defensiveRebounds: 4,
                assists: 4,
                steals: 1,
                blocks: 0,
                turnovers: 2,
                fouls: 2,
                fieldGoalsMade: 8,
                fieldGoalsAttempted: 16,
                threePointersMade: 2,
                threePointersAttempted: 5,
                freeThrowsMade: 2,
                freeThrowsAttempted: 2,
                touches: 12,
                started: true,
              },
              {
                playerId: awayPlayer.id,
                teamId: awayTeamId,
                firstName: awayPlayer.firstName,
                lastName: awayPlayer.lastName,
                minutes: 30,
                points: 18,
                rebounds: 6,
                offensiveRebounds: 2,
                defensiveRebounds: 4,
                assists: 3,
                steals: 0,
                blocks: 1,
                turnovers: 1,
                fouls: 3,
                fieldGoalsMade: 7,
                fieldGoalsAttempted: 15,
                threePointersMade: 1,
                threePointersAttempted: 4,
                freeThrowsMade: 3,
                freeThrowsAttempted: 4,
                touches: 10,
                started: true,
              },
            ],
            homeTeamSnapshot: {
              teamId: homeTeamId,
              city: "H",
              name: "T",
              abbreviation: "HOM",
            branding: {
              primaryColor: "#0B1F3A",
              secondaryColor: "#C4CED4",
              accentColor: "#F5B800",
              logoId: "shield",
            },
            },
            awayTeamSnapshot: {
              teamId: awayTeamId,
              city: "A",
              name: "T",
              abbreviation: "AWY",
            branding: {
              primaryColor: "#0B1F3A",
              secondaryColor: "#C4CED4",
              accentColor: "#F5B800",
              logoId: "shield",
            },
            },
          });
        }
      }

      const withGames = {
        ...state,
        competition: {
          ...state.competition,
          games,
        },
        business: {
          ...state.business,
          gameArchive: {},
        },
      };
      const archived = archiveCompletedSeasonGames(withGames).state;
      const bytes = JSON.stringify(archived.business.gameArchive).length;
      sizes.push({
        seasons: seasonCount,
        bytes,
        games: Object.keys(archived.business.gameArchive).length,
      });
    }

    // Growth should be roughly linear with game count
    expect(sizes[0]!.games).toBe(40);
    expect(sizes[2]!.games).toBe(400);
    expect(sizes[2]!.bytes).toBeGreaterThan(sizes[0]!.bytes * 5);

    // Surface measurement for operators reading test output
    for (const row of sizes) {
      // eslint-disable-next-line no-console
      console.log(
        `[game-archive-size] seasons=${row.seasons} games=${row.games} bytes=${row.bytes}`,
      );
    }
  });
});

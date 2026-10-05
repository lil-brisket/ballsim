import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { checkInvariants } from "@/simulation/lab/check-invariants";
import { generateValidationRosters } from "@/simulation/validation";
import { simulateGame } from "@/systems/game-simulation";

const SEASON_ID = asSeasonId("season_pbt");

function scheduledGame(
  gameIndex: number,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
) {
  return createGame({
    competitionType: "regular_season",
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    id: asGameId(`pbt_game_${gameIndex}`),
    seasonId: SEASON_ID,
    homeTeamId,
    awayTeamId,
    date: "2026-10-15",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

describe("simulateGame property invariants", () => {
  it("holds hard game invariants across 1000 random seeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0x7fffffff }), (seed) => {
        const rng = createSeededRng(seed);
        const { homePlayers, awayPlayers } = generateValidationRosters(rng);
        const result = simulateGame(
          scheduledGame(seed, homePlayers[0]!.teamId!, awayPlayers[0]!.teamId!),
          { homePlayers, awayPlayers },
          rng,
        );
        const failures = checkInvariants(
          {
            result,
            homePlayers,
            awayPlayers,
            homePlayerIds: new Set(homePlayers.map((p) => p.id as string)),
            awayPlayerIds: new Set(awayPlayers.map((p) => p.id as string)),
            rotation: "off",
          },
          0,
          seed,
        );
        expect(failures).toEqual([]);
      }),
      { numRuns: 1000 },
    );
  }, 600_000);
});

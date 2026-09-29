import { describe, expect, it } from "vitest";
import { checkInvariants } from "@/simulation/lab/check-invariants";
import {
  createLabGameSession,
  labGamePlayerIds,
  labGameRosters,
  playLabGame,
} from "@/simulation/lab/lab-game-session";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

describe("checkInvariants", () => {
  it("passes a completed Lab game", () => {
    const session = createLabGameSession({
      seed: 3,
      games: 1,
      rotation: "off",
    });
    const played = playLabGame(session, 0);
    const ids = labGamePlayerIds(session, 0);
    const rosters = labGameRosters(session, 0);
    const failures = checkInvariants(
      {
        result: played.result,
        homePlayers: rosters.homePlayers,
        awayPlayers: rosters.awayPlayers,
        homePlayerIds: ids.homePlayerIds,
        awayPlayerIds: ids.awayPlayerIds,
        rotation: "off",
        thrown: played.thrown,
      },
      0,
      played.gameSeed,
    );
    expect(played.result).not.toBeNull();
    expect(failures.filter((item) => item.rule === "ROSTER_SIZE")).toEqual([]);
    expect(failures.filter((item) => item.rule === "CLOCK_NEGATIVE")).toEqual(
      [],
    );
    expect(failures.filter((item) => item.rule === "SCORE_NONNEG")).toEqual([]);
    expect(
      failures.filter((item) => item.rule === "PLAYER_SUM_EQ_TEAM"),
    ).toEqual([]);
  });

  it("flags negative scores, negative clock, foul overflow, and tiny rosters", () => {
    const session = createLabGameSession({
      seed: 3,
      games: 1,
      rotation: "on",
    });
    const played = playLabGame(session, 0);
    expect(played.result).not.toBeNull();
    const result = played.result!;
    const ids = labGamePlayerIds(session, 0);
    const rosters = labGameRosters(session, 0);
    const firstPlayer = result.playerStats[0]!;
    const mutated = {
      ...result,
      score: { home: -4, away: result.score.away },
      playerStats: result.playerStats.map((row, index) =>
        index === 0
          ? {
              ...row,
              minutes: -1,
              fouls: ROTATION_CONFIG.personalFoulLimit + 3,
            }
          : row,
      ),
    };
    const failures = checkInvariants(
      {
        result: mutated,
        homePlayers: rosters.homePlayers.slice(0, 2),
        awayPlayers: rosters.awayPlayers,
        homePlayerIds: ids.homePlayerIds,
        awayPlayerIds: ids.awayPlayerIds,
        rotation: "on",
        thrown: [],
      },
      0,
      played.gameSeed,
    );
    const rules = new Set(failures.map((item) => item.rule));
    expect(rules.has("SCORE_NONNEG")).toBe(true);
    expect(rules.has("CLOCK_NEGATIVE")).toBe(true);
    expect(rules.has("FOUL_LIMIT")).toBe(true);
    expect(rules.has("ROSTER_SIZE")).toBe(true);
    expect(
      failures.some((item) =>
        item.detail.includes(String(firstPlayer.playerId)),
      ),
    ).toBe(true);
  });
});

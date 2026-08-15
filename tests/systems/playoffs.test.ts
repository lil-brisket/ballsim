import { describe, expect, it } from "vitest";
import { playoffRoundLabel } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import {
  bracketSeedOrder,
  generateBracket,
} from "@/systems/playoff-bracket";
import {
  getHomeTeamForGame,
  getPlayoffTeamCount,
  SERIES_WINS_TO_CLINCH,
} from "@/systems/playoff-config";
import { qualifyAndSeed } from "@/systems/playoff-qualification";
import { createNextPlayoffGame } from "@/systems/playoff-scheduling";
import { recordSeriesGameResult } from "@/systems/playoff-series";

describe("getPlayoffTeamCount", () => {
  it.each([
    [4, 0],
    [7, 0],
    [8, 8],
    [10, 8],
    [15, 8],
    [16, 16],
    [20, 16],
    [31, 16],
    [32, 32],
    [63, 32],
    [64, 64],
    [80, 64],
  ] as const)("teamCount %i → %i", (teamCount, expected) => {
    expect(getPlayoffTeamCount(teamCount)).toBe(expected);
  });
});

describe("getHomeTeamForGame", () => {
  const series = {
    higherSeedTeamId: "team_high",
    lowerSeedTeamId: "team_low",
  };

  it("follows 2-2-1-1-1 higher/lower pattern", () => {
    expect(getHomeTeamForGame(series, 0)).toBe("team_high");
    expect(getHomeTeamForGame(series, 1)).toBe("team_high");
    expect(getHomeTeamForGame(series, 2)).toBe("team_low");
    expect(getHomeTeamForGame(series, 3)).toBe("team_low");
    expect(getHomeTeamForGame(series, 4)).toBe("team_high");
    expect(getHomeTeamForGame(series, 5)).toBe("team_low");
    expect(getHomeTeamForGame(series, 6)).toBe("team_high");
  });
});

describe("qualifyAndSeed", () => {
  function standingsForSeeds(teamCount: number) {
    return Array.from({ length: teamCount }, (_, index) => {
      const standing = createEmptyTeamStanding(asTeamId(`team_${index + 1}`));
      return {
        ...standing,
        wins: teamCount - index,
        losses: index,
        winPercentage: (teamCount - index) / teamCount,
      };
    });
  }

  it.each([8, 16] as const)(
    "returns exactly %i unique seeds 1..N in standings order",
    (fieldSize) => {
      const standings = standingsForSeeds(fieldSize + 2);
      const qualified = qualifyAndSeed(standings, fieldSize);
      expect(qualified).toHaveLength(fieldSize);
      expect(qualified.map((entry) => entry.seed)).toEqual(
        Array.from({ length: fieldSize }, (_, index) => index + 1),
      );
      expect(new Set(qualified.map((entry) => entry.teamId)).size).toBe(
        fieldSize,
      );
      expect(qualified[0]!.teamId).toBe("team_1");
      expect(qualified[fieldSize - 1]!.teamId).toBe(`team_${fieldSize}`);
    },
  );

  it("is deterministic for identical standings", () => {
    const standings = standingsForSeeds(10);
    expect(qualifyAndSeed(standings, 8)).toEqual(
      qualifyAndSeed(standings, 8),
    );
  });

  it("throws when standings are fewer than playoffTeams", () => {
    expect(() => qualifyAndSeed(standingsForSeeds(4), 8)).toThrow(
      /at least 8 standing/,
    );
  });
});

describe("generateBracket", () => {
  function seeds(fieldSize: number) {
    return Array.from({ length: fieldSize }, (_, index) => ({
      teamId: asTeamId(`team_${index + 1}`),
      seed: index + 1,
    }));
  }

  it("builds classic 8-team opening matchups and 7 series", () => {
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const tournament = generateBracket(seeds(8));
    expect(tournament.fieldSize).toBe(8);
    expect(tournament.series).toHaveLength(7);
    expect(tournament.status).toBe("in_progress");

    const opening = tournament.series
      .filter((series) => series.round === 0)
      .sort((left, right) => left.slot - right.slot);
    expect(opening).toHaveLength(4);
    expect(
      opening.map((series) => [series.higherSeed, series.lowerSeed]),
    ).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
    expect(opening.every((series) => series.status === "active")).toBe(true);

    const later = tournament.series.filter((series) => series.round > 0);
    expect(later).toHaveLength(3);
    expect(later.every((series) => series.status === "pending")).toBe(true);

    expect(playoffRoundLabel(0, 8)).toBe("quarterfinal");
    expect(playoffRoundLabel(1, 8)).toBe("semifinal");
    expect(playoffRoundLabel(2, 8)).toBe("final");
  });

  it("builds a 16-team bracket with 15 series and fixed feeders", () => {
    const tournament = generateBracket(seeds(16));
    expect(tournament.series).toHaveLength(15);
    expect(tournament.series.filter((series) => series.round === 0)).toHaveLength(
      8,
    );
    expect(Math.log2(16)).toBe(4);

    const opening = tournament.series
      .filter((series) => series.round === 0)
      .sort((left, right) => left.slot - right.slot);
    expect(opening[0]).toMatchObject({ higherSeed: 1, lowerSeed: 16 });

    const sfFeeders = tournament.series.find(
      (series) => series.round === 1 && series.slot === 0,
    );
    expect(sfFeeders?.feederSeriesIds).toEqual([
      "playoff_r0_s0",
      "playoff_r0_s1",
    ]);
  });

  it("does not reseed: later rounds use feeder slots only", () => {
    const tournament = generateBracket(seeds(8));
    const final = tournament.series.find(
      (series) => series.round === 2 && series.slot === 0,
    )!;
    expect(final.higherSeedTeamId).toBeNull();
    expect(final.feederSeriesIds).toEqual([
      "playoff_r1_s0",
      "playoff_r1_s1",
    ]);
  });
});

describe("createNextPlayoffGame", () => {
  it("assigns home court from the 2-2-1-1-1 pattern independently of seed alone", () => {
    const tournament = generateBracket(
      Array.from({ length: 8 }, (_, index) => ({
        teamId: asTeamId(`team_${index + 1}`),
        seed: index + 1,
      })),
    );
    let series = tournament.series[0]!;
    const high = series.higherSeedTeamId!;
    const low = series.lowerSeedTeamId!;
    const expectedHomes = [high, high, low, low, high, low, high];

    for (let gameIndex = 0; gameIndex < 4; gameIndex += 1) {
      const game = createNextPlayoffGame({
        series,
        seasonId: asSeasonId("season_home"),
        nextDate: `2027-01-0${gameIndex + 1}`,
      });
      expect(game.homeTeamId).toBe(expectedHomes[gameIndex]);
      expect(game.awayTeamId).toBe(game.homeTeamId === high ? low : high);
      series = {
        ...series,
        gameIds: [...series.gameIds, game.id],
      };
    }
  });
});

describe("recordSeriesGameResult", () => {
  function activeSeries() {
    const higher = asTeamId("team_a");
    const lower = asTeamId("team_b");
    return generateBracket([
      { teamId: higher, seed: 1 },
      { teamId: asTeamId("team_c"), seed: 2 },
      { teamId: asTeamId("team_d"), seed: 3 },
      { teamId: asTeamId("team_e"), seed: 4 },
      { teamId: asTeamId("team_f"), seed: 5 },
      { teamId: asTeamId("team_g"), seed: 6 },
      { teamId: asTeamId("team_h"), seed: 7 },
      { teamId: lower, seed: 8 },
    ]).series[0]!;
  }

  it("stops at four wins and rejects further games", () => {
    let series = activeSeries();
    const winner = series.higherSeedTeamId!;
    for (let game = 0; game < SERIES_WINS_TO_CLINCH; game += 1) {
      series = recordSeriesGameResult(
        series,
        asGameId(`g_${game}`),
        winner,
      );
    }
    expect(series.status).toBe("complete");
    expect(series.winnerTeamId).toBe(winner);
    expect(series.wins[winner]).toBe(4);
    expect(series.gameIds).toHaveLength(4);
    expect(() =>
      recordSeriesGameResult(series, asGameId("g_extra"), winner),
    ).toThrow(/complete/);
  });

  it("allows 4–7 games before clinch", () => {
    let series = activeSeries();
    const high = series.higherSeedTeamId!;
    const low = series.lowerSeedTeamId!;
    const sequence = [high, low, high, low, high, low, high];
    for (let index = 0; index < sequence.length; index += 1) {
      series = recordSeriesGameResult(
        series,
        asGameId(`g_${index}`),
        sequence[index]!,
      );
    }
    expect(series.gameIds).toHaveLength(7);
    expect(series.status).toBe("complete");
    expect(series.winnerTeamId).toBe(high);
    expect(series.wins[high]).toBe(4);
    expect(series.wins[low]).toBe(3);
  });
});

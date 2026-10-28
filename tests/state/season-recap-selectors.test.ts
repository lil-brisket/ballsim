import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import type {
  AnnualFranchiseReport,
  TrajectoryArrow,
  YoYMetric,
} from "@/domain/entities/annual-franchise-report";
import type { PlayoffResultSnapshot } from "@/domain/entities/franchise-history";
import type { Game } from "@/domain/entities/game";
import { asSeasonId, asTeamId } from "@/domain/ids";
import { toDashboardMomentsView } from "@/state/dashboard-moments";
import type { GameState } from "@/state/game-state";
import {
  listRecapSeasons,
  toSeasonRecapView,
} from "@/state/season-recap-selectors";
import { createTestGame } from "../factories/game";
import { createTestGameState } from "../factories/game-state";
import {
  awardResult,
  playerSeason,
  seasonRecord,
  withAwards,
  withFranchiseHistory,
  withPlayerHistory,
} from "./history-fixtures";

const base = bootstrapWorld(
  createTestGameState({ saveId: "season_recap" }),
  createSeededRng("recap"),
).state;
const teamId = base.user.activeOwnerTeamId as string;
const otherId = Object.keys(base.world.teams)
  .sort()
  .find((id) => id !== teamId) as string;
const rosterIds = base.world.teams[teamId]!.roster.map(String);

function metric(value: number, prior: number | null = null): YoYMetric {
  return {
    value,
    prior,
    delta: prior === null ? null : value - prior,
    deltaPct: null,
  };
}

function report(
  year: number,
  overrides: {
    wins?: number;
    losses?: number;
    playoffResult?: PlayoffResultSnapshot;
    championship?: boolean;
    netIncome?: YoYMetric;
    leagueRank?: number | null;
    trajectory?: Partial<
      Record<"competitive" | "financial" | "brand", TrajectoryArrow>
    >;
  } = {},
): AnnualFranchiseReport {
  return {
    teamId: asTeamId(teamId),
    seasonYear: year,
    generatedAt: "2027-07-01T00:00:00.000Z",
    competitive: {
      wins: overrides.wins ?? 50,
      losses: overrides.losses ?? 32,
      winPct: metric(0.6),
      leagueRank: overrides.leagueRank === undefined ? 3 : overrides.leagueRank,
      playoffResult: overrides.playoffResult ?? "missed",
      championship: overrides.championship ?? false,
      rosterStrength: metric(70),
    },
    financial: {
      startingCash: 1,
      endingCash: metric(20_000_000, 18_000_000),
      revenue: metric(100),
      expenses: metric(90),
      netIncome: overrides.netIncome ?? metric(12_000_000, 10_800_000),
      payroll: metric(80),
    },
    franchiseTrajectory: {
      competitive: overrides.trajectory?.competitive ?? "up",
      financial: overrides.trajectory?.financial ?? "flat",
      commercial: "flat",
      organizational: "flat",
      brand: overrides.trajectory?.brand ?? "down",
      overall: "neutral",
    },
  } as unknown as AnnualFranchiseReport;
}

type Setup = {
  reports?: AnnualFranchiseReport[];
  year?: number;
  phase?: GameState["competition"]["season"]["phase"];
  seasonYears?: number[];
};

function setup(input: Setup = {}): GameState {
  const reports = input.reports ?? [report(2027)];
  const year = input.year ?? 2027;
  const cache: Record<string, AnnualFranchiseReport> = {};
  for (const r of reports) cache[String(r.seasonYear)] = r;
  const state: GameState = {
    ...base,
    business: {
      ...base.business,
      franchiseReportCache: { [teamId]: cache },
    },
    competition: {
      ...base.competition,
      season: {
        ...base.competition.season,
        year,
        phase: input.phase ?? "offseason",
      },
    },
  };
  return withFranchiseHistory(state, {
    [teamId]: (input.seasonYears ?? reports.map((r) => r.seasonYear)).map((y) =>
      seasonRecord({ year: y }),
    ),
  });
}

function game(
  id: string,
  options: {
    home?: boolean;
    teamScore: number;
    oppScore: number;
    periods?: number;
    playoff?: boolean;
    date?: string;
    year?: number;
    status?: Game["status"];
  },
): Game {
  const home = options.home ?? true;
  const periods = options.periods ?? 4;
  const score = home
    ? { home: options.teamScore, away: options.oppScore }
    : { home: options.oppScore, away: options.teamScore };
  return createTestGame({
    id: id as never,
    seasonId: asSeasonId(`season_${options.year ?? 2027}`),
    homeTeamId: asTeamId(home ? teamId : otherId),
    awayTeamId: asTeamId(home ? otherId : teamId),
    date: options.date ?? "2026-11-03",
    competitionType: options.playoff ? "playoffs" : "regular_season",
    status: options.status ?? "final",
    score,
    periodScores: Array.from({ length: periods }, () => ({
      home: 0,
      away: 0,
    })),
  });
}

function withGames(state: GameState, games: Game[]): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      games: Object.fromEntries(games.map((g) => [g.id, g])),
    },
  };
}

describe("toSeasonRecapView", () => {
  it("reports a missed playoff run without a seed", () => {
    const view = toSeasonRecapView(setup())!;
    expect(view.seasonYear).toBe(2027);
    expect(view.teamId).toBe(teamId);
    expect(view.wins).toBe(50);
    expect(view.losses).toBe(32);
    expect(view.leagueRank).toBe(3);
    expect(view.playoffResult).toBe("missed");
    expect(view.playoffLabel).toBe("Missed the playoffs");
    expect(view.seed).toBeNull();
    expect(view.championship).toBe(false);
  });

  it("labels playoff results", () => {
    const labels: Array<[PlayoffResultSnapshot, string]> = [
      ["first_round", "Lost in the first round"],
      ["second_round", "Lost in the second round"],
      ["conference_finals", "Lost in the conference finals"],
      ["finals", "Lost in the Finals"],
    ];
    for (const [result, label] of labels) {
      const view = toSeasonRecapView(
        setup({ reports: [report(2027, { playoffResult: result })] }),
      )!;
      expect(view.playoffLabel).toBe(label);
    }
  });

  it("marks a title season", () => {
    const view = toSeasonRecapView(
      setup({
        reports: [
          report(2027, { playoffResult: "champion", championship: true }),
        ],
      }),
    )!;
    expect(view.championship).toBe(true);
    expect(view.playoffLabel).toBe("Won the title");
  });

  it("keeps year-over-year values null in a first season", () => {
    const view = toSeasonRecapView(
      setup({
        reports: [
          report(2027, {
            netIncome: metric(5_000_000),
          }),
        ],
      }),
    )!;
    expect(view.finances.netIncome.prior).toBeNull();
    expect(view.finances.netIncome.delta).toBeNull();
  });

  it("carries finances and the trajectory arrows", () => {
    const view = toSeasonRecapView(setup())!;
    expect(view.finances.netIncome.delta).toBe(1_200_000);
    expect(view.finances.endingCash.value).toBe(20_000_000);
    expect(view.trajectory).toEqual({
      competitive: "up",
      financial: "flat",
      brand: "down",
    });
  });

  it("picks the best wins: overtime first, then margin, then playoffs", () => {
    const state = withGames(setup(), [
      game("g_loss", { teamScore: 90, oppScore: 120 }),
      game("g_big", { teamScore: 130, oppScore: 90 }),
      game("g_ot", { teamScore: 101, oppScore: 100, periods: 5 }),
      game("g_2ot", { teamScore: 99, oppScore: 98, periods: 6 }),
      game("g_mid", { teamScore: 110, oppScore: 90, home: false }),
      game("g_mid_po", { teamScore: 110, oppScore: 90, playoff: true }),
      game("g_sched", {
        teamScore: 0,
        oppScore: 0,
        status: "scheduled",
      }),
      game("g_old", { teamScore: 200, oppScore: 1, year: 2026 }),
    ]);
    const view = toSeasonRecapView(state)!;
    expect(view.bestGames.map((g) => g.gameId)).toEqual([
      "g_2ot",
      "g_ot",
      "g_big",
    ]);
    expect(view.bestGames[0]).toMatchObject({
      overtimes: 2,
      margin: 1,
      home: true,
      playoff: false,
    });

    const more = toSeasonRecapView(
      withGames(setup(), [
        game("g_mid", { teamScore: 110, oppScore: 90, home: false }),
        game("g_mid_po", { teamScore: 110, oppScore: 90, playoff: true }),
      ]),
    )!;
    expect(more.bestGames.map((g) => g.gameId)).toEqual(["g_mid_po", "g_mid"]);
    expect(more.bestGames[1]).toMatchObject({
      home: false,
      teamScore: 110,
      opponentScore: 90,
      opponentAbbreviation: base.world.teams[otherId]!.abbreviation,
    });
  });

  it("has no games when the season is not in the franchise history", () => {
    const state = withGames(setup({ seasonYears: [] }), [
      game("g1", { teamScore: 100, oppScore: 90 }),
    ]);
    expect(toSeasonRecapView(state)!.bestGames).toEqual([]);
  });

  it("lists only the owner's award wins in awards-night order", () => {
    const state = withAwards(setup(), [
      awardResult({
        awardId: "mvp",
        seasonYear: 2027,
        winnerId: rosterIds[0]!,
        teamId,
      }),
      awardResult({
        awardId: "roy",
        seasonYear: 2027,
        winnerId: rosterIds[1]!,
        teamId,
      }),
      awardResult({
        awardId: "dpoy",
        seasonYear: 2027,
        winnerId: "someone_else",
        teamId: otherId,
      }),
    ]);
    const view = toSeasonRecapView(state)!;
    expect(view.awardWinners.map((a) => a.awardName)).toEqual([
      "Rookie of the Year",
      "Most Valuable Player",
    ]);
    const roster = base.world.players[rosterIds[1]!]!;
    expect(view.awardWinners[0]!.winnerName).toBe(
      `${roster.firstName} ${roster.lastName}`,
    );
    expect(toSeasonRecapView(setup())!.awardWinners).toEqual([]);
  });

  it("picks the best player by production per game, over enough games", () => {
    // Per game: PTS + REB + AST + STL + BLK − TOV.
    function season(
      overall: number,
      games: number,
      team: string | null,
      perGame: { pts: number; reb: number; ast: number; tov?: number },
    ) {
      const record = playerSeason({ year: 2027, teamId: team });
      return {
        ...record,
        overall,
        competition: {
          ...record.competition,
          regular: {
            ...record.competition.regular,
            games,
            points: games * perGame.pts,
            rebounds: games * perGame.reb,
            assists: games * perGame.ast,
            steals: 0,
            blocks: 0,
            turnovers: games * (perGame.tov ?? 0),
          },
        },
      };
    }
    const state = withPlayerHistory(setup(), {
      // Highest rated but less productive.
      [rosterIds[0]!]: [season(90, 50, teamId, { pts: 8, reb: 9, ast: 1 })],
      // Most productive over a full season: the pick.
      [rosterIds[3]!]: [
        season(78, 40, teamId, { pts: 20.26, reb: 7, ast: 4.04, tov: 2 }),
      ],
      // A hot streak under half the games of the busiest player: excluded.
      [rosterIds[4]!]: [season(70, 20, teamId, { pts: 40, reb: 10, ast: 10 })],
      // Other team and no games: ignored.
      [rosterIds[2]!]: [season(95, 60, otherId, { pts: 35, reb: 10, ast: 9 })],
      [rosterIds[1]!]: [season(85, 0, teamId, { pts: 0, reb: 0, ast: 0 })],
    });
    const view = toSeasonRecapView(state)!;
    const player = base.world.players[rosterIds[3]!]!;
    expect(view.bestPlayer).toMatchObject({
      playerId: rosterIds[3],
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      games: 40,
      points: 20.3,
      rebounds: 7,
      assists: 4,
    });

    // Equal per game: the higher season total, then the player id.
    const byTotal = withPlayerHistory(setup(), {
      [rosterIds[0]!]: [season(80, 30, teamId, { pts: 20, reb: 5, ast: 5 })],
      [rosterIds[4]!]: [season(80, 40, teamId, { pts: 20, reb: 5, ast: 5 })],
    });
    expect(toSeasonRecapView(byTotal)!.bestPlayer!.playerId).toBe(rosterIds[4]);
    const tie = withPlayerHistory(setup(), {
      [rosterIds[4]!]: [season(80, 40, teamId, { pts: 20, reb: 5, ast: 5 })],
      [rosterIds[0]!]: [season(80, 40, teamId, { pts: 20, reb: 5, ast: 5 })],
    });
    const expected = [rosterIds[0]!, rosterIds[4]!].sort()[0];
    expect(toSeasonRecapView(tie)!.bestPlayer!.playerId).toBe(expected);
    expect(toSeasonRecapView(setup())!.bestPlayer).toBeNull();
  });

  it("gives a seed only for the current season while the bracket is loaded", () => {
    const withSeed = (state: GameState): GameState => ({
      ...state,
      competition: {
        ...state.competition,
        playoffs: {
          ...state.competition.playoffs,
          qualifiedTeams: [{ teamId: asTeamId(teamId), seed: 4 }],
        },
      },
    });
    const reports = [report(2026), report(2027)];
    const state = withSeed(setup({ reports }));
    expect(toSeasonRecapView(state, 2027)!.seed).toBe(4);
    expect(toSeasonRecapView(state, 2026)!.seed).toBeNull();
    const notQualified = {
      ...state,
      competition: {
        ...state.competition,
        playoffs: { ...state.competition.playoffs, qualifiedTeams: [] },
      },
    };
    expect(toSeasonRecapView(notQualified, 2027)!.seed).toBeNull();
  });

  it("is current only in the offseason of the report's season", () => {
    const reports = [report(2026), report(2027)];
    expect(toSeasonRecapView(setup({ reports }))!.isCurrent).toBe(true);
    expect(toSeasonRecapView(setup({ reports }), 2026)!.isCurrent).toBe(false);
    for (const phase of ["regular", "playoffs", "postseason"] as const) {
      expect(toSeasonRecapView(setup({ reports, phase }))!.isCurrent).toBe(
        false,
      );
    }
    expect(toSeasonRecapView(setup({ reports, year: 2028 }))!.isCurrent).toBe(
      false,
    );
  });

  it("defaults to the latest season and honours an explicit one", () => {
    const state = setup({
      reports: [
        report(2025, { wins: 30, losses: 52 }),
        report(2027, { wins: 60, losses: 22 }),
        report(2026, { wins: 40, losses: 42 }),
      ],
    });
    expect(toSeasonRecapView(state)!.seasonYear).toBe(2027);
    expect(toSeasonRecapView(state, 2025)!.wins).toBe(30);
    expect(toSeasonRecapView(state, 2024)).toBeNull();
  });

  it("is null without a report", () => {
    expect(toSeasonRecapView(base)).toBeNull();
    expect(toSeasonRecapView(setup({ reports: [] }))).toBeNull();
    expect(toSeasonRecapView(setup(), 2027, "nobody")).toBeNull();
  });

  it("does not mutate state", () => {
    const state = withGames(setup(), [
      game("g1", { teamScore: 100, oppScore: 90 }),
    ]);
    const before = JSON.stringify(state);
    const first = toSeasonRecapView(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(toSeasonRecapView(state)).toEqual(first);
  });
});

describe("listRecapSeasons", () => {
  it("lists years with a report, newest first", () => {
    const state = setup({
      reports: [report(2025), report(2027), report(2026)],
    });
    expect(listRecapSeasons(state)).toEqual([2027, 2026, 2025]);
    expect(listRecapSeasons(base)).toEqual([]);
    expect(listRecapSeasons(state, "nobody")).toEqual([]);
  });
});

describe("toDashboardMomentsView recap", () => {
  it("includes the recap only when current", () => {
    expect(toDashboardMomentsView(setup()).recap?.seasonYear).toBe(2027);
    expect(
      toDashboardMomentsView(setup({ phase: "regular" })).recap,
    ).toBeNull();
  });
});

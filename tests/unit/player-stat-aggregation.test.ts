import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  GAME_COMPETITION_TYPES,
  type Game,
  type GameCompetitionType,
  type GamePlayerStats,
} from "@/domain/entities/game";
import { asGameId, asPlayerId, asSeasonId, asTeamId } from "@/domain/ids";
import {
  accumulatePlayerStatLine,
  addPlayerStatLines,
  aggregatePlayerGames,
  classifyCompetition,
  createEmptyPlayerStatLine,
  toPlayerSeasonStatLine,
} from "@/domain/player-stat-aggregation";

const PLAYER = asPlayerId("p1");
const HOME = asTeamId("t1");
const AWAY = asTeamId("t2");

function row(overrides: Partial<GamePlayerStats> = {}): GamePlayerStats {
  return {
    playerId: PLAYER,
    teamId: HOME,
    firstName: null,
    lastName: null,
    minutes: 30,
    points: 20,
    rebounds: 6,
    offensiveRebounds: 2,
    defensiveRebounds: 4,
    assists: 4,
    steals: 2,
    blocks: 1,
    turnovers: 3,
    fouls: 2,
    fieldGoalsMade: 8,
    fieldGoalsAttempted: 16,
    threePointersMade: 2,
    threePointersAttempted: 5,
    freeThrowsMade: 2,
    freeThrowsAttempted: 3,
    touches: 20,
    started: true,
    ...overrides,
  };
}

let gameCounter = 0;
function game(
  competitionType: GameCompetitionType,
  stats: GamePlayerStats[] = [row()],
): Game {
  gameCounter += 1;
  return {
    id: asGameId(`g${gameCounter}`),
    seasonId: asSeasonId("s1"),
    date: "2026-01-01",
    homeTeamId: HOME,
    awayTeamId: AWAY,
    competitionType,
    status: "final",
    score: { home: 100, away: 90 },
    periodScores: [],
    events: [],
    playerStats: stats,
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
  } as Game;
}

describe("classifyCompetition", () => {
  it("counts regular season, playoffs and development league only", () => {
    const classified = Object.fromEntries(
      GAME_COMPETITION_TYPES.map((type) => [type, classifyCompetition(type)]),
    );
    expect(classified).toEqual({
      preseason: null,
      regular_season: "regular",
      playoffs: "playoffs",
      development_league: "development",
      all_star: null,
      midseason_tournament: null,
    });
  });
});

describe("aggregatePlayerGames", () => {
  it("buckets by competition and excludes preseason, All-Star and tournament games", () => {
    const buckets = aggregatePlayerGames(
      [
        game("regular_season", [row({ points: 20 })]),
        game("regular_season", [row({ points: 10 })]),
        game("playoffs", [row({ points: 30 })]),
        game("development_league", [row({ points: 40 })]),
        game("preseason", [row({ points: 50 })]),
        game("midseason_tournament", [row({ points: 60 })]),
        game("all_star", [row({ points: 70 })]),
      ],
      PLAYER,
    );

    expect(buckets.regular.games).toBe(2);
    expect(buckets.regular.points).toBe(30);
    expect(buckets.playoffs.games).toBe(1);
    expect(buckets.playoffs.points).toBe(30);
    expect(buckets.development.points).toBe(40);
    expect(buckets.combined.games).toBe(3);
    expect(buckets.combined.points).toBe(60);
  });

  it("sums steals and blocks", () => {
    const buckets = aggregatePlayerGames(
      [
        game("regular_season", [row({ steals: 3, blocks: 0 })]),
        game("regular_season", [row({ steals: 1, blocks: 4 })]),
        game("playoffs", [row({ steals: 2, blocks: 2 })]),
      ],
      PLAYER,
    );
    expect(buckets.regular.steals).toBe(4);
    expect(buckets.regular.blocks).toBe(4);
    expect(buckets.combined.steals).toBe(6);
    expect(buckets.combined.blocks).toBe(6);
  });

  it("ignores games without a row for the player", () => {
    const other = row({ playerId: asPlayerId("p2") });
    const buckets = aggregatePlayerGames(
      [game("regular_season", [other])],
      PLAYER,
    );
    expect(buckets.combined).toEqual(createEmptyPlayerStatLine());
  });

  it("counts games started, rebound splits and fouls", () => {
    const buckets = aggregatePlayerGames(
      [
        game("regular_season", [row({ started: true, fouls: 4 })]),
        game("regular_season", [row({ started: false, fouls: 1 })]),
      ],
      PLAYER,
    );
    expect(buckets.regular.gamesStarted).toBe(1);
    expect(buckets.regular.offensiveRebounds).toBe(4);
    expect(buckets.regular.defensiveRebounds).toBe(8);
    expect(buckets.regular.fouls).toBe(5);
  });
});

describe("double-doubles and triple-doubles", () => {
  it("counts points, rebounds, assists, steals and blocks at 10 or more", () => {
    let line = createEmptyPlayerStatLine();
    line = accumulatePlayerStatLine(
      line,
      row({ points: 10, rebounds: 10, assists: 9 }),
    );
    line = accumulatePlayerStatLine(
      line,
      row({ points: 12, rebounds: 11, assists: 10 }),
    );
    line = accumulatePlayerStatLine(
      line,
      row({ points: 9, rebounds: 4, assists: 3, blocks: 10, steals: 10 }),
    );
    line = accumulatePlayerStatLine(line, row({ points: 30, rebounds: 9 }));
    expect(line.doubleDoubles).toBe(3);
    expect(line.tripleDoubles).toBe(1);
  });
});

describe("toPlayerSeasonStatLine", () => {
  it("narrows to exactly the persisted season-snapshot fields", () => {
    const narrowed = toPlayerSeasonStatLine(
      accumulatePlayerStatLine(createEmptyPlayerStatLine(), row()),
    );
    expect(Object.keys(narrowed).sort()).toEqual(
      [
        "assists",
        "blocks",
        "fgAttempted",
        "fgMade",
        "ftAttempted",
        "ftMade",
        "games",
        "minutes",
        "points",
        "rebounds",
        "steals",
        "threeAttempted",
        "threeMade",
        "turnovers",
      ].sort(),
    );
  });
});

describe("addPlayerStatLines", () => {
  it("summing per-game accumulation equals accumulating all games at once", () => {
    const statRow = fc.record({
      points: fc.nat(60),
      rebounds: fc.nat(25),
      assists: fc.nat(20),
      steals: fc.nat(8),
      blocks: fc.nat(8),
      minutes: fc.nat(48),
      started: fc.boolean(),
    });
    fc.assert(
      fc.property(
        fc.array(statRow, { maxLength: 20 }),
        fc.array(statRow, { maxLength: 20 }),
        (seasonA, seasonB) => {
          const accumulate = (rows: typeof seasonA) =>
            rows.reduce(
              (line, overrides) =>
                accumulatePlayerStatLine(line, row(overrides)),
              createEmptyPlayerStatLine(),
            );
          expect(
            addPlayerStatLines(accumulate(seasonA), accumulate(seasonB)),
          ).toEqual(accumulate([...seasonA, ...seasonB]));
        },
      ),
    );
  });
});

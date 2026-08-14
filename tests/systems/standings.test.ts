import { describe, expect, it } from "vitest";
import { createGame, type GameInput } from "@/domain/entities/game";
import type { TeamStanding } from "@/domain/entities/standings";
import {
  asGameId,
  asSeasonId,
  asTeamId,
  type GameId,
  type SeasonId,
} from "@/domain/ids";
import { calculateStandings } from "@/systems/standings";
import { createTeam } from "../factories/team";

const SEASON_A = asSeasonId("season_a");
const SEASON_B = asSeasonId("season_b");

function finalGame(
  overrides: Partial<GameInput> & {
    id: string;
    homeTeamId: string;
    awayTeamId: string;
    home: number;
    away: number;
    date?: string;
    seasonId?: SeasonId;
  },
) {
  return createGame({
    id: asGameId(overrides.id),
    seasonId: overrides.seasonId ?? SEASON_A,
    homeTeamId: asTeamId(overrides.homeTeamId),
    awayTeamId: asTeamId(overrides.awayTeamId),
    date: overrides.date ?? "2026-10-01",
    status: "final",
    score: { home: overrides.home, away: overrides.away },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

function scheduledGame(overrides: {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  date?: string;
}) {
  return createGame({
    id: asGameId(overrides.id),
    seasonId: SEASON_A,
    homeTeamId: asTeamId(overrides.homeTeamId),
    awayTeamId: asTeamId(overrides.awayTeamId),
    date: overrides.date ?? "2026-10-01",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
  });
}

function standingById(
  standings: TeamStanding[],
  teamId: string,
): TeamStanding {
  const entry = standings.find((row) => row.teamId === teamId);
  expect(entry).toBeDefined();
  return entry!;
}

describe("calculateStandings", () => {
  const eastA = createTeam({
    id: "team_east_a",
    conferenceId: "conf_east",
    divisionId: "div_east_a",
  });
  const eastB = createTeam({
    id: "team_east_b",
    conferenceId: "conf_east",
    divisionId: "div_east_a",
  });
  const eastC = createTeam({
    id: "team_east_c",
    conferenceId: "conf_east",
    divisionId: "div_east_b",
  });
  const westA = createTeam({
    id: "team_west_a",
    conferenceId: "conf_west",
    divisionId: "div_west_a",
  });

  it("includes teams with zero games", () => {
    const standings = calculateStandings([eastA, westA], []);
    expect(standings).toHaveLength(2);
    const empty = standingById(standings, "team_east_a");
    expect(empty).toMatchObject({
      wins: 0,
      losses: 0,
      winPercentage: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifferential: 0,
      streak: { type: null, count: 0 },
      conferenceWins: 0,
      conferenceLosses: 0,
      divisionWins: 0,
      divisionLosses: 0,
    });
  });

  it("records all wins and all losses", () => {
    const games = [
      finalGame({
        id: "g1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-01",
      }),
      finalGame({
        id: "g2",
        homeTeamId: "team_west_a",
        awayTeamId: "team_east_a",
        home: 95,
        away: 105,
        date: "2026-10-02",
      }),
    ];
    const standings = calculateStandings([eastA, westA], games);
    const winner = standingById(standings, "team_east_a");
    const loser = standingById(standings, "team_west_a");
    expect(winner.wins).toBe(2);
    expect(winner.losses).toBe(0);
    expect(winner.winPercentage).toBe(1);
    expect(loser.wins).toBe(0);
    expect(loser.losses).toBe(2);
    expect(loser.winPercentage).toBe(0);
  });

  it("records mixed results and points", () => {
    const games = [
      finalGame({
        id: "g1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-01",
      }),
      finalGame({
        id: "g2",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
        date: "2026-10-02",
      }),
    ];
    const standings = calculateStandings([eastA, westA], games);
    const east = standingById(standings, "team_east_a");
    expect(east.wins).toBe(1);
    expect(east.losses).toBe(1);
    expect(east.winPercentage).toBe(0.5);
    expect(east.pointsFor).toBe(200);
    expect(east.pointsAgainst).toBe(200);
    expect(east.pointDifferential).toBe(0);
  });

  it("computes points for, against, and differential", () => {
    const games = [
      finalGame({
        id: "g1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 120,
        away: 100,
      }),
    ];
    const standings = calculateStandings([eastA, westA], games);
    const east = standingById(standings, "team_east_a");
    const west = standingById(standings, "team_west_a");
    expect(east.pointsFor).toBe(120);
    expect(east.pointsAgainst).toBe(100);
    expect(east.pointDifferential).toBe(20);
    expect(west.pointsFor).toBe(100);
    expect(west.pointsAgainst).toBe(120);
    expect(west.pointDifferential).toBe(-20);
  });

  it("counts conference and division records only for matching opponents", () => {
    const games = [
      // same conference + division
      finalGame({
        id: "div",
        homeTeamId: "team_east_a",
        awayTeamId: "team_east_b",
        home: 100,
        away: 90,
        date: "2026-10-01",
      }),
      // same conference, different division
      finalGame({
        id: "conf",
        homeTeamId: "team_east_a",
        awayTeamId: "team_east_c",
        home: 100,
        away: 95,
        date: "2026-10-02",
      }),
      // non-conference
      finalGame({
        id: "non",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 98,
        date: "2026-10-03",
      }),
    ];
    const standings = calculateStandings(
      [eastA, eastB, eastC, westA],
      games,
    );
    const east = standingById(standings, "team_east_a");
    expect(east.wins).toBe(3);
    expect(east.conferenceWins).toBe(2);
    expect(east.conferenceLosses).toBe(0);
    expect(east.divisionWins).toBe(1);
    expect(east.divisionLosses).toBe(0);

    const west = standingById(standings, "team_west_a");
    expect(west.conferenceWins).toBe(0);
    expect(west.conferenceLosses).toBe(0);
    expect(west.divisionWins).toBe(0);
    expect(west.divisionLosses).toBe(0);
  });

  it("tracks winning streak, losing streak, and reset after opposite result", () => {
    const games = [
      finalGame({
        id: "g1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 90,
        date: "2026-10-01",
      }),
      finalGame({
        id: "g2",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 95,
        date: "2026-10-02",
      }),
      finalGame({
        id: "g3",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
        date: "2026-10-03",
      }),
      finalGame({
        id: "g4",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-04",
      }),
      finalGame({
        id: "g5",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 105,
        away: 100,
        date: "2026-10-05",
      }),
    ];
    // Results for east: W, W, L, W, W => W2
    const standings = calculateStandings([eastA, westA], games);
    expect(standingById(standings, "team_east_a").streak).toEqual({
      type: "W",
      count: 2,
    });
    expect(standingById(standings, "team_west_a").streak).toEqual({
      type: "L",
      count: 2,
    });
  });

  it("orders streak chronologically by date before schedule index", () => {
    const games = [
      finalGame({
        id: "later",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
        date: "2026-10-02",
      }),
      finalGame({
        id: "earlier",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-01",
      }),
    ];
    // Chronological: W then L => L1 (date primary even if order ids reverse)
    const standings = calculateStandings([eastA, westA], games, {
      gameOrderIds: [asGameId("later"), asGameId("earlier")],
    });
    expect(standingById(standings, "team_east_a").streak).toEqual({
      type: "L",
      count: 1,
    });
  });

  it("uses gameOrderIds only when dates are equal", () => {
    const games = [
      finalGame({
        id: "game_b",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
        date: "2026-10-01",
      }),
      finalGame({
        id: "game_a",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-01",
      }),
    ];
    // Order: game_a (W) then game_b (L) => L1
    const standings = calculateStandings([eastA, westA], games, {
      gameOrderIds: [asGameId("game_a"), asGameId("game_b")],
    });
    expect(standingById(standings, "team_east_a").streak).toEqual({
      type: "L",
      count: 1,
    });

    // Reverse order: L then W => W1
    const reversed = calculateStandings([eastA, westA], games, {
      gameOrderIds: [asGameId("game_b"), asGameId("game_a")],
    });
    expect(standingById(reversed, "team_east_a").streak).toEqual({
      type: "W",
      count: 1,
    });
  });

  it("falls back to game.id when dates are equal and order ids missing", () => {
    const games = [
      finalGame({
        id: "game_z",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
        date: "2026-10-01",
      }),
      finalGame({
        id: "game_a",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-01",
      }),
    ];
    // localeCompare: game_a (W) then game_z (L) => L1
    const standings = calculateStandings([eastA, westA], games);
    expect(standingById(standings, "team_east_a").streak).toEqual({
      type: "L",
      count: 1,
    });
  });

  it("excludes incomplete games", () => {
    const games = [
      scheduledGame({
        id: "sched",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
      }),
      createGame({
        id: asGameId("in_progress"),
        seasonId: SEASON_A,
        homeTeamId: asTeamId("team_east_a"),
        awayTeamId: asTeamId("team_west_a"),
        date: "2026-10-01",
        status: "in_progress",
        score: { home: 50, away: 40 },
        periodScores: [],
        events: [],
        playerStats: [],
      }),
    ];
    const standings = calculateStandings([eastA, westA], games);
    expect(standingById(standings, "team_east_a").wins).toBe(0);
    expect(standingById(standings, "team_east_a").losses).toBe(0);
  });

  it("excludes games from other seasons when seasonId is provided", () => {
    const games = [
      finalGame({
        id: "other",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 90,
        seasonId: SEASON_B,
      }),
      finalGame({
        id: "current",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 95,
        seasonId: SEASON_A,
      }),
    ];
    const standings = calculateStandings([eastA, westA], games, {
      seasonId: SEASON_A,
    });
    expect(standingById(standings, "team_east_a").wins).toBe(1);
  });

  it("ignores equal scores (no-tie invariant)", () => {
    const games = [
      finalGame({
        id: "tie",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 100,
      }),
    ];
    const standings = calculateStandings([eastA, westA], games);
    expect(standingById(standings, "team_east_a").wins).toBe(0);
    expect(standingById(standings, "team_east_a").losses).toBe(0);
  });

  it("orders standings by win percentage, wins, point differential, then teamId", () => {
    const teamLowId = createTeam({
      id: "team_aaa",
      conferenceId: "conf_east",
      divisionId: "div_east_a",
    });
    const teamHighId = createTeam({
      id: "team_zzz",
      conferenceId: "conf_east",
      divisionId: "div_east_a",
    });
    const opponent = createTeam({
      id: "team_opp",
      conferenceId: "conf_west",
      divisionId: "div_west_a",
    });

    // Both 1-0 with same differential → teamId ascending puts aaa first
    const tieBreakGames = [
      finalGame({
        id: "g1",
        homeTeamId: "team_aaa",
        awayTeamId: "team_opp",
        home: 100,
        away: 90,
        date: "2026-10-01",
      }),
      finalGame({
        id: "g2",
        homeTeamId: "team_zzz",
        awayTeamId: "team_opp",
        home: 100,
        away: 90,
        date: "2026-10-01",
      }),
    ];
    const tied = calculateStandings(
      [teamHighId, teamLowId, opponent],
      tieBreakGames,
    );
    expect(tied[0]!.teamId).toBe("team_aaa");
    expect(tied[1]!.teamId).toBe("team_zzz");

    // Higher win % ranks first
    const pctGames = [
      finalGame({
        id: "w1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 90,
      }),
      finalGame({
        id: "w2",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 95,
      }),
      finalGame({
        id: "l1",
        homeTeamId: "team_east_b",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
      }),
    ];
    const byPct = calculateStandings([eastA, eastB, westA], pctGames);
    expect(byPct[0]!.teamId).toBe("team_east_a");
    expect(byPct[0]!.winPercentage).toBe(1);

    // Same win %, more wins ranks higher
    const moreWinsGames = [
      finalGame({
        id: "a1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 90,
        date: "2026-10-01",
      }),
      finalGame({
        id: "a2",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 95,
        date: "2026-10-02",
      }),
      finalGame({
        id: "b1",
        homeTeamId: "team_east_b",
        awayTeamId: "team_west_a",
        home: 110,
        away: 100,
        date: "2026-10-03",
      }),
    ];
    // east_a 2-0, east_b 1-0 — both 1.0 win%, east_a has more wins
    const byWins = calculateStandings([eastA, eastB, westA], moreWinsGames);
    expect(byWins[0]!.teamId).toBe("team_east_a");
    expect(byWins[0]!.wins).toBe(2);
    expect(byWins[1]!.teamId).toBe("team_east_b");

    // Same win% and wins: higher point differential ranks higher
    const diffGames = [
      finalGame({
        id: "d1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 120,
        away: 100,
      }),
      finalGame({
        id: "d2",
        homeTeamId: "team_east_b",
        awayTeamId: "team_west_a",
        home: 101,
        away: 100,
      }),
    ];
    const byDiff = calculateStandings([eastA, eastB, westA], diffGames);
    expect(byDiff[0]!.teamId).toBe("team_east_a");
    expect(byDiff[0]!.pointDifferential).toBe(20);
  });

  it("keeps wins + losses equal to counted non-tied final games", () => {
    const games = [
      finalGame({
        id: "g1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 90,
      }),
      finalGame({
        id: "tie",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 100,
      }),
      scheduledGame({
        id: "sched",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
      }),
      finalGame({
        id: "g2",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 90,
        away: 100,
        date: "2026-10-02",
      }),
    ];
    const standings = calculateStandings([eastA, westA], games);
    for (const row of standings) {
      expect(row.wins + row.losses).toBe(2);
    }
  });

  it("is deterministic for the same inputs", () => {
    const games = [
      finalGame({
        id: "g1",
        homeTeamId: "team_east_a",
        awayTeamId: "team_west_a",
        home: 100,
        away: 90,
      }),
    ];
    const orderIds: GameId[] = [asGameId("g1")];
    const first = calculateStandings([westA, eastA], games, {
      seasonId: SEASON_A,
      gameOrderIds: orderIds,
    });
    const second = calculateStandings([westA, eastA], games, {
      seasonId: SEASON_A,
      gameOrderIds: orderIds,
    });
    expect(first).toEqual(second);
  });
});

import { describe, expect, it } from "vitest";
import {
  createGame,
  type Game,
  type GamePlayerStats,
} from "@/domain/entities/game";
import { aggregateTeamStats } from "@/domain/entities/game-result";
import { PLAY_CODE, type PlayByPlayLog } from "@/domain/entities/play-by-play";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type PlayerId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  buildLiveBoxScore,
  buildShotSummary,
  canWatchGame,
  formatGameClock,
  periodLabel,
  toWatchGameView,
} from "@/state/watch-game-selectors";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

const HOME_ID = asTeamId("team_home");
const AWAY_ID = asTeamId("team_away");
const GAME_ID = "game_watch_hand";

type Kind =
  | "two_made"
  | "two_missed"
  | "three_made"
  | "three_missed"
  | "ft_made"
  | "ft_missed"
  | "oreb"
  | "dreb"
  | "tov"
  | "shooting_foul"
  | "personal_foul"
  | "offensive_foul"
  | "sub";

const CODES: Record<Kind, number> = {
  two_made: PLAY_CODE.twoMade,
  two_missed: PLAY_CODE.twoMissed,
  three_made: PLAY_CODE.threeMade,
  three_missed: PLAY_CODE.threeMissed,
  ft_made: PLAY_CODE.freeThrowMade,
  ft_missed: PLAY_CODE.freeThrowMissed,
  oreb: PLAY_CODE.offensiveRebound,
  dreb: PLAY_CODE.defensiveRebound,
  tov: PLAY_CODE.turnover,
  shooting_foul: PLAY_CODE.shootingFoul,
  personal_foul: PLAY_CODE.personalFoul,
  offensive_foul: PLAY_CODE.offensiveFoul,
  sub: PLAY_CODE.substitution,
};

/** [period, clock, poss, kind, player, player2?]; ids are h1..h6 / a1..a6. */
type Row = [number, number, number, Kind, string, string?];

const ROSTER = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
];

function pid(key: string): PlayerId {
  return asPlayerId(`player_${key}`);
}

function buildLog(rows: Row[]): PlayByPlayLog {
  const players = ROSTER.map(pid);
  const idx = (key: string) => ROSTER.indexOf(key);
  return {
    v: 1,
    players,
    period: rows.map((r) => r[0]),
    clock: rows.map((r) => r[1]),
    poss: rows.map((r) => r[2]),
    code: rows.map((r) => CODES[r[3]]),
    side: rows.map((r) => (r[4].startsWith("h") ? 0 : 1)),
    player: rows.map((r) => idx(r[4])),
    player2: rows.map((r) => (r[5] ? idx(r[5]) : -1)),
  };
}

function statsRow(key: string): GamePlayerStats {
  const home = key.startsWith("h");
  return {
    playerId: pid(key),
    teamId: home ? HOME_ID : AWAY_ID,
    firstName: home ? "Home" : "Away",
    lastName: `P${key.slice(1)}`,
    minutes: 20,
    points: 0,
    rebounds: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    touches: 0,
    started: key.slice(1) <= "5",
  };
}

function snapshot(teamId: typeof HOME_ID, abbreviation: string) {
  return {
    teamId,
    city: abbreviation,
    name: `${abbreviation}s`,
    abbreviation,
    branding: {
      primaryColor: "#0B1F3A",
      secondaryColor: "#C4CED4",
      accentColor: "#F5B800",
      logoId: "shield",
    },
  } as Game["homeTeamSnapshot"];
}

/** Hand-built final game + log in an otherwise empty state. */
function handState(rows: Row[], overrides: Partial<Game> = {}): GameState {
  const base = createTestGameState({ saveId: "watch_hand" });
  const log = buildLog(rows);
  const score = { home: 0, away: 0 };
  const periods = [0, 1, 2, 3].map(() => ({ home: 0, away: 0 }));
  rows.forEach((row, i) => {
    const pts =
      row[3] === "two_made"
        ? 2
        : row[3] === "three_made"
          ? 3
          : row[3] === "ft_made"
            ? 1
            : 0;
    const key = log.side[i] === 0 ? "home" : "away";
    score[key] += pts;
    const p = periods[Math.min(row[0], 4) - 1]!;
    p[key] += pts;
  });
  const game = createGame({
    id: asGameId(GAME_ID),
    seasonId: base.competition.season.id,
    date: "2026-11-01",
    homeTeamId: HOME_ID,
    awayTeamId: AWAY_ID,
    competitionType: "regular_season",
    status: "final",
    score,
    periodScores: periods,
    events: [],
    playerStats: ROSTER.map(statsRow),
    homeTeamSnapshot: snapshot(HOME_ID, "HOM"),
    awayTeamSnapshot: snapshot(AWAY_ID, "AWY"),
    ...overrides,
  });
  return {
    ...base,
    competition: {
      ...base.competition,
      games: { [game.id]: game },
      playByPlay: { [game.id]: log },
    },
  };
}

function handView(rows: Row[]) {
  const view = toWatchGameView(handState(rows), GAME_ID);
  expect(view).not.toBeNull();
  return view!;
}

describe("formatGameClock / periodLabel", () => {
  it("formats clocks as m:ss", () => {
    expect(formatGameClock(720)).toBe("12:00");
    expect(formatGameClock(7)).toBe("0:07");
    expect(formatGameClock(0)).toBe("0:00");
    expect(formatGameClock(702)).toBe("11:42");
  });

  it("labels regulation and overtime periods", () => {
    expect([1, 2, 3, 4].map(periodLabel)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(periodLabel(5)).toBe("OT");
    expect(periodLabel(6)).toBe("2OT");
    expect(periodLabel(7)).toBe("3OT");
  });
});

describe("canWatchGame (hand fixtures)", () => {
  const rows: Row[] = [[1, 720, 1, "two_made", "h1"]];

  it("is true for a final current-season game with a log", () => {
    expect(canWatchGame(handState(rows), GAME_ID)).toBe(true);
  });

  it("is false without a log", () => {
    const state = handState(rows);
    state.competition.playByPlay = {};
    expect(canWatchGame(state, GAME_ID)).toBe(false);
    expect(toWatchGameView(state, GAME_ID)).toBeNull();
  });

  it("is false when the game is not final", () => {
    const state = handState(rows, { status: "scheduled" });
    expect(canWatchGame(state, GAME_ID)).toBe(false);
    expect(toWatchGameView(state, GAME_ID)).toBeNull();
  });

  it("is false for another season", () => {
    const state = handState(rows, { seasonId: asSeasonId("season_old") });
    expect(canWatchGame(state, GAME_ID)).toBe(false);
  });

  it("is false for an unknown game", () => {
    expect(canWatchGame(handState(rows), "game_missing")).toBe(false);
  });
});

describe("toWatchGameView text templates", () => {
  const rows: Row[] = [
    [1, 720, 1, "two_made", "h1", "h2"],
    [1, 700, 2, "three_made", "h3"],
    [1, 680, 3, "three_made", "h1", "h2"],
    [1, 660, 4, "two_missed", "a1", "h1"],
    [1, 640, 5, "three_missed", "h1"],
    [1, 620, 6, "two_missed", "a2"],
    [1, 600, 7, "three_missed", "a2", "h3"],
    [1, 580, 8, "ft_made", "h1"],
    [1, 580, 8, "ft_missed", "a1"],
    [1, 560, 9, "oreb", "h2"],
    [1, 560, 9, "dreb", "a2"],
    [1, 540, 10, "tov", "h1", "a1"],
    [1, 520, 11, "tov", "a3"],
    [1, 500, 12, "shooting_foul", "h1", "a1"],
    [1, 480, 13, "personal_foul", "a2", "h1"],
    [1, 460, 14, "offensive_foul", "a2", "h1"],
    [1, 440, 14, "sub", "h1", "h6"],
  ];

  it("renders deterministic broadcast text for every kind", () => {
    expect(handView(rows).plays.map((p) => p.text)).toEqual([
      "H. P1 makes 2-pt shot (H. P2 assists)",
      "H. P3 makes 3-pt shot",
      "H. P1 makes 3-pt shot (H. P2 assists)",
      "A. P1 misses 2-pt shot (blocked by H. P1)",
      "H. P1 misses 3-pt shot",
      "A. P2 misses 2-pt shot",
      "A. P2 misses 3-pt shot (blocked by H. P3)",
      "H. P1 makes free throw",
      "A. P1 misses free throw",
      "H. P2 offensive rebound",
      "A. P2 defensive rebound",
      "H. P1 turnover (A. P1 steals)",
      "A. P3 turnover",
      "Shooting foul on H. P1 (A. P1 fouled)",
      "Personal foul on A. P2",
      "Offensive foul on A. P2",
      "H. P6 checks in for H. P1",
    ]);
  });

  it("decodes kind, labels, side and players", () => {
    const view = handView(rows);
    const first = view.plays[0]!;
    expect(first).toMatchObject({
      index: 0,
      kind: "two_made",
      side: 0,
      period: 1,
      periodLabel: "Q1",
      clock: 720,
      clockLabel: "12:00",
      poss: 1,
      playerId: pid("h1"),
      player2Id: pid("h2"),
      points: 2,
    });
    expect(view.plays[12]!.player2Id).toBeNull();
    expect(view.plays[16]!.kind).toBe("substitution");
    expect(view.home.abbreviation).toBe("HOM");
    expect(view.away.abbreviation).toBe("AWY");
    expect(view.players[0]!.fullName).toBe("Home P1");
    expect(view.players[0]!.shortName).toBe("H. P1");
    expect(view.players.map((p) => p.side)).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1,
    ]);
    expect(view.players.filter((p) => p.started)).toHaveLength(10);
  });

  it("tracks the running score after each play", () => {
    const plays = handView(rows).plays;
    expect(plays.slice(0, 3).map((p) => [p.homeScore, p.awayScore])).toEqual([
      [2, 0],
      [5, 0],
      [8, 0],
    ]);
    expect(plays[3]).toMatchObject({ homeScore: 8, awayScore: 0 });
    expect(plays[7]).toMatchObject({ homeScore: 9, awayScore: 0 });
    expect(plays[16]).toMatchObject({ homeScore: 9, awayScore: 0 });
  });

  it("falls back to world players, then the id, when stats lack names", () => {
    const state = handState(rows);
    const game = state.competition.games[GAME_ID]!;
    game.playerStats[0] = {
      ...game.playerStats[0]!,
      firstName: null,
      lastName: null,
    };
    const view = toWatchGameView(state, GAME_ID)!;
    expect(view.players[0]!.shortName).toBe("player_h1");
    expect(view.plays[0]!.text).toBe(
      "player_h1 makes 2-pt shot (H. P2 assists)",
    );
  });

  it("appends the fouls-out suffix on the sixth foul only", () => {
    const foulRows: Row[] = [1, 2, 3, 4, 5, 6].map((n): Row => [
      n <= 4 ? 1 : 2,
      600 - n,
      n,
      n === 6 ? "offensive_foul" : n === 2 ? "shooting_foul" : "personal_foul",
      "h1",
      "a1",
    ]);
    const texts = handView(foulRows).plays.map((p) => p.text);
    expect(texts[4]).toBe("Personal foul on H. P1");
    expect(texts[5]).toBe("Offensive foul on H. P1 — fouls out");
  });
});

describe("highlights", () => {
  it("detects ties and lead changes, including through a tie", () => {
    const view = handView([
      [1, 700, 1, "two_made", "h1"], // 2-0, first lead: no lead_change
      [1, 680, 2, "two_made", "a1"], // 2-2 tie
      [1, 660, 3, "two_made", "a2"], // 2-4 lead change to away (through tie)
      [1, 640, 4, "three_made", "h1"], // 5-4 lead change to home
      [1, 620, 5, "two_made", "h2"], // 7-4 no change
    ]);
    expect(view.plays.map((p) => p.highlights)).toEqual([
      [],
      ["tie"],
      ["lead_change"],
      ["lead_change"],
      [],
    ]);
  });

  it("does not flag a tie at 0-0 and ignores non-scoring plays", () => {
    const view = handView([
      [1, 700, 1, "two_missed", "h1"],
      [1, 690, 1, "dreb", "a1"],
    ]);
    expect(view.plays.every((p) => p.highlights.length === 0)).toBe(true);
  });

  it("flags a run once, when it reaches 8", () => {
    const view = handView([
      [1, 700, 1, "two_made", "h1"],
      [1, 690, 2, "three_made", "h2"],
      [1, 680, 3, "three_made", "h3"], // 8-0: run
      [1, 670, 4, "two_made", "h1"], // 10-0: already flagged
      [1, 660, 5, "two_made", "a1"],
    ]);
    expect(view.plays.map((p) => p.highlights.includes("run"))).toEqual([
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it("flags clutch only in the last five minutes of Q4/OT within five points", () => {
    const view = handView([
      [3, 100, 1, "two_made", "h1"], // Q3: never clutch
      [4, 301, 2, "two_made", "h1"], // clock above 300
      [4, 300, 3, "two_made", "a1"], // clutch (margin 4)
      [4, 200, 4, "three_made", "h1"], // margin 2: clutch
      [4, 100, 5, "three_made", "h2"], // margin 5: clutch
      [4, 90, 6, "three_made", "h3"], // margin 8: not clutch
    ]);
    expect(view.plays.map((p) => p.highlights.includes("clutch"))).toEqual([
      false,
      false,
      true,
      true,
      true,
      false,
    ]);
  });

  it("flags fouling out on the sixth foul", () => {
    const rows: Row[] = [1, 2, 3, 4, 5, 6, 7].map((n): Row => [
      1,
      600 - n,
      n,
      "personal_foul",
      "a2",
      "h1",
    ]);
    const view = handView(rows);
    expect(view.plays.map((p) => p.highlights.includes("foul_out"))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it("flags and-ones only for a made shot followed by a shooting foul on the shooter", () => {
    const view = handView([
      [1, 700, 1, "three_made", "a1"],
      [1, 700, 1, "shooting_foul", "h2", "a1"], // and-one
      [1, 700, 1, "ft_made", "a1"],
      [1, 680, 2, "two_made", "a2"],
      [1, 680, 2, "shooting_foul", "h2", "a3"], // different shooter
      [1, 660, 3, "two_missed", "a1"],
      [1, 660, 3, "shooting_foul", "h2", "a1"], // missed shot: not an and-one
      [1, 640, 4, "two_made", "a1"],
      [1, 640, 5, "shooting_foul", "h2", "a1"], // different possession
    ]);
    expect(view.plays.map((p) => p.highlights.includes("and_one"))).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("keyMoments", () => {
  it("emits a run once with its full size and end score", () => {
    const view = handView([
      [1, 700, 1, "two_made", "h1"],
      [1, 690, 2, "three_made", "h2"],
      [1, 680, 3, "three_made", "h3"],
      [1, 670, 4, "two_made", "h1"],
      [1, 660, 5, "two_made", "a1"], // run ends at 10-0
      [1, 650, 6, "two_made", "a2"],
    ]);
    const runs = view.keyMoments.filter((m) => m.kind === "run");
    expect(runs).toEqual([
      {
        kind: "run",
        playIndex: 2,
        periodLabel: "Q1",
        clockLabel: "11:20",
        side: 0,
        title: "10-0 run",
        detail: "HOM run; score 10-0",
      },
    ]);
  });

  it("closes a run that lasts to the end of the game with the final score", () => {
    const view = handView([
      [1, 700, 1, "two_made", "a1"],
      [1, 690, 2, "three_made", "a2"],
      [1, 680, 3, "three_made", "a3"],
    ]);
    expect(view.keyMoments).toEqual([
      expect.objectContaining({
        kind: "run",
        side: 1,
        title: "8-0 run",
        detail: "AWY run; score 0-8",
      }),
    ]);
  });

  it("separates go-ahead from tying clutch plays and lists Q4 lead changes and ties", () => {
    const view = handView([
      [4, 400, 1, "two_made", "h1"], // 2-0, not clutch
      [4, 250, 2, "two_made", "a1"], // 2-2 tie, tying 2
      [4, 240, 3, "ft_made", "a1"], // 2-3 lead change, go-ahead free throw
      [4, 230, 4, "three_made", "h2"], // 5-3 lead change, go-ahead 3
      [4, 220, 5, "two_made", "a2"], // 5-5 tie, tying 2
      [4, 210, 6, "three_made", "h3"], // 8-5 go-ahead 3 (was tied before)
    ]);
    expect(view.keyMoments.map((m) => m.title)).toEqual([
      "Tied up",
      "Tying 2",
      "Lead change",
      "Go-ahead free throw",
      "Lead change",
      "Go-ahead 3",
      "Tied up",
      "Tying 2",
      "Go-ahead 3",
    ]);
    const leadChange = view.keyMoments[2]!;
    expect(leadChange).toMatchObject({
      kind: "lead_change",
      playIndex: 2,
      side: 1,
      periodLabel: "Q4",
      clockLabel: "4:00",
      detail: "AWY leads 2-3",
    });
    expect(view.keyMoments[0]).toMatchObject({
      kind: "tie",
      detail: "Tied 2-2",
    });
    expect(view.keyMoments[3]!.detail).toBe("A. P1 makes free throw");
  });

  it("omits lead changes and ties before the fourth quarter", () => {
    const view = handView([
      [2, 400, 1, "two_made", "h1"],
      [2, 390, 2, "two_made", "a1"],
      [2, 380, 3, "two_made", "a1"],
    ]);
    expect(view.keyMoments).toEqual([]);
  });

  it("reports fouling out and appends injuries last", () => {
    const rows: Row[] = [1, 2, 3, 4, 5, 6].map((n): Row => [
      2,
      600 - n,
      n,
      "personal_foul",
      "h1",
      "a1",
    ]);
    rows.push([3, 100, 7, "two_made", "h1"]);
    const state = handState(rows);
    state.world.players[pid("a1")] = {
      activeInjuries: [
        {
          injuryId: "inj_1",
          type: "ankle sprain",
          severity: "moderate",
          injuredOn: "2026-11-01",
          exposureSource: "game_acute",
        },
        {
          injuryId: "inj_old",
          type: "knee strain",
          severity: "minor",
          injuredOn: "2026-10-01",
          exposureSource: "game_acute",
        },
        {
          injuryId: "inj_practice",
          type: "wrist sprain",
          severity: "minor",
          injuredOn: "2026-11-01",
          exposureSource: "practice",
        },
      ],
      injuryHistory: [
        {
          injuryId: "inj_1",
          type: "ankle sprain",
          severity: "moderate",
          injuredOn: "2026-11-01",
          exposureSource: "game_acute",
        },
        {
          injuryId: "inj_2",
          type: "back spasm",
          severity: "minor",
          injuredOn: "2026-11-01",
          exposureSource: "game_overuse",
        },
      ],
    } as never;

    const view = toWatchGameView(state, GAME_ID)!;
    expect(view.injuries.map((i) => i.description)).toEqual([
      "Ankle sprain (moderate)",
      "Back spasm (minor)",
    ]);
    expect(view.injuries[0]).toMatchObject({
      playerId: pid("a1"),
      side: 1,
      shortName: "A. P1",
    });
    const kinds = view.keyMoments.map((m) => m.kind);
    expect(kinds).toEqual(["foul_out", "injury", "injury"]);
    expect(view.keyMoments[0]).toMatchObject({
      title: "H. P1 fouls out",
      detail: "Q2 9:54",
      playIndex: 5,
    });
    expect(view.keyMoments[1]).toMatchObject({
      playIndex: null,
      periodLabel: null,
      clockLabel: null,
      side: 1,
      title: "A. P1 injured",
      detail: "Ankle sprain (moderate)",
    });
  });
});

describe("buildLiveBoxScore (hand fixtures)", () => {
  const rows: Row[] = [
    [1, 720, 1, "two_made", "h1", "h2"],
    [1, 700, 2, "three_made", "h3"],
    [1, 680, 3, "three_made", "h1", "h2"],
    [1, 660, 4, "two_missed", "a1", "h1"],
    [1, 640, 5, "tov", "h1", "a1"],
    [1, 620, 6, "dreb", "a2"],
    [1, 600, 7, "ft_made", "a1"],
    [1, 600, 7, "ft_missed", "a1"],
    [1, 500, 8, "sub", "h1", "h6"],
    [1, 500, 8, "oreb", "h2"],
  ];

  it("starts at tip-off with zeros and the starters on court", () => {
    const view = handView(rows);
    const box = buildLiveBoxScore(view, 0);
    expect(box).toMatchObject({
      revealed: 0,
      homeScore: 0,
      awayScore: 0,
      periodLabel: "Q1",
      clockLabel: "12:00",
      isFinal: false,
    });
    expect(box.home.rows).toHaveLength(6);
    expect(box.home.rows.map((r) => r.onCourt)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(box.away.rows.filter((r) => r.onCourt)).toHaveLength(5);
    for (const row of [...box.home.rows, ...box.away.rows]) {
      expect(row.points + row.fga + row.fta + row.rebounds + row.fouls).toBe(0);
    }
    expect(box.home.periodFouls).toBe(0);
    expect(box.home.totals.points).toBe(0);
  });

  it("reveals a partial game", () => {
    const view = handView(rows);
    const box = buildLiveBoxScore(view, 5);
    expect(box).toMatchObject({
      revealed: 5,
      homeScore: 8,
      awayScore: 0,
      periodLabel: "Q1",
      clockLabel: "10:40",
      isFinal: false,
    });
    const h1 = box.home.rows.find((r) => r.playerId === pid("h1"))!;
    expect(h1).toMatchObject({
      points: 5,
      fgm: 2,
      fga: 2,
      threePm: 1,
      threePa: 1,
      turnovers: 1,
      shortName: "H. P1",
    });
    expect(box.home.rows.find((r) => r.playerId === pid("h2"))!.assists).toBe(
      2,
    );
    const a1 = box.away.rows.find((r) => r.playerId === pid("a1"))!;
    expect(a1).toMatchObject({ fga: 1, fgm: 0, steals: 1 });
    expect(box.home.totals).toMatchObject({
      points: 8,
      assists: 2,
      turnovers: 1,
      fga: 3,
    });
    expect(box.away.totals.fga).toBe(1);
  });

  it("credits blocks to the defender", () => {
    const box = buildLiveBoxScore(handView(rows), 4);
    expect(box.home.rows.find((r) => r.playerId === pid("h1"))!.blocks).toBe(1);
  });

  it("swaps the court on substitutions", () => {
    const view = handView(rows);
    const before = buildLiveBoxScore(view, 8);
    const after = buildLiveBoxScore(view, 9);
    const on = (box: typeof before, key: string) =>
      box.home.rows.find((r) => r.playerId === pid(key))!.onCourt;
    expect(on(before, "h1")).toBe(true);
    expect(on(before, "h6")).toBe(false);
    expect(on(after, "h1")).toBe(false);
    expect(on(after, "h6")).toBe(true);
    expect(after.home.rows.filter((r) => r.onCourt)).toHaveLength(5);
  });

  it("finishes with Final / 0:00 and clamps the reveal count", () => {
    const view = handView(rows);
    const final = buildLiveBoxScore(view, 999);
    expect(final).toMatchObject({
      revealed: rows.length,
      isFinal: true,
      periodLabel: "Final",
      clockLabel: "0:00",
      homeScore: 8,
      awayScore: 1,
    });
    expect(final.away.rows.find((r) => r.playerId === pid("a1"))).toMatchObject(
      {
        ftm: 1,
        fta: 2,
        points: 1,
      },
    );
    expect(buildLiveBoxScore(view, -3).revealed).toBe(0);
  });

  it("resets team period fouls each period and flags foul-outs", () => {
    const foulRows: Row[] = [
      [1, 600, 1, "personal_foul", "h1", "a1"],
      [1, 590, 2, "shooting_foul", "h2", "a1"],
      [1, 580, 3, "personal_foul", "a1", "h1"],
      [2, 600, 4, "personal_foul", "h1", "a1"],
      [2, 590, 5, "personal_foul", "h1", "a1"],
      [2, 580, 6, "personal_foul", "h1", "a1"],
      [2, 570, 7, "personal_foul", "h1", "a1"],
      [2, 560, 8, "personal_foul", "h1", "a1"],
    ];
    const view = handView(foulRows);
    const q1 = buildLiveBoxScore(view, 3);
    expect(q1.home.periodFouls).toBe(2);
    expect(q1.away.periodFouls).toBe(1);
    const q2 = buildLiveBoxScore(view, 4);
    expect(q2.home.periodFouls).toBe(1);
    expect(q2.away.periodFouls).toBe(0);
    const row = (n: number) =>
      buildLiveBoxScore(view, n).home.rows.find(
        (r) => r.playerId === pid("h1"),
      )!;
    expect(row(7)).toMatchObject({ fouls: 5, fouledOut: false });
    expect(row(8)).toMatchObject({ fouls: 6, fouledOut: true });
  });
});

describe("buildShotSummary (hand fixtures)", () => {
  const rows: Row[] = [
    [1, 720, 1, "two_made", "h1", "h2"],
    [1, 700, 2, "three_made", "h3"],
    [2, 680, 3, "three_made", "h1", "h2"],
    [2, 660, 4, "two_missed", "a1", "h1"],
    [2, 640, 5, "three_missed", "h1"],
    [3, 620, 6, "ft_made", "h1"],
    [3, 600, 7, "ft_missed", "a1"],
    [3, 580, 8, "oreb", "h2"],
  ];

  it("totals the whole game by default", () => {
    const summary = buildShotSummary(handView(rows));
    expect(summary.home.total).toEqual({
      points: 9,
      fgm: 3,
      fga: 4,
      twoPm: 1,
      twoPa: 1,
      threePm: 2,
      threePa: 3,
      ftm: 1,
      fta: 1,
      assistedFgm: 2,
    });
    expect(summary.away.total).toMatchObject({
      points: 0,
      fga: 1,
      twoPa: 1,
      fta: 1,
      ftm: 0,
    });
    expect(summary.home.byPeriod).toHaveLength(4);
    expect(summary.home.byPeriod.map((l) => l.points)).toEqual([5, 3, 1, 0]);
    expect(summary.players.map((p) => [p.playerId, p.line.points])).toEqual([
      [pid("h1"), 6],
      [pid("h3"), 3],
      [pid("a1"), 0],
    ]);
    expect(summary.players[2]!.side).toBe(1);
  });

  it("honors a partial reveal", () => {
    const view = handView(rows);
    const summary = buildShotSummary(view, 2);
    expect(summary.home.total).toMatchObject({
      points: 5,
      fga: 2,
      assistedFgm: 1,
    });
    expect(summary.away.total.fga).toBe(0);
    expect(buildShotSummary(view, 0).players).toEqual([]);
    expect(view.shotSummary).toEqual(buildShotSummary(view));
  });
});

describe("recorded real game invariants", () => {
  const REAL_ID = "game_watch_real";

  function recordedState(): GameState {
    let state = createTestGameState({ saveId: "watch_real" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams).map((id) => asTeamId(id));
    const today = state.world.calendar.currentDate;
    const game = createGame({
      id: asGameId(REAL_ID),
      seasonId: state.competition.season.id,
      date: today,
      homeTeamId: teamIds[0]!,
      awayTeamId: teamIds[1]!,
      competitionType: "regular_season",
      status: "scheduled",
      score: { home: 0, away: 0 },
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { [game.id]: game },
        schedule: {
          ...state.competition.schedule,
          gameIds: [game.id],
          gameIdsByDate: { [today]: [game.id] },
        },
      },
    };
    return simulateGamesForDate(state, createTestRng(41), today, undefined, {
      ownerTeamId: teamIds[0]!,
    }).state;
  }

  const state = recordedState();
  const game = state.competition.games[REAL_ID]!;
  const view = toWatchGameView(state, REAL_ID)!;

  it("is watchable and ends on the final score", () => {
    expect(canWatchGame(state, REAL_ID)).toBe(true);
    expect(view.plays.length).toBeGreaterThan(100);
    const last = view.plays[view.plays.length - 1]!;
    expect({ home: last.homeScore, away: last.awayScore }).toEqual(game.score);
    expect(view.finalScore).toEqual(game.score);
    expect(view.players).toHaveLength(game.playerStats.length);
  });

  it("matches every player's box-score row at full reveal", () => {
    const box = buildLiveBoxScore(view, view.plays.length);
    expect(box.isFinal).toBe(true);
    const rows = [...box.home.rows, ...box.away.rows];
    expect(rows).toHaveLength(game.playerStats.length);
    for (const row of rows) {
      const stats = game.playerStats.find((s) => s.playerId === row.playerId)!;
      expect({
        points: row.points,
        fgm: row.fgm,
        fga: row.fga,
        threePm: row.threePm,
        threePa: row.threePa,
        ftm: row.ftm,
        fta: row.fta,
        oreb: row.offensiveRebounds,
        dreb: row.defensiveRebounds,
        ast: row.assists,
        stl: row.steals,
        blk: row.blocks,
        tov: row.turnovers,
        pf: row.fouls,
      }).toEqual({
        points: stats.points,
        fgm: stats.fieldGoalsMade,
        fga: stats.fieldGoalsAttempted,
        threePm: stats.threePointersMade,
        threePa: stats.threePointersAttempted,
        ftm: stats.freeThrowsMade,
        fta: stats.freeThrowsAttempted,
        oreb: stats.offensiveRebounds,
        dreb: stats.defensiveRebounds,
        ast: stats.assists,
        stl: stats.steals,
        blk: stats.blocks,
        tov: stats.turnovers,
        pf: stats.fouls,
      });
    }
    expect(box.home.totals.points).toBe(game.score.home);
    expect(box.away.totals.points).toBe(game.score.away);
  });

  it("starts with the recorded starters on court", () => {
    const box = buildLiveBoxScore(view, 0);
    for (const row of [...box.home.rows, ...box.away.rows]) {
      expect(row.onCourt).toBe(row.started);
    }
    expect(box.home.rows.filter((r) => r.onCourt)).toHaveLength(5);
    expect(box.away.rows.filter((r) => r.onCourt)).toHaveLength(5);
  });

  it("keeps five players on court per team at every step", () => {
    for (let n = 0; n <= view.plays.length; n += 25) {
      const box = buildLiveBoxScore(view, n);
      expect(box.home.rows.filter((r) => r.onCourt)).toHaveLength(5);
      expect(box.away.rows.filter((r) => r.onCourt)).toHaveLength(5);
    }
  });

  it("matches box-score team totals in the shot summary", () => {
    const summary = buildShotSummary(view);
    const homeStats = aggregateTeamStats(
      game.homeTeamId,
      game.playerStats.filter((s) => s.teamId === game.homeTeamId),
    );
    const awayStats = aggregateTeamStats(
      game.awayTeamId,
      game.playerStats.filter((s) => s.teamId === game.awayTeamId),
    );
    for (const [team, stats] of [
      [summary.home, homeStats],
      [summary.away, awayStats],
    ] as const) {
      expect(team.total.points).toBe(stats.points);
      expect(team.total.fgm).toBe(stats.fieldGoalsMade);
      expect(team.total.fga).toBe(stats.fieldGoalsAttempted);
      expect(team.total.threePm).toBe(stats.threePointersMade);
      expect(team.total.threePa).toBe(stats.threePointersAttempted);
      expect(team.total.ftm).toBe(stats.freeThrowsMade);
      expect(team.total.fta).toBe(stats.freeThrowsAttempted);
      expect(team.total.assistedFgm).toBe(stats.assists);
      expect(team.byPeriod).toHaveLength(game.periodScores.length);
      for (const key of ["points", "fgm", "fga", "ftm", "fta"] as const) {
        expect(team.byPeriod.reduce((sum, line) => sum + line[key], 0)).toBe(
          team.total[key],
        );
      }
    }
    summary.home.byPeriod.forEach((line, i) => {
      expect(line.points).toBe(game.periodScores[i]!.home);
    });
  });

  it("produces ordered key moments", () => {
    const anchored = view.keyMoments.filter((m) => m.playIndex !== null);
    const indexes = anchored.map((m) => m.playIndex!);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    const firstInjury = view.keyMoments.findIndex((m) => m.kind === "injury");
    if (firstInjury >= 0) {
      expect(
        view.keyMoments.slice(firstInjury).every((m) => m.kind === "injury"),
      ).toBe(true);
    }
  });
});

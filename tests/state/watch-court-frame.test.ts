import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asTeamId, type PlayerId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  COURT_FEET,
  type CourtFrame,
  type CourtPoint,
  buildCourtFrame,
  courtLabels,
  courtSeed,
  courtSpot,
  formationSpots,
  possessionGroups,
  stepPossession,
} from "@/state/watch-court-frame";
import {
  buildLiveBoxScore,
  buildShotSummary,
  lineupAt,
  toWatchGameView,
} from "@/state/watch-game-selectors";
import type {
  WatchGameView,
  WatchPlay,
  WatchPlayKind,
  WatchPlayer,
  WatchSide,
} from "@/state/watch-game-view";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

const pid = (id: string) => id as PlayerId;

function feet(point: CourtPoint): { x: number; y: number } {
  return { x: point.x * COURT_FEET.width, y: point.y * COURT_FEET.length };
}

function hoopDistance(point: CourtPoint): number {
  const p = feet(point);
  return Math.hypot(p.x - COURT_FEET.hoopX, p.y - COURT_FEET.hoopY);
}

function inBounds(point: CourtPoint): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function watchPlayer(
  id: string,
  side: WatchSide,
  last: string,
  started: boolean,
  first = "Pat",
): WatchPlayer {
  return {
    playerId: pid(id),
    side,
    fullName: `${first} ${last}`,
    shortName: `${first.charAt(0)}. ${last}`,
    lastName: last,
    position: null,
    jerseyNumber: null,
    started,
    finalMinutes: 0,
  };
}

let scoreHome = 0;
let scoreAway = 0;
function play(
  index: number,
  poss: number,
  kind: WatchPlayKind,
  side: WatchSide,
  playerId: string,
  player2Id: string | null = null,
): WatchPlay {
  const points =
    kind === "three_made"
      ? 3
      : kind === "two_made"
        ? 2
        : kind === "ft_made"
          ? 1
          : 0;
  if (side === 0) {
    scoreHome += points;
  } else {
    scoreAway += points;
  }
  return {
    index,
    period: 1,
    periodLabel: "Q1",
    clock: 700 - poss * 10,
    clockLabel: "",
    poss,
    kind,
    side,
    playerId: pid(playerId),
    player2Id: player2Id === null ? null : pid(player2Id),
    text: kind,
    points,
    homeScore: scoreHome,
    awayScore: scoreAway,
    highlights: [],
  };
}

const HOME = ["h1", "h2", "h3", "h4", "h5"];
const AWAY = ["a1", "a2", "a3", "a4", "a5"];

/** Every play kind at least once (home = side 0 attacks first). */
const KIND_PLAYS: WatchPlay[] = [
  play(0, 1, "three_made", 0, "h1", "h2"),
  play(1, 2, "two_missed", 1, "a1", "h3"),
  play(2, 2, "defensive_rebound", 0, "h4"),
  play(3, 3, "turnover", 0, "h1", "a2"),
  play(4, 4, "turnover", 1, "a2"),
  play(5, 5, "personal_foul", 1, "a3", "h2"),
  play(6, 6, "shooting_foul", 1, "a4", "h5"),
  play(7, 6, "ft_made", 0, "h5"),
  play(8, 6, "ft_missed", 0, "h5"),
  play(9, 6, "offensive_rebound", 0, "h3"),
  play(10, 8, "two_made", 0, "h3"),
  play(11, 8, "substitution", 0, "h3", "h6"),
  play(12, 9, "three_missed", 1, "a5"),
  play(13, 9, "defensive_rebound", 0, "h6"),
  play(14, 10, "offensive_foul", 0, "h6", "a1"),
];

const KIND_VIEW: WatchGameView = {
  gameId: asGameId("game_court_kinds"),
  date: "2026-10-17",
  competitionType: "regular_season",
  home: {} as never,
  away: {} as never,
  finalScore: { home: scoreHome, away: scoreAway },
  periodScores: [{ home: scoreHome, away: scoreAway }],
  players: [
    ...HOME.map((id, i) => watchPlayer(id, 0, `Home${i + 1}`, true)),
    watchPlayer("h6", 0, "Bench", false),
    ...AWAY.map((id, i) => watchPlayer(id, 1, `Away${i + 1}`, true)),
  ],
  plays: KIND_PLAYS,
  keyMoments: [],
  shotSummary: {} as never,
  injuries: [],
};

describe("buildCourtFrame (every play kind)", () => {
  const expected: Array<[WatchPlayKind, string, string]> = [
    ["three_made", "shot", "made"],
    ["two_missed", "shot", "blocked"],
    ["defensive_rebound", "rebound", "none"],
    ["turnover", "turnover", "stolen"],
    ["turnover", "turnover", "none"],
    ["personal_foul", "foul", "none"],
    ["shooting_foul", "foul", "none"],
    ["ft_made", "free_throw", "made"],
    ["ft_missed", "free_throw", "missed"],
    ["offensive_rebound", "rebound", "none"],
    ["two_made", "shot", "made"],
    ["substitution", "substitution", "none"],
    ["three_missed", "shot", "missed"],
    ["defensive_rebound", "rebound", "none"],
    ["offensive_foul", "foul", "none"],
  ];

  it("maps each revealed play to a motion and outcome", () => {
    expected.forEach(([kind, motion, outcome], index) => {
      const frame = buildCourtFrame(KIND_VIEW, index + 1);
      expect(frame.lastPlay).toMatchObject({ index, kind, motion, outcome });
      expect(frame.players).toHaveLength(10);
      expect(frame.lastPlay!.path.length).toBeGreaterThanOrEqual(1);
      expect(frame.lastPlay!.path.every(inBounds)).toBe(true);
    });
  });

  it("starts at tip-off with the opening handler holding the ball", () => {
    const frame = buildCourtFrame(KIND_VIEW, 0);
    expect(frame.lastPlay).toBeNull();
    expect(frame.possessionIndex).toBe(-1);
    expect(frame.offenseSide).toBe(0);
    // Assisted opening shot: the assister brings the ball up.
    expect(frame.ball.holderId).toBe(pid("h2"));
    expect(frame.players.find((p) => p.playerId === "h2")!.role).toBe(
      "handler",
    );
    expect(frame.period).toBe(1);
    expect(frame.clock).toBe(720);
  });

  it("routes an assisted make through the assister to the rim", () => {
    const frame = buildCourtFrame(KIND_VIEW, 1);
    const assister = frame.players.find((p) => p.playerId === "h2")!;
    const shooter = frame.players.find((p) => p.playerId === "h1")!;
    const path = frame.lastPlay!.path;
    expect(path[0]).toEqual(assister.spot);
    expect(path).toContainEqual(shooter.spot);
    expect(hoopDistance(path[path.length - 1]!)).toBeLessThan(0.01);
    expect(shooter.role).toBe("shooter");
    expect(hoopDistance(shooter.spot)).toBeGreaterThanOrEqual(
      COURT_FEET.threeRadius - 0.01,
    );
  });

  it("gives the rebounder and the stealer the ball", () => {
    expect(buildCourtFrame(KIND_VIEW, 3).ball.holderId).toBe(pid("h4"));
    expect(buildCourtFrame(KIND_VIEW, 4).ball.holderId).toBe(pid("a2"));
    expect(buildCourtFrame(KIND_VIEW, 5).ball.holderId).toBeNull();
    // Non-shooting foul: the fouled player keeps the ball.
    expect(buildCourtFrame(KIND_VIEW, 6).ball.holderId).toBe(pid("h2"));
  });

  it("flips the formation with possession", () => {
    const homeBall = buildCourtFrame(KIND_VIEW, 1);
    const awayBall = buildCourtFrame(KIND_VIEW, 2);
    expect(homeBall.offenseSide).toBe(0);
    expect(awayBall.offenseSide).toBe(1);
    expect(
      awayBall.players.filter((p) => p.onOffense).map((p) => p.side),
    ).toEqual([1, 1, 1, 1, 1]);
  });

  it("puts the free-throw shooter on the line", () => {
    const frame = buildCourtFrame(KIND_VIEW, 8);
    const shooter = frame.players.find((p) => p.playerId === "h5")!;
    expect(feet(shooter.spot).x).toBeCloseTo(COURT_FEET.hoopX, 1);
    expect(feet(shooter.spot).y).toBeCloseTo(COURT_FEET.freeThrowY, 1);
  });

  it("keeps the substitute in the outgoing player's slot", () => {
    const before = buildCourtFrame(KIND_VIEW, 11);
    const after = buildCourtFrame(KIND_VIEW, 12);
    const out = before.players.find((p) => p.playerId === "h3")!;
    const sub = after.players.find((p) => p.playerId === "h6")!;
    expect(sub.slot).toBe(out.slot);
    expect(sub.spot).toEqual(out.spot);
    expect(after.players.some((p) => p.playerId === "h3")).toBe(false);
    expect(after.lastPlay!.path).toEqual([before.ball.at]);
  });

  it("lists the substitutions ending at the latest play", () => {
    expect(buildCourtFrame(KIND_VIEW, 11).substitutions).toEqual([]);
    expect(buildCourtFrame(KIND_VIEW, 12).substitutions).toEqual([
      { index: 11, side: 0, outId: pid("h3"), inId: pid("h6") },
    ]);
    expect(buildCourtFrame(KIND_VIEW, 13).substitutions).toEqual([]);
  });

  it("reports the next possession's team and none at the final", () => {
    expect(buildCourtFrame(KIND_VIEW, 1).ballSide).toBe(1);
    expect(buildCourtFrame(KIND_VIEW, 9).ballSide).toBe(0);
    expect(buildCourtFrame(KIND_VIEW, KIND_PLAYS.length).ballSide).toBeNull();
    expect(buildCourtFrame(KIND_VIEW, KIND_PLAYS.length).isFinal).toBe(true);
  });

  it("groups possessions like the feed, skipping substitutions", () => {
    const groups = possessionGroups(KIND_VIEW);
    expect(groups.map((g) => [g.start, g.end, g.offenseSide])).toEqual([
      [0, 1, 0],
      [1, 3, 1],
      [3, 4, 0],
      [4, 5, 1],
      [5, 6, 0],
      [6, 10, 0],
      [10, 11, 0],
      [12, 14, 1],
      [14, 15, 0],
    ]);
    expect(buildCourtFrame(KIND_VIEW, 12).possessionIndex).toBe(6);
    expect(buildCourtFrame(KIND_VIEW, 13).possessionIndex).toBe(7);
  });
});

describe("stepPossession", () => {
  it("moves to the next and previous possession ends", () => {
    const forward: number[] = [];
    for (let n = 0; n < KIND_PLAYS.length;) {
      n = stepPossession(KIND_VIEW, n, 1);
      forward.push(n);
    }
    // The substitution (index 11) rides along with the next possession.
    expect(forward).toEqual([1, 3, 4, 5, 6, 10, 11, 14, 15]);
    expect(stepPossession(KIND_VIEW, 2, 1)).toBe(3);
    expect(stepPossession(KIND_VIEW, 12, -1)).toBe(11);
    expect(stepPossession(KIND_VIEW, 11, -1)).toBe(10);
    expect(stepPossession(KIND_VIEW, 1, -1)).toBe(0);
    expect(stepPossession(KIND_VIEW, 0, -1)).toBe(0);
    expect(stepPossession(KIND_VIEW, KIND_PLAYS.length, 1)).toBe(
      KIND_PLAYS.length,
    );
  });
});

describe("courtSpot / formationSpots / courtLabels", () => {
  it("places threes beyond the arc, twos inside it, free throws on the line", () => {
    for (let index = 0; index < 400; index += 1) {
      const seed = courtSeed("g", index);
      for (const kind of ["three_made", "three_missed"] as const) {
        const spot = courtSpot(kind, seed);
        const p = feet(spot);
        const corner = p.y < COURT_FEET.cornerThreeY;
        expect(inBounds(spot)).toBe(true);
        if (corner) {
          expect(Math.abs(p.x - COURT_FEET.hoopX)).toBeGreaterThan(
            COURT_FEET.cornerThreeX,
          );
        } else {
          expect(hoopDistance(spot)).toBeGreaterThan(COURT_FEET.threeRadius);
        }
      }
      for (const kind of ["two_made", "two_missed"] as const) {
        const spot = courtSpot(kind, seed);
        expect(inBounds(spot)).toBe(true);
        expect(hoopDistance(spot)).toBeLessThan(COURT_FEET.cornerThreeX);
      }
    }
    const line = feet(courtSpot("ft_made", 1));
    expect(line.x).toBeCloseTo(COURT_FEET.hoopX, 1);
    expect(line.y).toBeCloseTo(COURT_FEET.freeThrowY, 1);
  });

  it("is deterministic per seed and varies with the play index", () => {
    expect(courtSpot("two_made", 42)).toEqual(courtSpot("two_made", 42));
    expect(courtSeed("g", 1)).toBe(courtSeed("g", 1));
    expect(courtSeed("g", 1)).not.toBe(courtSeed("g", 2));
    expect(courtSeed("g", 1)).not.toBe(courtSeed("h", 1));
    expect(formationSpots("offense", 7)).toEqual(formationSpots("offense", 7));
    expect(formationSpots("offense", 7)).not.toEqual(
      formationSpots("offense", 8),
    );
  });

  it("shades defenders toward the basket", () => {
    const offense = formationSpots("offense", 3);
    const defense = formationSpots("defense", 3);
    expect(offense).toHaveLength(5);
    expect(defense).toHaveLength(5);
    defense.forEach((spot, slot) => {
      expect(hoopDistance(spot)).toBeLessThan(hoopDistance(offense[slot]!));
    });
  });

  it("uses last names and falls back to short names for shared ones", () => {
    const view: WatchGameView = {
      ...KIND_VIEW,
      players: [
        watchPlayer("x1", 0, "Smith", true, "Jalen"),
        watchPlayer("x2", 0, "Smith", true, "Kyle"),
        watchPlayer("x3", 0, "Lee", true),
        watchPlayer("y1", 1, "Lee", true),
      ],
    };
    const labels = courtLabels(view);
    expect(labels.get(pid("x1"))).toBe("J. Smith");
    expect(labels.get(pid("x2"))).toBe("K. Smith");
    expect(labels.get(pid("x3"))).toBe("Lee");
    expect(labels.get(pid("y1"))).toBe("Lee");
  });
});

describe("buildCourtFrame (recorded real game)", () => {
  const REAL_ID = "game_court_real";

  function recordedState(): GameState {
    let state = createTestGameState({ saveId: "court_real" });
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

  const view = toWatchGameView(recordedState(), REAL_ID)!;
  const total = view.plays.length;
  const frames: CourtFrame[] = [];
  for (let n = 0; n <= total; n += 1) {
    frames.push(buildCourtFrame(view, n));
  }

  it("is deterministic", () => {
    for (let n = 0; n <= total; n += 37) {
      expect(buildCourtFrame(view, n)).toEqual(frames[n]);
    }
  });

  it("has ten distinct on-court players at every index", () => {
    frames.forEach((frame, n) => {
      const ids = frame.players.map((p) => p.playerId);
      expect(new Set(ids).size).toBe(10);
      const lineups = lineupAt(view, n);
      expect(ids).toEqual([...lineups[0], ...lineups[1]]);
      const box = buildLiveBoxScore(view, n);
      const onCourt = [...box.home.rows, ...box.away.rows]
        .filter((row) => row.onCourt)
        .map((row) => row.playerId);
      expect([...ids].sort()).toEqual([...onCourt].sort());
      expect(frame.players.every((p) => inBounds(p.spot))).toBe(true);
      expect(inBounds(frame.ball.at)).toBe(true);
    });
  });

  it("reaches the same final frame by stepping, with a continuous ball", () => {
    expect(frames[total]).toEqual(buildCourtFrame(view, total));
    expect(frames[total]!.isFinal).toBe(true);
    for (let n = 1; n <= total; n += 1) {
      const path = frames[n]!.lastPlay!.path;
      expect(path[0]).toEqual(frames[n - 1]!.ball.at);
      expect(path[path.length - 1]).toEqual(frames[n]!.ball.at);
    }
  });

  it("makes the logged scorer the shooter on every make", () => {
    for (let n = 1; n <= total; n += 1) {
      const play = view.plays[n - 1]!;
      const frame = frames[n]!;
      expect(frame.lastPlay!.playerId).toBe(play.playerId);
      if (play.kind !== "substitution") {
        expect(frame.offenseSide === play.side).toBe(
          play.kind !== "defensive_rebound" &&
            play.kind !== "shooting_foul" &&
            play.kind !== "personal_foul",
        );
      }
      if (play.points > 0) {
        expect(frame.lastPlay!.outcome).toBe("made");
        const shooter = frame.players.find((p) => p.role === "shooter");
        expect(shooter?.playerId).toBe(play.playerId);
      }
    }
  });

  it("shows blocks and steals only when the log credits them", () => {
    for (let n = 1; n <= total; n += 1) {
      const play = view.plays[n - 1]!;
      const outcome = frames[n]!.lastPlay!.outcome;
      const missedFieldGoal =
        play.kind === "two_missed" || play.kind === "three_missed";
      expect(outcome === "blocked").toBe(
        missedFieldGoal && play.player2Id !== null,
      );
      expect(outcome === "stolen").toBe(
        play.kind === "turnover" && play.player2Id !== null,
      );
    }
  });

  it("accumulates the shot chart in step with the shot summary", () => {
    for (let n = 0; n <= total; n += 25) {
      const summary = buildShotSummary(view, n);
      const shots = frames[n]!.shots;
      for (const side of [0, 1] as const) {
        const team = side === 0 ? summary.home : summary.away;
        const mine = shots.filter((s) => s.side === side);
        expect(mine).toHaveLength(team.total.fga);
        expect(mine.filter((s) => s.made)).toHaveLength(team.total.fgm);
        expect(mine.filter((s) => s.three)).toHaveLength(team.total.threePa);
      }
    }
  });

  it("steps possession by possession to the final frame", () => {
    let n = 0;
    let steps = 0;
    while (n < total) {
      const next = stepPossession(view, n, 1);
      expect(next).toBeGreaterThan(n);
      expect(stepPossession(view, next, -1)).toBeLessThan(next);
      n = next;
      steps += 1;
    }
    expect(steps).toBe(possessionGroups(view).length);
    expect(buildCourtFrame(view, n)).toEqual(frames[total]);
    expect(buildLiveBoxScore(view, n)).toMatchObject({
      homeScore: view.finalScore.home,
      awayScore: view.finalScore.away,
      isFinal: true,
    });
  });

  it("lists every player who checked in at the latest checkpoint", () => {
    for (let n = 1; n <= total; n += 1) {
      const subs = frames[n]!.substitutions;
      const tail = view.plays[n - 1]!;
      expect(subs.length > 0).toBe(tail.kind === "substitution");
      const onCourt = new Set(frames[n]!.players.map((p) => p.playerId));
      for (const sub of subs) {
        expect(view.plays[sub.index]!.kind).toBe("substitution");
        expect(onCourt.has(sub.inId)).toBe(true);
      }
    }
  });

  it("keeps the ball holder on the ball while others drift", () => {
    let drifted = 0;
    frames.forEach((frame, n) => {
      if (frame.ball.holderId !== null) {
        const holder = frame.players.find(
          (p) => p.playerId === frame.ball.holderId,
        )!;
        expect(holder.spot).toEqual(frame.ball.at);
      }
      const previous = frames[n - 1];
      if (
        previous &&
        previous.possessionIndex === frame.possessionIndex &&
        frame.lastPlay?.motion !== "substitution"
      ) {
        const touched = new Set([
          frame.lastPlay?.playerId,
          frame.lastPlay?.player2Id,
          previous.lastPlay?.playerId,
          previous.lastPlay?.player2Id,
        ]);
        for (const player of frame.players) {
          const before = previous.players.find(
            (p) => p.playerId === player.playerId,
          );
          if (before && !touched.has(player.playerId)) {
            const moved = Math.hypot(
              (player.spot.x - before.spot.x) * COURT_FEET.width,
              (player.spot.y - before.spot.y) * COURT_FEET.length,
            );
            if (moved > 0) {
              drifted += 1;
            }
          }
        }
      }
    });
    expect(drifted).toBeGreaterThan(0);
  });

  it("cuts the shooter only on assisted makes, off the straight line", () => {
    let cuts = 0;
    for (let n = 1; n <= total; n += 1) {
      const lastPlay = frames[n]!.lastPlay!;
      const assistedMake =
        lastPlay.motion === "shot" &&
        lastPlay.outcome === "made" &&
        lastPlay.player2Id !== null;
      if (!assistedMake) {
        expect(lastPlay.cut).toBeNull();
        continue;
      }
      if (lastPlay.cut === null) {
        continue;
      }
      cuts += 1;
      expect(inBounds(lastPlay.cut)).toBe(true);
      const shooter = frames[n]!.players.find(
        (p) => p.playerId === lastPlay.playerId,
      )!;
      // The cut ends at the shot spot, so it is never the shot spot itself.
      expect(lastPlay.cut).not.toEqual(shooter.spot);
    }
    expect(cuts).toBeGreaterThan(0);
  });

  it("tracks dense possession indexes in order", () => {
    const groups = possessionGroups(view);
    let previous = -1;
    for (const frame of frames) {
      expect(frame.possessionIndex).toBeGreaterThanOrEqual(previous);
      expect(frame.possessionIndex).toBeLessThan(groups.length);
      previous = frame.possessionIndex;
    }
    expect(frames[total]!.possessionIndex).toBe(groups.length - 1);
  });
});

import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asTeamId, type PlayerId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  COURT_FEET,
  COURT_RIM,
  buildCourtFrame,
  possessionGroups,
  type CourtPoint,
} from "@/state/watch-court-frame";
import {
  BENCH_LAYOUT,
  WIDE_BENCH_LAYOUT,
  benchTopRowY,
  wideBenchPoint,
  FULL_COURT_FEET,
  attackingEnd,
  buildFullCourtFrame,
  opensAtNewEnd,
  restartKindAt,
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import { periodLabel, toWatchGameView } from "@/state/watch-game-selectors";
import { pickJumper } from "@/state/watch-jump-ball";
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
import { RESTART_PLAYS, fixtureView } from "../helpers/watch-view";

const pid = (id: string) => id as PlayerId;

function halfFeet(point: CourtPoint): { x: number; y: number } {
  return { x: point.x * COURT_FEET.width, y: point.y * COURT_FEET.length };
}

function fullFeet(point: FullCourtPoint): { x: number; y: number } {
  return {
    x: point.x * FULL_COURT_FEET.length,
    y: point.y * FULL_COURT_FEET.width,
  };
}

function inBounds(point: FullCourtPoint): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

describe("attackingEnd", () => {
  it("switches ends at halftime and keeps the second-half ends in overtime", () => {
    expect(attackingEnd(0, 1)).toBe("left");
    expect(attackingEnd(0, 2)).toBe("left");
    expect(attackingEnd(0, 3)).toBe("right");
    expect(attackingEnd(0, 4)).toBe("right");
    expect(attackingEnd(0, 5)).toBe("right");
    expect(attackingEnd(0, 7)).toBe("right");
    for (const period of [1, 2, 3, 4, 5, 6]) {
      expect(attackingEnd(1, period)).not.toBe(attackingEnd(0, period));
    }
  });
});

describe("toFullCourt", () => {
  it("puts the rim at the attacked end, centred across the width", () => {
    const hoop = COURT_FEET.hoopY / FULL_COURT_FEET.length;
    const left = toFullCourt(COURT_RIM, "left");
    const right = toFullCourt(COURT_RIM, "right");
    expect(left.x).toBeCloseTo(hoop, 3);
    expect(right.x).toBeCloseTo(1 - hoop, 3);
    expect(left.y).toBeCloseTo(0.5, 3);
    expect(right.y).toBeCloseTo(0.5, 3);
    // The half-court line lands on the centre line from both ends.
    expect(toFullCourt({ x: 0.3, y: 1 }, "left").x).toBe(0.5);
    expect(toFullCourt({ x: 0.3, y: 1 }, "right").x).toBe(0.5);
  });

  it("is a rotation: distances and handedness are preserved", () => {
    const points: CourtPoint[] = [
      { x: 0.1, y: 0.05 },
      { x: 0.5, y: 0.66 },
      { x: 0.9, y: 0.3 },
      { x: 0.32, y: 0.9 },
    ];
    const signedArea = (
      a: { x: number; y: number },
      b: { x: number; y: number },
      c: { x: number; y: number },
    ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    for (const end of ["left", "right"] as const) {
      const mapped = points.map((p) => fullFeet(toFullCourt(p, end)));
      const original = points.map(halfFeet);
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const before = Math.hypot(
            original[i]!.x - original[j]!.x,
            original[i]!.y - original[j]!.y,
          );
          const after = Math.hypot(
            mapped[i]!.x - mapped[j]!.x,
            mapped[i]!.y - mapped[j]!.y,
          );
          expect(after).toBeCloseTo(before, 1);
        }
      }
      expect(Math.sign(signedArea(mapped[0]!, mapped[1]!, mapped[2]!))).toBe(
        Math.sign(signedArea(original[0]!, original[1]!, original[2]!)),
      );
    }
  });
});

function watchPlayer(id: string, side: WatchSide): WatchPlayer {
  return {
    playerId: pid(id),
    side,
    fullName: `Pat ${id}`,
    shortName: `P. ${id}`,
    lastName: id,
    position: null,
    jerseyNumber: null,
    started: true,
    finalMinutes: 0,
  };
}

function play(
  index: number,
  period: number,
  poss: number,
  kind: WatchPlayKind,
  side: WatchSide,
  playerId: string,
  points = 0,
): WatchPlay {
  return {
    index,
    period,
    periodLabel: periodLabel(period),
    clock: 600,
    clockLabel: "",
    poss,
    kind,
    side,
    playerId: pid(playerId),
    player2Id: null,
    text: kind,
    points,
    homeScore: 0,
    awayScore: 0,
    highlights: [],
  };
}

/** One or two possessions per period, through halftime and into overtime. */
const PERIOD_PLAYS: WatchPlay[] = [
  play(0, 1, 1, "two_made", 0, "h1", 2), // home Q1 (left)
  play(1, 1, 2, "two_missed", 1, "a1"), // away Q1 (right)
  play(2, 1, 2, "defensive_rebound", 0, "h2"),
  play(3, 2, 3, "three_missed", 0, "h3"), // home Q2 (left)
  play(4, 2, 3, "defensive_rebound", 1, "a2"),
  play(5, 3, 4, "two_made", 1, "a3", 2), // away Q3 (left): same end
  play(6, 3, 5, "three_made", 0, "h4", 3), // home Q3 (right)
  play(7, 4, 6, "two_missed", 1, "a4"), // away Q4 (left)
  play(8, 5, 7, "two_made", 1, "a5", 2), // away OT (left)
];

const PERIOD_VIEW: WatchGameView = {
  gameId: asGameId("game_full_court_periods"),
  date: "2026-10-17",
  competitionType: "regular_season",
  home: {} as never,
  away: {} as never,
  finalScore: { home: 5, away: 4 },
  periodScores: [],
  players: [
    ...["h1", "h2", "h3", "h4", "h5"].map((id) => watchPlayer(id, 0)),
    ...["a1", "a2", "a3", "a4", "a5"].map((id) => watchPlayer(id, 1)),
  ],
  plays: PERIOD_PLAYS,
  keyMoments: [],
  shotSummary: {} as never,
  injuries: [],
};

describe("buildFullCourtFrame (periods and ends)", () => {
  const total = PERIOD_PLAYS.length;
  const frames = Array.from({ length: total + 1 }, (_, n) =>
    buildFullCourtFrame(PERIOD_VIEW, n),
  );

  it("holds the ball at centre court for the tip, then brings it up", () => {
    expect(frames[0]!.ball).toEqual({ at: { x: 0.5, y: 0.5 }, holderId: null });
    expect(frames[0]!.players.some((p) => p.role === "handler")).toBe(false);
    expect(frames[1]!.transition![0]).toEqual({ x: 0.5, y: 0.5 });
  });

  it("attacks the end for the possession's team and period", () => {
    const expected = [
      "left",
      "right",
      "right",
      "left",
      "left",
      "left",
      "right",
      "left",
      "left",
    ];
    for (let n = 1; n <= total; n += 1) {
      expect(frames[n]!.attackingEnd).toBe(expected[n - 1]);
      const shooter = frames[n]!.players.find((p) => p.role === "shooter");
      if (shooter) {
        const left = frames[n]!.attackingEnd === "left";
        expect(shooter.spot.x < 0.5).toBe(left);
      }
    }
  });

  it("uses the opposite end for home in Q1 and Q3, and the Q4 end in OT", () => {
    expect(frames[1]!.attackingEnd).toBe("left"); // home Q1
    expect(frames[7]!.attackingEnd).toBe("right"); // home Q3
    expect(frames[8]!.attackingEnd).toBe(frames[9]!.attackingEnd); // away Q4, OT
  });

  it("keeps each shot marker where it was taken through halftime", () => {
    const final = frames[total]!;
    expect(final.shots.map((s) => s.end)).toEqual([
      "left",
      "right",
      "left",
      "left",
      "right",
      "left",
      "left",
    ]);
    for (const frame of frames) {
      for (const shot of frame.shots) {
        const later = final.shots.find((s) => s.index === shot.index)!;
        expect(shot.at).toEqual(later.at);
        expect(shot.at.x < 0.5).toBe(shot.end === "left");
      }
    }
  });

  it("adds a transition only when the attacking end changes", () => {
    const withTransition = frames
      .map((frame, n) => (frame.transition ? n : -1))
      .filter((n) => n >= 0);
    // Tip-off, away Q1, then every period start (the inbound from the
    // baseline brings the ball up even at the same end), home Q3 and away Q4.
    expect(withTransition).toEqual([1, 2, 4, 6, 7, 8, 9]);
  });

  it("inbounds under the basket after a make", () => {
    // Play 6 opens home's Q3 possession after away's make at the left rim.
    const transition = frames[7]!.transition!;
    expect(transition).toHaveLength(4);
    expect(transition[0]!.x).toBeLessThan(0.1);
    expect(transition[1]!.x).toBeLessThan(0.02);
    expect(transition[2]!.x).toBe(0.5);
    expect(frames[7]!.lastPlay!.path[0]).toEqual(transition[3]);
    // Away inbounds after home's opening make. A defensive rebound ends away's
    // Q1 possession with a live ball, but the next possession opens Q2, which
    // inbounds from the baseline: so it carries an inbound too.
    expect(frames[2]!.transition).toHaveLength(4);
    expect(frames[2]!.restart).toBeNull();
    expect(frames[4]!.transition).toHaveLength(4);
    expect(frames[4]!.restart?.kind).toBe("baseline");
  });
});

const CENTRE_POINT = { x: 0.5, y: 0.5 };

describe("jump ball", () => {
  const view = fixtureView("game_jump_ball", RESTART_PLAYS);

  it("picks the centre, else the next-tallest position, else lineup order", () => {
    const lineup = view.players
      .filter((p) => p.side === 0)
      .map((p) => p.playerId);
    expect(pickJumper(view, lineup)).toBe(pid("h5"));
    expect(
      pickJumper(
        view,
        lineup.filter((id) => id !== pid("h5")),
      ),
    ).toBe(pid("h4"));
    const bare = fixtureView("game_jump_ball", RESTART_PLAYS, {
      positions: null,
    });
    expect(pickJumper(bare, lineup)).toBe(pid("h1"));
    expect(pickJumper(bare, [])).toBeNull();
  });

  it("stands the two centres at the dot and the rest on each team's half", () => {
    const frame = buildFullCourtFrame(view, 0);
    expect(frame.ball).toEqual({ at: CENTRE_POINT, holderId: null });
    expect(frame.restart).toBeNull();
    const middle = fullFeet(CENTRE_POINT);
    const feet = (id: string) =>
      fullFeet(frame.players.find((p) => p.playerId === pid(id))!.spot);
    const fromMiddle = (id: string) =>
      Math.hypot(feet(id).x - middle.x, feet(id).y - middle.y);
    for (const id of ["h5", "a5"]) {
      expect(fromMiddle(id)).toBeLessThan(2);
    }
    // Home attacks left in Q1, so it defends and stands on the right.
    expect(feet("h5").x).toBeGreaterThan(middle.x);
    expect(feet("a5").x).toBeLessThan(middle.x);
    for (const player of frame.players) {
      if (player.playerId === pid("h5") || player.playerId === pid("a5")) {
        continue;
      }
      // Well outside the 6 ft circle (wide enough to read on a phone).
      const away = fromMiddle(player.playerId);
      expect(away).toBeGreaterThanOrEqual(COURT_FEET.freeThrowCircleRadius + 5);
      expect(away).toBeLessThanOrEqual(COURT_FEET.freeThrowCircleRadius + 7);
      expect(player.spot.x > 0.5).toBe(player.side === 0);
      expect(player.role).toBe("off-ball");
    }
    for (const a of frame.players) {
      for (const b of frame.players) {
        if (a.playerId < b.playerId) {
          const d = Math.hypot(
            fullFeet(a.spot).x - fullFeet(b.spot).x,
            fullFeet(a.spot).y - fullFeet(b.spot).y,
          );
          expect(d).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("opens play 0 with the tip restart at centre court", () => {
    const frame = buildFullCourtFrame(view, 1);
    expect(frame.restart).toEqual({ kind: "tip", at: CENTRE_POINT });
    expect(frame.transition![0]).toEqual(CENTRE_POINT);
  });
});

describe("restarts (inferred inbounds)", () => {
  const view = fixtureView("game_restarts", RESTART_PLAYS);
  const frames = Array.from({ length: RESTART_PLAYS.length + 1 }, (_, n) =>
    buildFullCourtFrame(view, n),
  );

  it("classifies how each possession starts", () => {
    expect(RESTART_PLAYS.map((_, i) => restartKindAt(view, i))).toEqual([
      "tip", // 0
      null, // 1: after a make (baseline inbound, in the transition)
      "sideline", // 2: after an out-of-bounds turnover
      null, // 3: same possession
      null, // 4: after a defensive rebound
      null, // 5: after a steal
      null, // 6: same possession
      "sideline", // 7: after a personal foul
      null, // 8: same possession
      "sideline", // 9: after an offensive foul
      "baseline", // 10: new period
    ]);
  });

  it("inbounds from the sideline nearest the ball, at its x, after an out-of-bounds turnover", () => {
    // Away's turnover ends at the right end; home takes the ball up to the left.
    const ball = frames[2]!.ball.at;
    const restart = frames[3]!.restart!;
    expect(restart.kind).toBe("sideline");
    expect(restart.at.x).toBeCloseTo(ball.x, 3);
    expect(restart.at.y).toBe(ball.y < 0.5 ? 0 : 1);
    expect(frames[3]!.transition).toHaveLength(4);
    expect(frames[3]!.transition![1]).toEqual(restart.at);
    expect(frames[3]!.attackingEnd).toBe("left");
  });

  it("inbounds from the sideline at the same end when the ball stays", () => {
    const ball = frames[7]!.ball.at;
    const restart = frames[8]!.restart!;
    expect(restart.kind).toBe("sideline");
    expect(restart.at.x).toBeCloseTo(ball.x, 3);
    expect([0, 1]).toContain(restart.at.y);
    expect(frames[8]!.transition).toBeNull();
    expect(frames[7]!.attackingEnd).toBe(frames[8]!.attackingEnd);
    expect(opensAtNewEnd(view, 7)).toBe(false);
  });

  it("brings the ball in from the sideline after an offensive foul", () => {
    const restart = frames[10]!.restart!;
    expect(restart.kind).toBe("sideline");
    expect(frames[10]!.transition![1]).toEqual(restart.at);
  });

  it("has no inbound after a steal or a defensive rebound", () => {
    // Play 4 follows a defensive rebound, play 5 a steal: both open live.
    expect(frames[5]!.restart).toBeNull();
    expect(frames[6]!.restart).toBeNull();
    expect(frames[5]!.transition).toHaveLength(3);
    expect(frames[6]!.transition).toHaveLength(3);
  });

  it("inbounds from the baseline of the end it defends at a period start", () => {
    const restart = frames[11]!.restart!;
    expect(restart.kind).toBe("baseline");
    // Away attacks right in Q2, so it inbounds on the left baseline.
    expect(frames[11]!.attackingEnd).toBe("right");
    expect(restart.at.x).toBeLessThan(0.02);
    expect(frames[11]!.transition![1]).toEqual(restart.at);
    expect(opensAtNewEnd(view, 10)).toBe(true);
  });

  it("is deterministic", () => {
    expect(
      Array.from({ length: RESTART_PLAYS.length + 1 }, (_, n) =>
        buildFullCourtFrame(view, n),
      ),
    ).toEqual(frames);
  });
});

describe("free throw lane line-up", () => {
  const view = fixtureView("game_free_throws", [
    {
      poss: 1,
      kind: "shooting_foul",
      side: 0,
      playerId: "h2",
      player2Id: "a3",
    },
    { poss: 1, kind: "ft_missed", side: 1, playerId: "a3" },
    { poss: 1, kind: "ft_made", side: 1, playerId: "a3", points: 1 },
  ]);

  it("lines both teams up on the lane with the shooter at the line", () => {
    for (const n of [2, 3]) {
      const frame = buildFullCourtFrame(view, n);
      const rim = fullFeet(toFullCourt(COURT_RIM, frame.attackingEnd));
      const feet = (id: string) =>
        fullFeet(frame.players.find((p) => p.playerId === pid(id))!.spot);
      const inLane = (id: string) =>
        Math.abs(feet(id).y - rim.y) <= COURT_FEET.laneWidth / 2 &&
        Math.abs(feet(id).x - rim.x) <=
          COURT_FEET.laneLength - COURT_FEET.hoopY;
      expect(
        Math.hypot(feet("a3").x - rim.x, feet("a3").y - rim.y),
      ).toBeCloseTo(COURT_FEET.freeThrowY - COURT_FEET.hoopY, 0);
      const defense = ["h1", "h2", "h3", "h4", "h5"];
      const offense = ["a1", "a2", "a4", "a5"];
      expect(defense.filter(inLane)).toHaveLength(3);
      expect(offense.filter(inLane)).toHaveLength(2);
      // The defense holds the two spots nearest the rim.
      const nearest = [...defense, ...offense]
        .filter(inLane)
        .sort(
          (a, b) => Math.abs(feet(a).x - rim.x) - Math.abs(feet(b).x - rim.x),
        )
        .slice(0, 2);
      expect(nearest.every((id) => defense.includes(id))).toBe(true);
      // Everyone else waits behind the arc.
      for (const id of [...defense, ...offense].filter((i) => !inLane(i))) {
        const off = Math.hypot(feet(id).x - rim.x, feet(id).y - rim.y);
        expect(off).toBeGreaterThan(COURT_FEET.threeRadius);
      }
      expect(frame.players.every((p) => inBounds(p.spot))).toBe(true);
    }
  });
});

describe("buildFullCourtFrame (recorded real game)", () => {
  const REAL_ID = "game_full_court_real";

  function recordedState(): GameState {
    let state = createTestGameState({ saveId: "full_court_real" });
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
  const groups = possessionGroups(view);
  const frames: FullCourtFrame[] = [];
  for (let n = 0; n <= total; n += 1) {
    frames.push(buildFullCourtFrame(view, n));
  }

  it("plays through both halves", () => {
    expect(Math.max(...view.plays.map((p) => p.period))).toBeGreaterThanOrEqual(
      4,
    );
    expect(frames.filter((f) => f.transition !== null).length).toBeGreaterThan(
      10,
    );
  });

  it("is deterministic and reaches the same final frame by stepping", () => {
    for (let n = 0; n <= total; n += 37) {
      expect(buildFullCourtFrame(view, n)).toEqual(frames[n]);
    }
    expect(buildFullCourtFrame(view, total)).toEqual(frames[total]);
  });

  it("keeps the half-court shooter, rebounder and ball holder", () => {
    frames.forEach((frame, n) => {
      const base = buildCourtFrame(view, n);
      expect(frame.players.map((p) => p.playerId)).toEqual(
        base.players.map((p) => p.playerId),
      );
      expect(frame.lastPlay?.playerId).toEqual(base.lastPlay?.playerId);
      expect(frame.lastPlay?.motion).toEqual(base.lastPlay?.motion);
      if (base.possessionIndex >= 0) {
        expect(frame.ball.holderId).toBe(base.ball.holderId);
        expect(frame.players.map((p) => p.role)).toEqual(
          base.players.map((p) => p.role),
        );
        expect(frame.players.map((p) => p.spot)).toEqual(
          base.players.map((p) => toFullCourt(p.spot, frame.attackingEnd)),
        );
      }
      expect(frame.players.every((p) => inBounds(p.spot))).toBe(true);
      expect(inBounds(frame.ball.at)).toBe(true);
    });
  });

  it("attacks left with home in the first half and right after it", () => {
    frames.forEach((frame) => {
      const group = groups[frame.possessionIndex];
      if (!group) {
        return;
      }
      expect(frame.attackingEnd).toBe(
        attackingEnd(frame.offenseSide, group.period),
      );
      const homeLeft = group.period <= 2;
      expect(frame.attackingEnd === "left").toBe(
        (frame.offenseSide === 0) === homeLeft,
      );
    });
  });

  it("moves the ball continuously, through the transition on an end change", () => {
    for (let n = 1; n <= total; n += 1) {
      const frame = frames[n]!;
      const path = frame.lastPlay!.path;
      const route = [
        ...(frame.transition ?? []),
        ...path.slice(frame.transition ? 1 : 0),
      ];
      expect(route[0]).toEqual(frames[n - 1]!.ball.at);
      expect(route[route.length - 1]).toEqual(frame.ball.at);
      if (frame.transition) {
        expect(frame.transition[frame.transition.length - 1]).toEqual(path[0]);
        expect(frame.transition.every(inBounds)).toBe(true);
        const group = groups[frame.possessionIndex]!;
        expect(frame.lastPlay!.index).toBe(group.start);
        const previous = groups[frame.possessionIndex - 1];
        if (previous && previous.period === group.period) {
          expect(attackingEnd(previous.offenseSide, previous.period)).not.toBe(
            frame.attackingEnd,
          );
        }
      }
    }
  });

  it("only adds transitions when possession opens a period or at a new end", () => {
    frames.forEach((frame) => {
      const group = groups[frame.possessionIndex];
      const opening =
        group !== undefined &&
        frame.lastPlay !== null &&
        frame.lastPlay.index === group.start;
      const previous = groups[frame.possessionIndex - 1];
      const endChanged =
        frame.possessionIndex === 0 ||
        (previous !== undefined &&
          (previous.period !== group?.period ||
            attackingEnd(previous.offenseSide, previous.period) !==
              frame.attackingEnd));
      expect(frame.transition !== null).toBe(opening && endChanged);
    });
  });

  it("flags exactly the plays whose frame carries a transition", () => {
    for (let n = 1; n <= total; n += 1) {
      const frame = frames[n]!;
      const opening =
        frame.lastPlay !== null &&
        groups[frame.possessionIndex]?.start === frame.lastPlay.index;
      expect(opensAtNewEnd(view, frame.lastPlay!.index)).toBe(
        opening && frame.transition !== null,
      );
    }
  });

  it("points the next possession at the end that team attacks", () => {
    frames.forEach((frame, n) => {
      const next = groups.find((g) => g.end > n);
      if (!next) {
        expect(frame.ballSide).toBeNull();
        expect(frame.ballEnd).toBeNull();
        return;
      }
      expect(frame.ballSide).toBe(next.offenseSide);
      expect(frame.ballEnd).toBe(attackingEnd(next.offenseSide, next.period));
    });
  });

  it("never moves a shot marker once it is on the floor", () => {
    const final = new Map(frames[total]!.shots.map((s) => [s.index, s]));
    frames.forEach((frame) => {
      for (const shot of frame.shots) {
        expect(shot).toEqual(final.get(shot.index));
        expect(shot.end).toBe(
          attackingEnd(shot.side, view.plays[shot.index]!.period),
        );
      }
    });
  });
});

describe("buildFullCourtFrame bench", () => {
  // Eight non-starters a side (a 13-man roster): seats 0-7 at the start.
  const view = fixtureView(
    "game_bench",
    [
      { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
      { poss: 2, kind: "two_missed", side: 1, playerId: "a1" },
      {
        poss: 2,
        kind: "substitution",
        side: 0,
        playerId: "h3",
        player2Id: "h8",
      },
      {
        poss: 2,
        kind: "substitution",
        side: 1,
        playerId: "a2",
        player2Id: "a6",
      },
      { poss: 3, kind: "two_made", side: 0, playerId: "h2", points: 2 },
      {
        poss: 3,
        kind: "substitution",
        side: 0,
        playerId: "h8",
        player2Id: "h3",
      },
    ],
    { bench: 8 },
  );
  const ids = (list: { playerId: PlayerId }[]) => list.map((p) => p.playerId);

  it("lists every roster player who is not on the floor, home first", () => {
    const frame = buildFullCourtFrame(view, 0);
    expect(ids(frame.bench)).toEqual(
      [
        ...["h6", "h7", "h8", "h9", "h10", "h11", "h12", "h13"],
        ...["a6", "a7", "a8", "a9", "a10", "a11", "a12", "a13"],
      ].map(pid),
    );
    expect(frame.players).toHaveLength(10);
    for (const frameAt of [0, 2, 4, 6].map((n) =>
      buildFullCourtFrame(view, n),
    )) {
      const all = new Set([...ids(frameAt.players), ...ids(frameAt.bench)]);
      expect(all.size).toBe(view.players.length);
      expect(frameAt.bench).toHaveLength(16);
    }
  });

  it("seats home on the left half and away on the right, above the sideline", () => {
    const frame = buildFullCourtFrame(view, 0);
    for (const b of frame.bench) {
      expect(b.spot.y).toBeLessThan(0);
      if (b.side === 0) {
        expect(b.spot.x).toBeGreaterThanOrEqual(0.04);
        expect(b.spot.x).toBeLessThanOrEqual(0.46);
      } else {
        expect(b.spot.x).toBeGreaterThanOrEqual(0.54);
        expect(b.spot.x).toBeLessThanOrEqual(0.96);
      }
    }
    // Five a row, then a second row further up.
    const home = frame.bench.filter((b) => b.side === 0);
    expect(new Set(home.slice(0, 5).map((b) => b.spot.y)).size).toBe(1);
    expect(home[5]!.spot.y).toBeLessThan(home[0]!.spot.y);
    expect(home[5]!.spot.x).toBe(home[0]!.spot.x);
    expect(home[0]!.spot.x).toBe(BENCH_LAYOUT.firstX[0]);
    // No two seats share a spot.
    expect(
      new Set(frame.bench.map((b) => `${b.spot.x},${b.spot.y}`)).size,
    ).toBe(frame.bench.length);
    expect(frame.benchRows).toBe(2);
  });

  it("hands the incoming player's seat to the outgoing one", () => {
    const seatOf = (n: number, id: string) =>
      buildFullCourtFrame(view, n).bench.find((b) => b.playerId === pid(id))
        ?.spot;
    // Non-starters take seats 0-7 in roster order: h8 is seat 2.
    const h8 = seatOf(0, "h8");
    expect(h8).toEqual({
      x: BENCH_LAYOUT.firstX[0] + 2 * BENCH_LAYOUT.columnGap,
      y: BENCH_LAYOUT.firstRowY,
    });
    expect(seatOf(0, "h3")).toBeUndefined();
    // h3 goes out for h8 and sits in the seat h8 just left.
    expect(seatOf(2, "h3")).toBeUndefined();
    expect(seatOf(3, "h3")).toEqual(h8);
    expect(seatOf(3, "h8")).toBeUndefined();
    // And the swap back gives h8 the seat h3 held.
    expect(seatOf(6, "h8")).toEqual(h8);
    expect(seatOf(6, "h3")).toBeUndefined();
    // Everyone else stays put.
    expect(seatOf(0, "a9")).toEqual(seatOf(6, "a9"));
    expect(seatOf(0, "h13")).toEqual(seatOf(6, "h13"));
  });

  it("swaps seats in log order inside a run of substitutions", () => {
    const chain = fixtureView(
      "game_bench_chain",
      [
        { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
        {
          poss: 2,
          kind: "substitution",
          side: 0,
          playerId: "h1",
          player2Id: "h6",
        },
        {
          poss: 2,
          kind: "substitution",
          side: 0,
          playerId: "h2",
          player2Id: "h7",
        },
        {
          poss: 2,
          kind: "substitution",
          side: 0,
          playerId: "h6",
          player2Id: "h1",
        },
      ],
      { bench: 3 },
    );
    const seat = (n: number, id: string) =>
      buildFullCourtFrame(chain, n).bench.find((b) => b.playerId === pid(id))
        ?.spot;
    const h6 = seat(1, "h6");
    const h7 = seat(1, "h7");
    expect(seat(2, "h1")).toEqual(h6);
    expect(seat(3, "h2")).toEqual(h7);
    // h6 went out again and takes the seat h1 holds... which h1 now leaves.
    expect(seat(4, "h6")).toEqual(h6);
    expect(seat(4, "h1")).toBeUndefined();
  });

  it("never needs more than two rows for a roster of 13 or 15", () => {
    for (const bench of [8, 10]) {
      const roster = fixtureView(
        `game_bench_${bench}`,
        [
          { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
          ...Array.from({ length: 5 }, (_, i) => ({
            poss: 2,
            kind: "substitution" as const,
            side: 0 as const,
            playerId: `h${i + 1}`,
            player2Id: `h${i + 6}`,
          })),
          { poss: 3, kind: "two_missed", side: 1, playerId: "a1" },
        ],
        { bench },
      );
      for (let n = 0; n <= roster.plays.length; n += 1) {
        const frame = buildFullCourtFrame(roster, n);
        expect(frame.benchRows).toBe(2);
        const spots = frame.bench.map((b) => `${b.spot.x},${b.spot.y}`);
        expect(new Set(spots).size).toBe(spots.length);
        for (const b of frame.bench) {
          expect(b.spot.y).toBeGreaterThanOrEqual(
            BENCH_LAYOUT.firstRowY - BENCH_LAYOUT.rowGap - 1e-9,
          );
        }
      }
    }
  });

  it("falls back to a third row for a roster over 15", () => {
    const big = fixtureView("game_bench_16", [], { bench: 11 });
    expect(buildFullCourtFrame(big, 0).benchRows).toBe(3);
  });

  it("puts the substitute on the outgoing player's floor slot", () => {
    const slotOf = (n: number, id: string) =>
      buildFullCourtFrame(view, n).players.find((p) => p.playerId === pid(id))
        ?.slot;
    expect(slotOf(3, "h8")).toBe(slotOf(2, "h3"));
    expect(slotOf(6, "h3")).toBe(slotOf(5, "h8"));
  });

  it("labels bench players and is deterministic", () => {
    const frame = buildFullCourtFrame(view, 3);
    expect(frame.bench.find((b) => b.playerId === pid("h3"))).toMatchObject({
      playerId: pid("h3"),
      fullName: "Pat h3",
      label: "h3",
    });
    expect(buildFullCourtFrame(view, 3)).toEqual(frame);
  });

  it("reserves one row for a small bench", () => {
    expect(
      buildFullCourtFrame(fixtureView("g", RESTART_PLAYS), 0).benchRows,
    ).toBe(1);
    expect(
      buildFullCourtFrame(fixtureView("g", RESTART_PLAYS), 0).bench,
    ).toEqual([]);
  });
});

describe("wideBenchPoint", () => {
  it("seats a wide floor's bench in one row of ten, seat for seat", () => {
    const narrow = (side: 0 | 1, seat: number) => ({
      x:
        BENCH_LAYOUT.firstX[side] +
        (seat % BENCH_LAYOUT.perRow) * BENCH_LAYOUT.columnGap,
      y:
        BENCH_LAYOUT.firstRowY -
        Math.floor(seat / BENCH_LAYOUT.perRow) * BENCH_LAYOUT.rowGap,
    });
    for (const side of [0, 1] as const) {
      const xs: number[] = [];
      for (let seat = 0; seat < 10; seat += 1) {
        const wide = wideBenchPoint(narrow(side, seat));
        expect(wide.y).toBeCloseTo(WIDE_BENCH_LAYOUT.firstRowY);
        xs.push(wide.x);
      }
      // Ten distinct seats, in order, on the team's own half.
      for (let k = 1; k < xs.length; k += 1) {
        expect(xs[k]!).toBeGreaterThan(xs[k - 1]!);
      }
      expect(xs.every((x) => (side === 0 ? x < 0.5 : x > 0.5))).toBe(true);
    }
  });

  it("leaves floor points alone", () => {
    expect(wideBenchPoint({ x: 0.3, y: 0 })).toEqual({ x: 0.3, y: 0 });
    expect(wideBenchPoint({ x: 0.7, y: 0.4 })).toEqual({ x: 0.7, y: 0.4 });
  });

  it("needs half as many rows on a wide floor", () => {
    expect(benchTopRowY(2, true)).toBeCloseTo(WIDE_BENCH_LAYOUT.firstRowY);
    expect(benchTopRowY(3, true)).toBeCloseTo(
      WIDE_BENCH_LAYOUT.firstRowY - WIDE_BENCH_LAYOUT.rowGap,
    );
    expect(benchTopRowY(2)).toBeLessThan(benchTopRowY(2, true));
  });
});

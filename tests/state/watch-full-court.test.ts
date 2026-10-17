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
  FULL_COURT_FEET,
  attackingEnd,
  buildFullCourtFrame,
  opensAtNewEnd,
  toFullCourt,
  type FullCourtFrame,
  type FullCourtPoint,
} from "@/state/watch-full-court";
import { periodLabel, toWatchGameView } from "@/state/watch-game-selectors";
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

  it("waits at centre court before the tip, then brings the ball up", () => {
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
    // Tip-off, away Q1, home Q2, home Q3, away Q4. Not the Q3 opener (away
    // attacks the end home just left) or overtime.
    expect(withTransition).toEqual([1, 2, 4, 7, 8]);
  });

  it("inbounds under the basket after a make", () => {
    // Play 6 opens home's Q3 possession after away's make at the left rim.
    const transition = frames[7]!.transition!;
    expect(transition).toHaveLength(4);
    expect(transition[0]!.x).toBeLessThan(0.1);
    expect(transition[1]!.x).toBeLessThan(0.02);
    expect(transition[2]!.x).toBe(0.5);
    expect(frames[7]!.lastPlay!.path[0]).toEqual(transition[3]);
    // Away inbounds after home's opening make; no inbound after the
    // defensive rebound that ends away's Q1 possession.
    expect(frames[2]!.transition).toHaveLength(4);
    expect(frames[4]!.transition).toHaveLength(3);
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
        if (previous) {
          expect(attackingEnd(previous.offenseSide, previous.period)).not.toBe(
            frame.attackingEnd,
          );
        }
      }
    }
  });

  it("only adds transitions when possession opens at a new end", () => {
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
          attackingEnd(previous.offenseSide, previous.period) !==
            frame.attackingEnd);
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

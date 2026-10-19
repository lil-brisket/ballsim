import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asTeamId, type PlayerId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  CHOREO_MIN_SPACING_FEET,
  buildPlayChoreography,
  feetBetween,
  type PlayChoreography,
} from "@/state/watch-court-choreo";
import {
  PLAY_PACING_MS,
  TIP_MS,
  WHISTLE_TRANSITION_MS,
  motionMs,
  openerShare,
  tipShare,
} from "@/components/game/watch/playback-pacing";
import { COURT_RIM, subRunEnd, subRunStart } from "@/state/watch-court-frame";
import { buildFullCourtFrame, toFullCourt } from "@/state/watch-full-court";
import { toWatchGameView } from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";
import {
  RESTART_PLAYS,
  fixtureView,
  type FixturePlay,
} from "../helpers/watch-view";

const GAME_ID = "game_choreo_real";

function recordedView(seed: number): WatchGameView {
  let state: GameState = createTestGameState({ saveId: "choreo_real" });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  const teamIds = Object.keys(state.world.teams).map((id) => asTeamId(id));
  const today = state.world.calendar.currentDate;
  const game = createGame({
    id: asGameId(GAME_ID),
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
  state = simulateGamesForDate(state, createTestRng(seed), today, undefined, {
    ownerTeamId: teamIds[0]!,
  }).state;
  return toWatchGameView(state, GAME_ID)!;
}

function trackOf(c: PlayChoreography, id: PlayerId) {
  return c.tracks.find((t) => t.playerId === id)!.points;
}

/** Index of the beat where the ball leaves the shooter's hand. */
function releaseBeat(c: PlayChoreography): number {
  return c.legs.indexOf("shot");
}

describe.each([41, 7])(
  "buildPlayChoreography (recorded real game, seed %i)",
  (seed) => {
    const view = recordedView(seed);
    const plays = view.plays;
    const frames = Array.from({ length: plays.length + 1 }, (_, n) =>
      buildFullCourtFrame(view, n),
    );
    const choreos: Array<PlayChoreography | null> = plays.map((_, i) =>
      buildPlayChoreography(view, i),
    );
    // Substitution runs have their own choreography (tested below).
    const played = choreos.flatMap((c, i) =>
      c && plays[i]!.kind !== "substitution" ? [c] : [],
    );

    it("is null outside the log and present for every play in it", () => {
      choreos.forEach((c) => {
        expect(c).not.toBeNull();
      });
      expect(buildPlayChoreography(view, -1)).toBeNull();
      expect(buildPlayChoreography(view, plays.length)).toBeNull();
    });

    it("walks a substitution run from the bench seats to the floor and back", () => {
      let runs = 0;
      plays.forEach((play, i) => {
        if (play.kind !== "substitution") {
          return;
        }
        const first = subRunStart(view, i);
        const end = subRunEnd(view, i);
        const c = choreos[i]!;
        // Any play of a run gives the same walk, from the run's first frame.
        expect(c.index).toBe(first);
        expect(c.tracks).toEqual(choreos[first]!.tracks);
        const from = frames[first]!;
        const to = frames[end]!;
        const spots = (frame: typeof from) =>
          new Map([
            ...frame.players.map((p) => [p.playerId, p.spot] as const),
            ...frame.bench.map((b) => [b.playerId, b.spot] as const),
          ]);
        const fromSpots = spots(from);
        const toSpots = spots(to);
        expect(c.tracks).toHaveLength(view.players.length);
        for (const track of c.tracks) {
          expect(track.points[0]).toEqual(fromSpots.get(track.playerId));
          expect(track.points.at(-1)).toEqual(toSpots.get(track.playerId));
        }
        expect(c.deadBall).toBe(true);
        expect(c.beats).toContain(c.eventAt);
        expect(c.eventAt).toBeGreaterThan(0);
        expect(c.eventAt).toBeLessThan(1);
        expect(c.legs.every((leg) => leg === "loose")).toBe(true);
        expect(c.ball[0]!.at).toEqual(from.ball.at);
        expect(c.ball.at(-1)!.at).toEqual(to.ball.at);
        runs += 1;
      });
      expect(runs).toBeGreaterThan(0);
    });

    it("starts on the previous frame and ends exactly on the next one", () => {
      for (const c of played) {
        const from = frames[c.index]!;
        const to = frames[c.index + 1]!;
        expect(c.tracks.map((t) => t.playerId)).toEqual(
          to.players.map((p) => p.playerId),
        );
        for (const player of to.players) {
          const points = trackOf(c, player.playerId);
          const before = from.players.find(
            (p) => p.playerId === player.playerId,
          );
          expect(points[0]).toEqual(before!.spot);
          expect(points[points.length - 1]).toEqual(player.spot);
        }
        expect(c.ball[0]!.at).toEqual(from.ball.at);
        expect(c.ball[0]!.holderId).toBe(from.ball.holderId);
        expect(c.ball[c.ball.length - 1]!.at).toEqual(to.ball.at);
        expect(c.ball[c.ball.length - 1]!.holderId).toBe(to.ball.holderId);
      }
    });

    it("gives every pass in a field goal real time in the air", () => {
      // Consecutive pass legs are one flight; at 1x none may go faster than a
      // hard pass, however many beats other players add along the way.
      let checked = 0;
      for (let i = 0; i < plays.length; i += 1) {
        if (!/^(two|three)_/.test(plays[i]!.kind)) {
          continue;
        }
        // Built as the client builds it, so its times match the pacing.
        const share = openerShare(view, i);
        const c = buildPlayChoreography(view, i, {
          openerShare: share,
          tipShare: tipShare(view, i),
        })!;
        const total = motionMs(view, i + 1);
        let k = 0;
        while (k < c.legs.length) {
          if (c.legs[k] !== "pass" || c.beats[k]! < share - 1e-6) {
            k += 1;
            continue;
          }
          const startK = k;
          while (k < c.legs.length && c.legs[k] === "pass") {
            k += 1;
          }
          const feet = feetBetween(c.ball[startK]!.at, c.ball[k]!.at);
          const seconds = ((c.beats[k]! - c.beats[startK]!) * total) / 1000;
          expect(feet / seconds).toBeLessThan(90);
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThan(20);
    });

    it("puts the event on a beat inside the play", () => {
      for (const c of played) {
        expect(c.eventAt).toBeGreaterThan(0);
        expect(c.eventAt).toBeLessThan(1);
        expect(c.beats).toContain(c.eventAt);
      }
    });

    it("ends on a dead ball for whistles and free throws, live otherwise", () => {
      for (const c of played) {
        const play = plays[c.index]!;
        const whistle =
          play.kind.endsWith("_foul") ||
          play.kind.startsWith("ft_") ||
          (play.kind === "turnover" && play.player2Id === null);
        expect(c.deadBall).toBe(whistle);
      }
    });

    it("stops everyone on the whistle", () => {
      for (const c of played) {
        if (!plays[c.index]!.kind.endsWith("_foul")) {
          continue;
        }
        const k = c.beats.indexOf(c.eventAt);
        for (const track of c.tracks) {
          for (let j = k; j < c.beats.length; j += 1) {
            expect(track.points[j]).toEqual(track.points.at(-1));
          }
        }
      }
    });

    it("has ascending beats from 0 to 1 with one point and ball per beat", () => {
      for (const c of played) {
        expect(c.beats[0]).toBe(0);
        expect(c.beats[c.beats.length - 1]).toBe(1);
        for (let k = 1; k < c.beats.length; k += 1) {
          expect(c.beats[k]!).toBeGreaterThan(c.beats[k - 1]!);
        }
        expect(c.beats.length).toBeGreaterThanOrEqual(2);
        expect(c.ball).toHaveLength(c.beats.length);
        expect(c.legs).toHaveLength(c.beats.length - 1);
        for (const track of c.tracks) {
          expect(track.points).toHaveLength(c.beats.length);
        }
      }
    });

    it("has the shooter holding the ball when it is released", () => {
      let checked = 0;
      for (const c of played) {
        const play = plays[c.index]!;
        if (
          play.kind === "substitution" ||
          play.kind.endsWith("rebound") ||
          play.kind.endsWith("foul") ||
          play.kind === "turnover"
        ) {
          expect(c.legs).not.toContain("shot");
          continue;
        }
        const release = releaseBeat(c);
        expect(c.legs.filter((leg) => leg === "shot")).toHaveLength(1);
        expect(c.ball[release]!.holderId).toBe(play.playerId);
        // It reaches the rim (or the block) before the play ends, then sits.
        expect(c.ball[release + 1]!.holderId).toBeNull();
        expect(release + 1).toBeLessThan(c.beats.length - 1);
        if (frames[c.index + 1]!.lastPlay?.outcome === "blocked") {
          // A block cuts the shot off at contact; the ball then goes loose
          // to its resting spot (see "blocks" below).
          expect(c.legs[release + 1]).toBe("loose");
          expect(c.ball[release + 2]!.at).toEqual(c.ball.at(-1)!.at);
        } else {
          expect(c.ball[release + 1]!.at).toEqual(c.ball.at(-1)!.at);
        }
        checked += 1;
      }
      expect(checked).toBeGreaterThan(50);
    });

    it("has the logged assister make the last pass of an assisted make", () => {
      let checked = 0;
      for (const c of played) {
        const play = plays[c.index]!;
        if (
          !(play.kind === "two_made" || play.kind === "three_made") ||
          play.player2Id === null
        ) {
          continue;
        }
        const lastPass = c.legs.lastIndexOf("pass");
        expect(lastPass).toBeGreaterThanOrEqual(0);
        expect(c.ball[lastPass]!.holderId).toBe(play.player2Id);
        expect(c.ball[lastPass + 1]!.holderId).toBe(play.playerId);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(20);
    });

    it("ends a steal with the ball in the stealer's hands", () => {
      let checked = 0;
      for (const c of played) {
        const play = plays[c.index]!;
        if (play.kind !== "turnover" || play.player2Id === null) {
          continue;
        }
        expect(c.ball[c.ball.length - 1]!.holderId).toBe(play.player2Id);
        expect(c.legs).toContain("steal");
        checked += 1;
      }
      expect(checked).toBeGreaterThan(0);
    });

    it("has the stealer arrive with the ball exactly at the event", () => {
      let checked = 0;
      for (const c of played) {
        const play = plays[c.index]!;
        const k = c.legs.indexOf("steal");
        if (k < 0) {
          continue;
        }
        expect(c.beats[k + 1]).toBe(c.eventAt);
        expect(
          feetBetween(trackOf(c, play.player2Id!)[k + 1]!, c.ball[k + 1]!.at),
        ).toBeLessThan(0.01);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(0);
    });

    it("has the blocker meet the ball at the event, before the rim beat", () => {
      let checked = 0;
      for (const c of played) {
        const play = plays[c.index]!;
        if (
          !(play.kind === "two_missed" || play.kind === "three_missed") ||
          play.player2Id === null
        ) {
          continue;
        }
        const release = releaseBeat(c);
        expect(c.eventAt).toBe(c.beats[release + 1]);
        expect(
          feetBetween(
            trackOf(c, play.player2Id)[release + 1]!,
            c.ball[release + 1]!.at,
          ),
        ).toBeLessThan(0.01);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(0);
    });

    it("only moves the ball between teammates unless the log records a steal", () => {
      for (const c of played) {
        const side = new Map(c.tracks.map((t) => [t.playerId, t.side]));
        c.legs.forEach((leg, k) => {
          const a = c.ball[k]!.holderId;
          const b = c.ball[k + 1]!.holderId;
          if (leg === "pass") {
            expect(side.get(a!)).toBe(side.get(b!));
          }
          if (leg === "steal") {
            expect(plays[c.index]!.kind).toBe("turnover");
            expect(b).toBe(plays[c.index]!.player2Id);
          }
        });
      }
    });

    it("keeps the ball with an on-court holder, on that holder's track", () => {
      for (const c of played) {
        const onCourt = new Set(c.tracks.map((t) => t.playerId));
        c.ball.forEach((ball, k) => {
          if (ball.holderId === null) {
            return;
          }
          expect(onCourt.has(ball.holderId)).toBe(true);
          expect(
            feetBetween(ball.at, trackOf(c, ball.holderId)[k]!),
          ).toBeLessThan(0.01);
        });
      }
    });

    it("keeps every token at least 3 ft apart at the inner beats", () => {
      for (const c of played) {
        // After a whistle the floor is frozen on the end frame.
        const frozen = plays[c.index]!.kind.endsWith("_foul")
          ? c.beats.indexOf(c.eventAt)
          : c.beats.length - 1;
        for (let k = 1; k < frozen; k += 1) {
          const points = c.tracks.map((t) => t.points[k]!);
          for (let i = 0; i < points.length; i += 1) {
            // An inbounder holding the ball may stand on the line.
            const inbounding = c.ball[k]!.holderId === c.tracks[i]!.playerId;
            const lower = inbounding ? -1e-9 : 0;
            const upper = inbounding ? 1 + 1e-9 : 1;
            expect(points[i]!.x).toBeGreaterThanOrEqual(lower);
            expect(points[i]!.x).toBeLessThanOrEqual(upper);
            expect(points[i]!.y).toBeGreaterThanOrEqual(lower);
            expect(points[i]!.y).toBeLessThanOrEqual(upper);
            if (!inbounding) {
              expect(points[i]!.x).toBeGreaterThan(0);
              expect(points[i]!.x).toBeLessThan(1);
              expect(points[i]!.y).toBeGreaterThan(0);
              expect(points[i]!.y).toBeLessThan(1);
            }
            for (let j = i + 1; j < points.length; j += 1) {
              expect(
                feetBetween(points[i]!, points[j]!),
              ).toBeGreaterThanOrEqual(CHOREO_MIN_SPACING_FEET - 1e-6);
            }
          }
        }
      }
    });

    it("brings the ball up the floor on a possession at the other end", () => {
      let checked = 0;
      for (const c of played) {
        const transition = frames[c.index + 1]!.transition;
        if (!transition) {
          continue;
        }
        // Every transition waypoint after the first is a beat.
        const atBeats = c.ball.map((b) => b.at);
        for (const point of transition.slice(1)) {
          expect(atBeats.some((at) => feetBetween(at, point) < 0.01)).toBe(
            true,
          );
        }
        checked += 1;
      }
      expect(checked).toBeGreaterThan(100);
    });

    it("inbounds to the handler after a make, from a teammate", () => {
      let checked = 0;
      for (const c of played) {
        const transition = frames[c.index + 1]!.transition;
        if (!transition || transition.length < 4) {
          continue;
        }
        const inbound = transition[1]!;
        const k = c.ball.findIndex(
          (ball) =>
            ball.holderId !== null && feetBetween(ball.at, inbound) < 0.01,
        );
        expect(k).toBeGreaterThan(0);
        expect(c.legs[k]).toBe("pass");
        const handler = c.ball[k + 1]!.holderId;
        expect(handler).not.toBe(c.ball[k]!.holderId);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(20);
    });

    it("gets the defense back toward the rim ahead of the offense", () => {
      let defenseAhead = 0;
      let checked = 0;
      for (const c of played) {
        const to = frames[c.index + 1]!;
        if (!to.transition) {
          continue;
        }
        // The beat nearest the middle of the bring-up.
        const k = c.beats.findIndex((t) => t > 0.15);
        const hoop = toFullCourt(COURT_RIM, to.attackingEnd);
        const mean = (onOffense: boolean) => {
          const ids = to.players
            .filter((p) => p.onOffense === onOffense)
            .map((p) => p.playerId);
          const d = c.tracks
            .filter((t) => ids.includes(t.playerId))
            .map((t) => Math.abs(t.points[k]!.x - hoop.x));
          return d.reduce((x, y) => x + y, 0) / d.length;
        };
        checked += 1;
        if (mean(false) < mean(true)) {
          defenseAhead += 1;
        }
      }
      expect(checked).toBeGreaterThan(100);
      expect(defenseAhead / checked).toBeGreaterThan(0.9);
    });

    it("is deterministic", () => {
      const again = plays.map((_, i) => buildPlayChoreography(view, i));
      expect(again).toEqual(choreos);
    });
  },
);

/** Choreography the way the client runs it. */
function runChoreo(view: WatchGameView, index: number) {
  return buildPlayChoreography(view, index, {
    openerShare: openerShare(view, index),
    tipShare: tipShare(view, index),
  })!;
}

const onSideline = (y: number) => Math.abs(y) < 1e-6 || Math.abs(y - 1) < 1e-6;

describe("tip-off choreography", () => {
  const view = fixtureView("game_tip", RESTART_PLAYS);
  const c = runChoreo(view, 0);
  const from = buildFullCourtFrame(view, 0);

  it("sends the ball up at centre, tips it to the possession team and brings it up", () => {
    expect(c.ball[0]!.at).toEqual({ x: 0.5, y: 0.5 });
    expect(c.ball[0]!.holderId).toBeNull();
    const up = c.ball.findIndex((b) => b.lift > 0 && b.holderId === null);
    expect(up).toBeGreaterThan(0);
    expect(c.ball[up]!.at).toEqual({ x: 0.5, y: 0.5 });
    const caught = c.ball.findIndex((b) => b.holderId !== null);
    expect(caught).toBeGreaterThan(up);
    // Home has the first possession, and the tip never goes to a jumper.
    const side = c.tracks.find(
      (t) => t.playerId === c.ball[caught]!.holderId,
    )!.side;
    expect(side).toBe(0);
    expect(c.ball[caught]!.holderId).not.toBe("h5");
    // The tip happens before the bring-up reaches the set-up.
    expect(c.beats[caught]!).toBeLessThanOrEqual(tipShare(view, 0) + 1e-9);
    expect(c.beats[caught]!).toBeLessThan(openerShare(view, 0));
  });

  it("holds everyone on the ring until the tip is done", () => {
    for (const track of c.tracks) {
      c.beats.forEach((t, k) => {
        if (
          t <= tipShare(view, 0) + 1e-9 &&
          track.playerId !== c.ball[k]!.holderId
        ) {
          expect(
            feetBetween(
              track.points[k]!,
              from.players.find((p) => p.playerId === track.playerId)!.spot,
            ),
          ).toBeLessThan(0.01);
        }
      });
    }
  });

  it("is deterministic", () => {
    expect(runChoreo(view, 0)).toEqual(c);
  });
});

describe("a foul on the opening play", () => {
  const foul = fixtureView("game_tip_foul", [
    {
      poss: 1,
      kind: "personal_foul",
      side: 1,
      playerId: "a2",
      player2Id: "h1",
    },
  ]);
  const shot = fixtureView("game_tip_shot", [
    { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
  ]);

  it("blows the whistle right after the tip, earlier than a shot lands", () => {
    const whistle = runChoreo(foul, 0);
    const landed = runChoreo(shot, 0);
    const whistleMs = whistle.eventAt * motionMs(foul, 1);
    expect(whistleMs).toBeGreaterThan(TIP_MS);
    expect(whistleMs).toBeLessThan(
      TIP_MS + WHISTLE_TRANSITION_MS + PLAY_PACING_MS.personal_foul,
    );
    expect(whistleMs).toBeLessThan(landed.eventAt * motionMs(shot, 1));
    expect(whistle.deadBall).toBe(true);
    const k = whistle.beats.indexOf(whistle.eventAt);
    for (const track of whistle.tracks) {
      for (let j = k; j < whistle.beats.length; j += 1) {
        expect(track.points[j]).toEqual(track.points.at(-1));
      }
    }
  });
});

describe("inbound choreography", () => {
  const view = fixtureView("game_inbounds", RESTART_PLAYS);
  const frames = Array.from({ length: RESTART_PLAYS.length + 1 }, (_, n) =>
    buildFullCourtFrame(view, n),
  );

  /** The first beat where a held ball sits at `spot`. */
  function inboundBeat(c: PlayChoreography, spot: { x: number; y: number }) {
    return c.ball.findIndex(
      (b) => b.holderId !== null && feetBetween(b.at, spot) < 0.01,
    );
  }

  it.each([
    ["an out-of-bounds turnover (new end)", 2, 3],
    ["a personal foul (same end)", 7, 8],
    ["an offensive foul (new end)", 9, 10],
  ])("inbounds from the sideline after %s", (_name, index, n) => {
    const restart = frames[n]!.restart!;
    expect(restart.kind).toBe("sideline");
    const c = runChoreo(view, index);
    const k = inboundBeat(c, restart.at);
    expect(k).toBeGreaterThan(0);
    expect(onSideline(c.ball[k]!.at.y)).toBe(true);
    // The inbounder passes in to the handler, a teammate, before the action.
    expect(c.legs[k]).toBe("pass");
    const handler = c.ball[k + 1]!.holderId;
    expect(handler).not.toBe(c.ball[k]!.holderId);
    const sideOf = new Map(c.tracks.map((t) => [t.playerId, t.side]));
    expect(sideOf.get(handler!)).toBe(sideOf.get(c.ball[k]!.holderId!));
    expect(c.beats[k]!).toBeLessThan(openerShare(view, index));
    // Nobody leaves the floor but the inbounder.
    for (const track of c.tracks) {
      track.points.forEach((point, j) => {
        if (c.ball[j]!.holderId !== track.playerId) {
          expect(point.y).toBeGreaterThan(0);
          expect(point.y).toBeLessThan(1);
        }
      });
    }
  });

  it("does not inbound after a steal or a defensive rebound", () => {
    for (const index of [4, 5]) {
      const c = runChoreo(view, index);
      expect(frames[index + 1]!.restart).toBeNull();
      for (const ball of c.ball) {
        expect(onSideline(ball.at.y)).toBe(false);
      }
    }
  });

  it("inbounds from the baseline at the start of a period", () => {
    const c = runChoreo(view, 10);
    const restart = frames[11]!.restart!;
    expect(restart.kind).toBe("baseline");
    const k = inboundBeat(c, restart.at);
    expect(k).toBeGreaterThan(0);
    expect(c.ball[k]!.at.x).toBeLessThan(0.02);
    expect(c.legs[k]).toBe("pass");
  });
});

describe("free throw choreography", () => {
  const view = fixtureView("game_ft_choreo", [
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

  it("gets everyone onto the lane spots before the shot", () => {
    const c = runChoreo(view, 1);
    const to = buildFullCourtFrame(view, 2);
    const set = c.beats.findIndex((t) => t >= 0.45);
    expect(set).toBeGreaterThan(0);
    expect(c.beats[set]!).toBeLessThan(c.eventAt);
    for (const player of to.players) {
      const points = c.tracks.find(
        (t) => t.playerId === player.playerId,
      )!.points;
      for (let k = set; k < points.length; k += 1) {
        expect(points[k]).toEqual(player.spot);
      }
    }
    // Between two free throws nobody has to move.
    const second = runChoreo(view, 2);
    for (const track of second.tracks) {
      expect(track.points[0]).toEqual(track.points.at(-1));
    }
  });
});

describe("and-one choreography", () => {
  const view = fixtureView("game_and_one", [
    { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
    {
      poss: 1,
      kind: "shooting_foul",
      side: 1,
      playerId: "a2",
      player2Id: "h1",
    },
    { poss: 1, kind: "ft_made", side: 0, playerId: "h1", points: 1 },
  ]);
  const plain = fixtureView("game_plain_foul", [
    { poss: 1, kind: "two_missed", side: 0, playerId: "h1" },
    {
      poss: 1,
      kind: "shooting_foul",
      side: 1,
      playerId: "a2",
      player2Id: "h1",
    },
  ]);

  it("whistles quickly beside the shooter and freezes everyone", () => {
    const c = runChoreo(view, 1);
    expect(c.eventAt).toBeLessThan(runChoreo(plain, 1).eventAt);
    expect(c.beats).toContain(c.eventAt);
    const k = c.beats.indexOf(c.eventAt);
    for (const track of c.tracks) {
      for (let j = k; j < c.beats.length; j += 1) {
        expect(track.points[j]).toEqual(track.points.at(-1));
      }
    }
    // The shooter stays where he shot and the fouler stands beside him.
    const shooter = c.tracks.find((t) => t.playerId === "h1")!.points;
    const fouler = c.tracks.find((t) => t.playerId === "a2")!.points;
    expect(shooter[0]).toEqual(shooter.at(-1));
    expect(feetBetween(shooter.at(-1)!, fouler.at(-1)!)).toBeLessThan(4.5);
    // No new action: the ball stays on the floor where the shot ended.
    expect(c.ball.every((b) => b.holderId === null)).toBe(true);
    expect(c.ball.at(-1)!.at).toEqual(c.ball[0]!.at);
  });
});

describe("substitution run choreography", () => {
  const view = fixtureView(
    "game_sub_run",
    [
      { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
      { poss: 2, kind: "two_missed", side: 1, playerId: "a1" },
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
        side: 1,
        playerId: "a3",
        player2Id: "a6",
      },
      {
        poss: 2,
        kind: "substitution",
        side: 0,
        playerId: "h2",
        player2Id: "h7",
      },
      { poss: 2, kind: "defensive_rebound", side: 0, playerId: "h3" },
    ],
    { bench: 2 },
  );
  const from = buildFullCourtFrame(view, 2);
  const to = buildFullCourtFrame(view, 5);
  const c = buildPlayChoreography(view, 4)!;

  it("runs the whole run from its first frame to the frame after its last", () => {
    expect(c.index).toBe(2);
    expect(buildPlayChoreography(view, 2)!.tracks).toEqual(c.tracks);
    expect(buildPlayChoreography(view, 3)!.tracks).toEqual(c.tracks);
    // Playback that began inside the run starts from there.
    const inside = buildPlayChoreography(view, 4, { subFrom: 4 })!;
    const h2 = inside.tracks.find((t) => t.playerId === "h2")!.points;
    expect(h2[0]).toEqual(buildFullCourtFrame(view, 4).players[1]!.spot);
    expect(h2.at(-1)).toEqual(
      buildFullCourtFrame(view, 5).bench.find((b) => b.playerId === "h2")!.spot,
    );
    const h1 = inside.tracks.find((t) => t.playerId === "h1")!.points;
    expect(h1[0]).toEqual(h1.at(-1));
  });

  it("walks incoming players from their seat to the floor and outgoing ones back", () => {
    const pick = (id: string) =>
      c.tracks.find((t) => t.playerId === (id as PlayerId))!.points;
    const seat = (frame: typeof from, id: string) =>
      frame.bench.find((b) => b.playerId === id)!.spot;
    const spot = (frame: typeof from, id: string) =>
      frame.players.find((p) => p.playerId === id)!.spot;
    for (const [out, inn] of [
      ["h1", "h6"],
      ["a3", "a6"],
      ["h2", "h7"],
    ] as const) {
      expect(pick(inn)[0]).toEqual(seat(from, inn));
      expect(pick(inn).at(-1)).toEqual(spot(to, inn));
      expect(pick(inn).at(-1)).toEqual(spot(from, out));
      expect(pick(out)[0]).toEqual(spot(from, out));
      expect(pick(out).at(-1)).toEqual(seat(to, out));
      expect(seat(to, out).y).toBeLessThan(0);
    }
  });

  it("holds everyone else still, and the ball", () => {
    const moving = new Set(["h1", "h6", "a3", "a6", "h2", "h7"]);
    expect(c.tracks).toHaveLength(14);
    for (const track of c.tracks) {
      if (!moving.has(track.playerId as string)) {
        expect(new Set(track.points.map((p) => JSON.stringify(p))).size).toBe(
          1,
        );
      }
    }
    expect(c.deadBall).toBe(true);
    expect(c.legs).toEqual(["loose", "loose", "loose"]);
    expect(new Set(c.ball.map((b) => JSON.stringify(b.at))).size).toBe(1);
    expect(c.beats).toContain(c.eventAt);
  });

  it("has everyone on the floor on his end spot, above the bench, at the event", () => {
    // The floor spacing is the frames' own: nobody is nudged to make room.
    const k = c.beats.indexOf(c.eventAt);
    for (const player of to.players) {
      const point = c.tracks.find((t) => t.playerId === player.playerId)!
        .points[k]!;
      expect(point).toEqual(player.spot);
      expect(point.y).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    expect(buildPlayChoreography(view, 4)).toEqual(c);
  });
});

describe("block choreography", () => {
  /** Home scores, then two blocked misses (a1 by h2, h4 by a2), each rebounded. */
  const blockPlays: FixturePlay[] = [
    { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
    { poss: 2, kind: "two_missed", side: 1, playerId: "a1", player2Id: "h2" },
    { poss: 2, kind: "defensive_rebound", side: 0, playerId: "h3" },
    { poss: 3, kind: "three_missed", side: 0, playerId: "h4", player2Id: "a2" },
    { poss: 3, kind: "defensive_rebound", side: 1, playerId: "a3" },
  ];
  const games = Array.from({ length: 40 }, (_, i) => `game_block_${i}`);
  const blocks = [1, 3];

  function setup(gameId: string, index: number) {
    const view = fixtureView(gameId, blockPlays);
    const c = runChoreo(view, index);
    const to = buildFullCourtFrame(view, index + 1);
    const play = view.plays[index]!;
    const shooter = to.players.find((p) => p.playerId === play.playerId)!;
    const rim = toFullCourt(COURT_RIM, to.attackingEnd);
    const release = releaseBeat(c);
    return { view, c, to, play, shooter, rim, release };
  }

  it("swats the ball away from the rim, 6 to 14 ft from the shot, in bounds", () => {
    for (const gameId of games) {
      for (const index of blocks) {
        const { c, to, shooter, rim } = setup(gameId, index);
        const rest = c.ball.at(-1)!.at;
        expect(rest).toEqual(to.ball.at);
        expect(feetBetween(rest, rim)).toBeGreaterThan(
          feetBetween(shooter.spot, rim),
        );
        const travel = feetBetween(rest, shooter.spot);
        expect(travel).toBeGreaterThanOrEqual(6 - 1e-6);
        expect(travel).toBeLessThanOrEqual(14 + 1e-6);
        expect(rest.x).toBeGreaterThan(0);
        expect(rest.x).toBeLessThan(1);
        expect(rest.y).toBeGreaterThan(0);
        expect(rest.y).toBeLessThan(1);
      }
    }
  });

  it("leaves the blocker between the shooter and the rim, close to the shooter", () => {
    for (const gameId of games) {
      for (const index of blocks) {
        const { to, play, shooter, rim } = setup(gameId, index);
        const blocker = to.players.find((p) => p.playerId === play.player2Id)!;
        expect(feetBetween(blocker.spot, shooter.spot)).toBeLessThanOrEqual(
          3.6,
        );
        expect(feetBetween(blocker.spot, rim)).toBeLessThan(
          feetBetween(shooter.spot, rim),
        );
      }
    }
  });

  it("cuts the shot off at contact before the rim beat, then goes loose to the swat", () => {
    for (const gameId of games) {
      for (const index of blocks) {
        const { c, shooter, rim, release } = setup(gameId, index);
        expect(c.legs.slice(release, release + 2)).toEqual(["shot", "loose"]);
        expect(c.legs.filter((leg) => leg === "shot")).toHaveLength(1);
        const contactAt = c.beats[release + 1]!;
        const swatAt = c.beats[release + 2]!;
        expect(c.eventAt).toBe(contactAt);
        expect(contactAt).toBeGreaterThan(c.beats[release]!);
        expect(contactAt).toBeLessThan(swatAt);
        expect(swatAt).toBeLessThan(1);
        const contact = c.ball[release + 1]!;
        expect(contact.holderId).toBeNull();
        expect(contact.lift).toBeGreaterThan(0);
        expect(contact.lift).toBeLessThan(1);
        // In front of the shooter, toward the rim.
        const gap = feetBetween(contact.at, shooter.spot);
        // About 3 ft out, or most of the way to the rim from close in.
        const reach = feetBetween(shooter.spot, rim);
        expect(gap).toBeCloseTo(Math.min(3.1, 0.9 * reach), 1);
        expect(feetBetween(contact.at, rim)).toBeLessThan(
          feetBetween(shooter.spot, rim),
        );
      }
    }
  });

  it("has the blocker reach the contact point exactly at the event", () => {
    for (const gameId of games) {
      for (const index of blocks) {
        const { c, play, release } = setup(gameId, index);
        const k = release + 1;
        expect(c.beats[k]).toBe(c.eventAt);
        const track = trackOf(c, play.player2Id!);
        expect(feetBetween(track[k]!, c.ball[k]!.at)).toBeLessThan(0.01);
        // He closes out: he starts somewhere else.
        expect(feetBetween(track[0]!, c.ball[k]!.at)).toBeGreaterThan(0);
      }
    }
  });

  it("keeps tokens 3 ft apart at the inner beats and ends on the frames", () => {
    for (const gameId of games) {
      for (const index of blocks) {
        const { view, c } = setup(gameId, index);
        const from = buildFullCourtFrame(view, index);
        const to = buildFullCourtFrame(view, index + 1);
        for (const player of to.players) {
          const points = trackOf(c, player.playerId);
          expect(points[0]).toEqual(
            from.players.find((p) => p.playerId === player.playerId)!.spot,
          );
          expect(points.at(-1)).toEqual(player.spot);
        }
        for (let k = 1; k < c.beats.length - 1; k += 1) {
          const points = c.tracks.map((t) => t.points[k]!);
          for (let i = 0; i < points.length; i += 1) {
            for (let j = i + 1; j < points.length; j += 1) {
              expect(
                feetBetween(points[i]!, points[j]!),
              ).toBeGreaterThanOrEqual(CHOREO_MIN_SPACING_FEET - 1e-6);
            }
          }
        }
      }
    }
  });

  it("lets the rebounder pick the ball up where it was swatted", () => {
    for (const gameId of games) {
      for (const index of blocks) {
        const view = fixtureView(gameId, blockPlays);
        const swat = buildFullCourtFrame(view, index + 1).ball.at;
        const rebound = runChoreo(view, index + 1);
        const after = buildFullCourtFrame(view, index + 2);
        expect(rebound.ball[0]!.at).toEqual(swat);
        expect(rebound.ball.at(-1)!.holderId).toBe(
          view.plays[index + 1]!.playerId,
        );
        expect(feetBetween(after.ball.at, swat)).toBeLessThan(0.01);
      }
    }
  });

  it("is deterministic", () => {
    const view = fixtureView("game_block_0", blockPlays);
    expect(runChoreo(view, 1)).toEqual(runChoreo(view, 1));
  });
});

describe("steal choreography", () => {
  const view = fixtureView("game_steal", RESTART_PLAYS);
  // Play 4: a3 turns it over, h3 steals.
  const c = runChoreo(view, 4);
  const to = buildFullCourtFrame(view, 5);

  it("passes from the handler and has it picked off at the stealer's spot", () => {
    const k = c.legs.indexOf("steal");
    expect(k).toBeGreaterThan(0);
    expect(c.legs.filter((leg) => leg === "steal")).toHaveLength(1);
    expect(c.ball[k]!.holderId).toBe("a3");
    expect(c.ball[k + 1]!.holderId).toBe("h3");
    const stealer = to.players.find((p) => p.playerId === "h3")!;
    expect(feetBetween(c.ball[k + 1]!.at, stealer.spot)).toBeLessThan(0.01);
    expect(c.ball.at(-1)!.at).toEqual(to.ball.at);
    expect(c.legs.at(-1)).not.toBe("steal");
  });

  it("has the stealer on the interception point at the event", () => {
    const k = c.legs.indexOf("steal") + 1;
    expect(c.beats[k]).toBe(c.eventAt);
    const stealer = to.players.find((p) => p.playerId === "h3")!;
    const track = trackOf(c, "h3" as PlayerId);
    expect(feetBetween(track[k]!, stealer.spot)).toBeLessThan(0.01);
    // He was somewhere else before that.
    expect(feetBetween(track[k - 1]!, stealer.spot)).toBeGreaterThan(0);
  });

  it("stands the stealer on the lane between the handler and the intended receiver", () => {
    const receiverId = to.lastPlay!.receiverId!;
    expect(receiverId).toBeDefined();
    const receiver = to.players.find((p) => p.playerId === receiverId)!;
    const handler = to.players.find((p) => p.playerId === "a3")!;
    const stealer = to.players.find((p) => p.playerId === "h3")!;
    // A teammate of the handler.
    expect(receiver.side).toBe(handler.side);
    expect(receiverId).not.toBe("a3");
    // Distance from the stealer to the handler -> receiver segment.
    const px = (stealer.spot.x - handler.spot.x) * 94;
    const py = (stealer.spot.y - handler.spot.y) * 50;
    const dx = (receiver.spot.x - handler.spot.x) * 94;
    const dy = (receiver.spot.y - handler.spot.y) * 50;
    const t = Math.min(
      1,
      Math.max(0, (px * dx + py * dy) / (dx * dx + dy * dy)),
    );
    // The receiver drifts a little after the steal, hence the tolerance.
    expect(Math.hypot(px - t * dx, py - t * dy)).toBeLessThan(2);
    expect(t).toBeGreaterThan(0.3);
    expect(t).toBeLessThan(0.8);
  });

  it("drifts the receiver toward the pass and stops", () => {
    const receiverId = to.lastPlay!.receiverId!;
    const k = c.legs.indexOf("steal") + 1;
    const stealer = to.players.find((p) => p.playerId === "h3")!;
    const points = trackOf(c, receiverId);
    expect(feetBetween(points[k]!, stealer.spot)).toBeLessThan(
      feetBetween(points[0]!, stealer.spot),
    );
  });

  it("does not stage a pass-off for a turnover with no stealer", () => {
    const oob = runChoreo(view, 1);
    expect(oob.legs).not.toContain("steal");
    expect(buildFullCourtFrame(view, 2).lastPlay!.receiverId).toBeUndefined();
  });

  it("is deterministic", () => {
    expect(runChoreo(view, 4)).toEqual(c);
  });
});

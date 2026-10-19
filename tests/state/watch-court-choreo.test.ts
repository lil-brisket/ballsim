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
import { buildFullCourtFrame } from "@/state/watch-full-court";
import { toWatchGameView } from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

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
  return c.legs.lastIndexOf("shot");
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
    const played = choreos.flatMap((c) => (c ? [c] : []));

    it("is null for substitutions and outside the log, present otherwise", () => {
      plays.forEach((play, i) => {
        expect(choreos[i] === null).toBe(play.kind === "substitution");
      });
      expect(buildPlayChoreography(view, -1)).toBeNull();
      expect(buildPlayChoreography(view, plays.length)).toBeNull();
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
        expect(release).toBe(c.beats.length - 2);
        expect(c.ball[release]!.holderId).toBe(play.playerId);
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
        for (let k = 1; k < c.beats.length - 1; k += 1) {
          const points = c.tracks.map((t) => t.points[k]!);
          for (let i = 0; i < points.length; i += 1) {
            expect(points[i]!.x).toBeGreaterThan(0);
            expect(points[i]!.x).toBeLessThan(1);
            expect(points[i]!.y).toBeGreaterThan(0);
            expect(points[i]!.y).toBeLessThan(1);
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

    it("is deterministic", () => {
      const again = plays.map((_, i) => buildPlayChoreography(view, i));
      expect(again).toEqual(choreos);
    });
  },
);

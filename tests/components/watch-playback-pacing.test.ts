import { describe, expect, it } from "vitest";
import {
  DEAD_BALL_MS,
  PERIOD_BREAK_MAX_SPEEDUP,
  PERIOD_BREAK_MS,
  PLAY_PACING_MS,
  SUB_RUN_MS,
  TIP_MS,
  TIP_OFF_MS,
  TRANSITION_MS,
  WHISTLE_TRANSITION_MS,
  actionMs,
  motionMs,
  openerShare,
  playDelayMs,
  revealAfter,
  tipShare,
} from "@/components/game/watch/playback-pacing";
import { fieldGoalActionMs } from "@/state/watch-court-choreo";
import { RESTART_PLAYS, fixtureView } from "../helpers/watch-view";

describe("watch playback pacing", () => {
  const view = fixtureView("game_pacing", RESTART_PLAYS);

  it("waits TIP_OFF_MS before the first play and has no motion at tip-off", () => {
    expect(playDelayMs(view, 0)).toBe(TIP_OFF_MS);
    expect(motionMs(view, 0)).toBe(0);
  });

  it("adds the jump ball and the trip up the floor to play 0", () => {
    expect(motionMs(view, 1)).toBe(actionMs(view, 0) + TIP_MS + TRANSITION_MS);
    const opening = TIP_MS + TRANSITION_MS;
    expect(openerShare(view, 0)).toBeCloseTo(
      opening / (opening + actionMs(view, 0)),
    );
    expect(tipShare(view, 0)).toBeCloseTo(
      TIP_MS / (opening + actionMs(view, 0)),
    );
    expect(tipShare(view, 1)).toBe(0);
  });

  it("shortens the bring-up when play 0 is a foul", () => {
    const foul = fixtureView("game_pacing_foul", [
      { poss: 1, kind: "personal_foul", side: 1, playerId: "a2" },
    ]);
    expect(motionMs(foul, 1)).toBe(
      PLAY_PACING_MS.personal_foul + TIP_MS + WHISTLE_TRANSITION_MS,
    );
  });

  it("adds DEAD_BALL_MS to a sideline inbound at the same end", () => {
    // Play 7 follows a personal foul and keeps the ball at the same end.
    expect(motionMs(view, 8)).toBe(actionMs(view, 7) + DEAD_BALL_MS);
    expect(openerShare(view, 7)).toBeCloseTo(
      DEAD_BALL_MS / (DEAD_BALL_MS + actionMs(view, 7)),
    );
    expect(playDelayMs(view, 8)).toBe(motionMs(view, 8));
  });

  it("covers a sideline inbound at a new end with the trip up the floor", () => {
    // Plays 2 and 9 follow a dead ball and move to the other end.
    expect(motionMs(view, 3)).toBe(actionMs(view, 2) + TRANSITION_MS);
    expect(motionMs(view, 10)).toBe(actionMs(view, 9) + TRANSITION_MS);
  });

  it("adds nothing mid-possession, after a make's inbound, or beyond the outlet", () => {
    // Play 3 is the rebound inside play 2's possession.
    expect(motionMs(view, 4)).toBe(PLAY_PACING_MS.defensive_rebound);
    expect(openerShare(view, 3)).toBe(0);
    // Play 4 and play 5 open live at the other end: the usual trip, no more.
    expect(motionMs(view, 5)).toBe(PLAY_PACING_MS.turnover + TRANSITION_MS);
    expect(motionMs(view, 6)).toBe(actionMs(view, 5) + TRANSITION_MS);
  });

  it("brings the ball up for a new period and keeps the period break out of the motion", () => {
    expect(motionMs(view, 11)).toBe(actionMs(view, 10) + TRANSITION_MS);
    // Play 9 ends Q1: its delay includes the break, its motion does not.
    expect(playDelayMs(view, 10)).toBe(motionMs(view, 10) + PERIOD_BREAK_MS);
  });
});

describe("watch playback pacing of substitution runs", () => {
  const sub = (playerId: string, player2Id: string) =>
    ({
      poss: 2,
      kind: "substitution",
      side: 0,
      playerId,
      player2Id,
    }) as const;
  const run = fixtureView(
    "game_pacing_subs",
    [
      { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
      sub("h1", "h6"),
      sub("h2", "h7"),
      sub("h3", "h8"),
      { period: 2, poss: 3, kind: "two_missed", side: 1, playerId: "a1" },
    ],
    { bench: 3 },
  );
  const single = fixtureView(
    "game_pacing_one_sub",
    [
      { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2 },
      sub("h1", "h6"),
      { poss: 3, kind: "two_missed", side: 1, playerId: "a1" },
    ],
    { bench: 1 },
  );

  it("reveals a whole run in one step, and other plays one at a time", () => {
    expect(revealAfter(run, 0)).toBe(1);
    expect(revealAfter(run, 1)).toBe(4);
    // Starting inside a run (after manual stepping) still ends at its end.
    expect(revealAfter(run, 2)).toBe(4);
    expect(revealAfter(run, 4)).toBe(5);
    expect(revealAfter(run, 5)).toBe(5);
  });

  it("spends SUB_RUN_MS on a run, however many substitutions it has", () => {
    expect(motionMs(run, 4)).toBe(SUB_RUN_MS);
    expect(motionMs(single, 2)).toBe(SUB_RUN_MS);
    // Reached by manual stepping, a substitution mid-run is a short step.
    expect(motionMs(run, 2)).toBe(PLAY_PACING_MS.substitution);
  });

  it("waits what the timer shows: the run's motion, plus a period break", () => {
    // Revealing play 0 shows its own pacing, then the run goes up in one step.
    expect(playDelayMs(run, 1)).toBe(motionMs(run, 1));
    expect(revealAfter(run, 1)).toBe(4);
    expect(playDelayMs(run, 4)).toBe(SUB_RUN_MS + PERIOD_BREAK_MS);
    expect(playDelayMs(single, 2)).toBe(SUB_RUN_MS);
  });

  it("gives a field goal one pass window per planned pass", () => {
    const view = fixtureView("game_pacing", RESTART_PLAYS);
    for (let i = 0; i < view.plays.length; i += 1) {
      const play = view.plays[i]!;
      if (!/^(two|three)_/.test(play.kind)) {
        continue;
      }
      expect(actionMs(view, i)).toBe(fieldGoalActionMs(view, i));
      expect(actionMs(view, i)).toBeGreaterThanOrEqual(
        PLAY_PACING_MS[play.kind],
      );
    }
  });

  it("keeps the period break readable at 4x and 8x", () => {
    const view = fixtureView("game_pacing", RESTART_PLAYS);
    // Play 9 ends Q1.
    const motion = motionMs(view, 10);
    expect(playDelayMs(view, 10, 2) / 2).toBe(motion / 2 + PERIOD_BREAK_MS / 2);
    for (const speed of [4, 8]) {
      expect(playDelayMs(view, 10, speed) / speed).toBeCloseTo(
        motion / speed + PERIOD_BREAK_MS / PERIOD_BREAK_MAX_SPEEDUP,
      );
    }
    // Mid-period plays are unaffected by speed.
    expect(playDelayMs(view, 4, 8)).toBe(playDelayMs(view, 4));
  });
});

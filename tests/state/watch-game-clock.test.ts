import { describe, expect, it } from "vitest";
import { clockAt } from "@/state/watch-game-clock";
import { formatGameClock } from "@/state/watch-game-selectors";
import type { WatchGameView } from "@/state/watch-game-view";
import { fixtureView, type FixturePlay } from "../helpers/watch-view";

/**
 * Q1: poss 1 (one play, 720), poss 2 (miss + rebound, 700), a substitution,
 * poss 3 (one play, 650). Q2: poss 4 (720) and poss 5 (600, last of the game).
 */
const PLAYS: Array<FixturePlay & { clock: number }> = [
  { poss: 1, kind: "two_made", side: 0, playerId: "h1", points: 2, clock: 720 },
  { poss: 2, kind: "two_missed", side: 1, playerId: "a1", clock: 700 },
  { poss: 2, kind: "defensive_rebound", side: 0, playerId: "h2", clock: 700 },
  {
    poss: 2,
    kind: "substitution",
    side: 0,
    playerId: "h3",
    player2Id: "h4",
    clock: 690,
  },
  { poss: 3, kind: "two_made", side: 0, playerId: "h1", points: 2, clock: 650 },
  {
    period: 2,
    poss: 4,
    kind: "two_made",
    side: 1,
    playerId: "a1",
    points: 2,
    clock: 720,
  },
  { period: 2, poss: 5, kind: "turnover", side: 0, playerId: "h1", clock: 600 },
];

function build(plays = PLAYS): WatchGameView {
  const view = fixtureView("game_clock", plays);
  return {
    ...view,
    plays: view.plays.map((play, i) => ({
      ...play,
      clock: plays[i]!.clock,
      clockLabel: formatGameClock(plays[i]!.clock),
    })),
  };
}

const view = build();

describe("clockAt", () => {
  it("does not run at tip-off, past the log or on substitutions", () => {
    expect(clockAt(view, 0, 0)).toBeNull();
    expect(clockAt(view, 99, 0.5)).toBeNull();
    expect(clockAt(view, 4, 0.5)).toBeNull();
  });

  it("runs from the possession's clock to the next possession's clock", () => {
    expect(clockAt(view, 1, 0)).toBe(720);
    expect(clockAt(view, 1, 0.5)).toBe(710);
    expect(clockAt(view, 1, 1)).toBe(700);
  });

  it("splits a possession between its plays, across a substitution", () => {
    // Poss 2: 700 -> 650 over its miss and rebound, which the sub sits between.
    expect(clockAt(view, 2, 0)).toBe(700);
    expect(clockAt(view, 2, 1)).toBe(675);
    expect(clockAt(view, 3, 0)).toBe(675);
    expect(clockAt(view, 3, 1)).toBe(650);
  });

  it("runs the last possession of a period down to 0:00", () => {
    expect(clockAt(view, 5, 0)).toBe(650);
    expect(clockAt(view, 5, 1)).toBe(0);
  });

  it("runs the last possession of the game down to 0:00", () => {
    expect(clockAt(view, 7, 0)).toBe(600);
    expect(clockAt(view, 7, 1)).toBe(0);
  });

  it("clamps the fraction", () => {
    expect(clockAt(view, 1, -3)).toBe(720);
    expect(clockAt(view, 1, 9)).toBe(700);
  });

  it("never rises over a period, stays within the possession's span and ends each possession on the next one's clock", () => {
    const sequence: number[] = [];
    let period = 1;
    for (let revealed = 1; revealed <= view.plays.length; revealed += 1) {
      const play = view.plays[revealed - 1]!;
      if (play.kind === "substitution") {
        continue;
      }
      if (play.period !== period) {
        period = play.period;
        sequence.length = 0;
      }
      for (let step = 0; step <= 20; step += 1) {
        const seconds = clockAt(view, revealed, step / 20)!;
        expect(seconds).toBeLessThanOrEqual(play.clock);
        expect(seconds).toBeGreaterThanOrEqual(0);
        sequence.push(seconds);
      }
      for (let i = 1; i < sequence.length; i += 1) {
        expect(sequence[i]!).toBeLessThanOrEqual(sequence[i - 1]!);
      }
    }
  });

  it("never drops below the next possession's clock", () => {
    for (const [revealed, nextClock] of [
      [1, 700],
      [3, 650],
      [6, 600],
    ] as const) {
      for (let step = 0; step <= 10; step += 1) {
        expect(clockAt(view, revealed, step / 10)!).toBeGreaterThanOrEqual(
          nextClock,
        );
      }
    }
  });

  it("never runs backwards if the log's next clock is later", () => {
    const odd = build([
      { poss: 1, kind: "two_made", side: 0, playerId: "h1", clock: 500 },
      { poss: 2, kind: "two_made", side: 1, playerId: "a1", clock: 540 },
    ]);
    expect(clockAt(odd, 1, 0)).toBe(500);
    expect(clockAt(odd, 1, 1)).toBe(500);
  });
});

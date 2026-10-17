import { describe, expect, it } from "vitest";
import type { PlayerId } from "@/domain/ids";
import { RUN_THRESHOLD, currentRun } from "@/state/watch-game-selectors";
import type {
  WatchGameView,
  WatchPlay,
  WatchSide,
} from "@/state/watch-game-view";

function play(index: number, side: WatchSide, points: number): WatchPlay {
  return {
    index,
    period: 1,
    periodLabel: "Q1",
    clock: 600,
    clockLabel: "",
    poss: index,
    kind:
      points === 0 ? "two_missed" : points === 3 ? "three_made" : "two_made",
    side,
    playerId: "p" as PlayerId,
    player2Id: null,
    text: "",
    points,
    homeScore: 0,
    awayScore: 0,
    highlights: [],
  };
}

function view(plays: Array<[WatchSide, number]>): WatchGameView {
  return {
    plays: plays.map(([side, points], i) => play(i, side, points)),
  } as unknown as WatchGameView;
}

describe("currentRun", () => {
  it("reports an unanswered run once it reaches the threshold", () => {
    const v = view([
      [0, 2],
      [1, 3],
      [1, 0],
      [1, 2],
      [1, 3],
    ]);
    expect(RUN_THRESHOLD).toBe(8);
    expect(currentRun(v, 4)).toBeNull(); // away 5-0
    expect(currentRun(v, 5)).toEqual({ side: 1, points: 8 });
  });

  it("ends the run when the other side scores, ignoring misses", () => {
    const v = view([
      [0, 3],
      [0, 3],
      [1, 0],
      [0, 2],
      [1, 2],
    ]);
    expect(currentRun(v, 4)).toEqual({ side: 0, points: 8 });
    expect(currentRun(v, 5)).toBeNull();
  });

  it("is null before any score and clamps revealed", () => {
    const v = view([
      [0, 3],
      [0, 3],
      [0, 3],
    ]);
    expect(currentRun(v, 0)).toBeNull();
    expect(currentRun(v, 99)).toEqual({ side: 0, points: 9 });
  });
});

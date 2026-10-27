import { describe, expect, it } from "vitest";
import {
  initialPadState,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  stepPad,
  type PadSnapshot,
  type PadState,
} from "@/components/game/shell/gamepad-map";

function pad(
  down: number[] = [],
  axes: number[] = [0, 0, 0, 0],
  mapping = "standard",
): PadSnapshot {
  const pressed = Array.from({ length: 17 }, (_, i) => down.includes(i));
  return { mapping, pressed, axes };
}

/** Run frames [time, snapshot] and collect the actions per frame. */
function run(frames: Array<[number, PadSnapshot]>) {
  let state: PadState = initialPadState();
  return frames.map(([time, snapshot]) => {
    const result = stepPad(state, snapshot, time);
    state = result.state;
    return result.actions;
  });
}

describe("stepPad buttons", () => {
  it("maps each standard button to its action on the press edge", () => {
    const table: Array<[number, string]> = [
      [0, "confirm"],
      [1, "back"],
      [4, "prevHub"],
      [5, "nextHub"],
      [9, "sim"],
      [8, "search"],
      [12, "up"],
      [13, "down"],
      [14, "left"],
      [15, "right"],
    ];
    for (const [index, action] of table) {
      const out = run([
        [0, pad()],
        [16, pad([index])],
      ]);
      expect(out[1]).toEqual([action]);
    }
  });

  it("fires once per press, not while held, and again after release", () => {
    const out = run([
      [0, pad()],
      [16, pad([0])],
      [32, pad([0])],
      [48, pad()],
      [64, pad([0])],
    ]);
    expect(out).toEqual([[], ["confirm"], [], [], ["confirm"]]);
  });

  it("does not fire for a button already down on the first snapshot", () => {
    expect(run([[0, pad([0, 9])]])[0]).toEqual([]);
  });

  it("does not repeat action buttons while held", () => {
    const out = run([
      [0, pad()],
      [16, pad([5])],
      [1000, pad([5])],
    ]);
    expect(out[2]).toEqual([]);
  });
});

describe("stepPad direction repeat", () => {
  it("fires on press, repeats after 400ms, then every 120ms", () => {
    const held = pad([13]);
    const out = run([
      [0, held],
      [REPEAT_DELAY_MS - 1, held],
      [REPEAT_DELAY_MS, held],
      [REPEAT_DELAY_MS + REPEAT_INTERVAL_MS - 1, held],
      [REPEAT_DELAY_MS + REPEAT_INTERVAL_MS, held],
      [REPEAT_DELAY_MS + 2 * REPEAT_INTERVAL_MS, held],
    ]);
    expect(out).toEqual([["down"], [], ["down"], [], ["down"], ["down"]]);
  });

  it("restarts the delay after release", () => {
    const out = run([
      [0, pad([14])],
      [500, pad()],
      [520, pad([14])],
      [900, pad([14])],
      [920, pad([14])],
    ]);
    expect(out).toEqual([["left"], [], ["left"], [], ["left"]]);
  });
});

describe("stepPad left stick", () => {
  it("ignores values inside the 0.5 dead zone", () => {
    expect(run([[0, pad([], [0.5, -0.5])]])[0]).toEqual([]);
    expect(run([[0, pad([], [0.3, 0.49])]])[0]).toEqual([]);
  });

  it("maps a push past the dead zone to a direction", () => {
    expect(run([[0, pad([], [0, -0.9])]])[0]).toEqual(["up"]);
    expect(run([[0, pad([], [0, 0.9])]])[0]).toEqual(["down"]);
    expect(run([[0, pad([], [-0.9, 0])]])[0]).toEqual(["left"]);
    expect(run([[0, pad([], [0.9, 0])]])[0]).toEqual(["right"]);
  });

  it("picks the dominant axis on a diagonal and repeats like the d-pad", () => {
    const stick = pad([], [0.6, 0.9]);
    const out = run([
      [0, stick],
      [REPEAT_DELAY_MS, stick],
    ]);
    expect(out).toEqual([["down"], ["down"]]);
  });

  it("does not double-fire when the stick and d-pad agree", () => {
    expect(run([[0, pad([13], [0, 0.9])]])[0]).toEqual(["down"]);
  });
});

describe("stepPad mapping", () => {
  it("ignores pads without the standard mapping", () => {
    const out = run([
      [0, pad([], [0, 0], "")],
      [16, pad([0, 12, 9], [0, 0.9], "")],
    ]);
    expect(out).toEqual([[], []]);
  });
});

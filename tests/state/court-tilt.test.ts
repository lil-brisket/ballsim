import { describe, expect, it } from "vitest";
import { COURT_FIXTURE_VIEW } from "@/app/dev/broadcast-ui/court-fixture";
import {
  ballHeightAt,
  ballHeightKeyframes,
} from "@/components/game/watch/court/court-motion";
import {
  RIM_HEIGHT_FT,
  TILT_RAISE,
  tiltFloorTransform,
  tiltPoint,
  tiltRaised,
  tiltTranslate,
} from "@/components/game/watch/court/court-tilt";
import { hoopGeometry } from "@/components/game/watch/court/CourtHoops";
import { buildPlayChoreography } from "@/state/watch-court-choreo";
import { COURT_RIM } from "@/state/watch-court-frame";
import { toFullCourt } from "@/state/watch-full-court";

describe("tiltPoint", () => {
  it("leaves the near sideline where it is, at full size", () => {
    expect(tiltPoint({ x: 0, y: 1 })).toEqual({ x: 0, y: 1, scale: 1 });
    expect(tiltPoint({ x: 1, y: 1 })).toEqual({ x: 1, y: 1, scale: 1 });
  });

  it("narrows and shrinks toward the far sideline", () => {
    const far = tiltPoint({ x: 0, y: 0 });
    const mid = tiltPoint({ x: 0, y: 0.5 });
    expect(far.scale).toBeLessThan(mid.scale);
    expect(far.x).toBeGreaterThan(mid.x);
    expect(far.y).toBeLessThan(mid.y);
    expect(far.y).toBeGreaterThan(0);
  });

  it("is symmetric about the centre of the floor", () => {
    const left = tiltPoint({ x: 0.2, y: 0.3 });
    const right = tiltPoint({ x: 0.8, y: 0.3 });
    expect(left.x + right.x).toBeCloseTo(1);
    expect(left.y).toBe(right.y);
  });

  it("keeps order, so a player further back is always higher up", () => {
    let last = Infinity;
    for (let y = 1; y >= -0.2; y -= 0.05) {
      const placed = tiltPoint({ x: 0.5, y });
      expect(placed.y).toBeLessThan(last);
      last = placed.y;
    }
  });
});

describe("tiltRaised", () => {
  it("lifts straight up the screen by the height shown at that depth", () => {
    const floor = tiltPoint({ x: 0.2, y: 0.5 });
    const raised = tiltRaised({ x: 0.2, y: 0.5 }, 10);
    expect(raised.x).toBe(floor.x);
    expect(floor.y - raised.y).toBeCloseTo(
      (10 * TILT_RAISE * floor.scale) / 50,
    );
  });

  it("does nothing at floor level", () => {
    expect(tiltRaised({ x: 0.2, y: 0.5 }, 0)).toEqual(
      tiltPoint({ x: 0.2, y: 0.5 }),
    );
  });
});

describe("tilt transforms", () => {
  it("places layers in fractions of the floor, sized for depth", () => {
    expect(tiltTranslate({ x: 0.5, y: 1 })).toBe(
      "translate(50cqw, 100cqh) scale(1)",
    );
  });

  it("sets the floor's camera distance from its width", () => {
    expect(tiltFloorTransform(1000)).toBe("perspective(1600px) rotateX(50deg)");
  });
});

describe("hoopGeometry", () => {
  it("puts the rim at rim height straight over its spot on the floor", () => {
    for (const end of ["left", "right"] as const) {
      const { rim } = hoopGeometry(end);
      const raised = tiltRaised(toFullCourt(COURT_RIM, end), RIM_HEIGHT_FT);
      expect(rim.x / 94).toBeCloseTo(raised.x, 3);
      expect(rim.y / 50).toBeCloseTo(raised.y, 3);
    }
  });

  it("mirrors the two ends", () => {
    const left = hoopGeometry("left");
    const right = hoopGeometry("right");
    expect(left.rim.x + right.rim.x).toBeCloseTo(94);
    expect(left.rim.y).toBeCloseTo(right.rim.y);
    expect(left.toBoard).toBe(-1);
    expect(right.toBoard).toBe(1);
  });

  it("stands the pole off the court and the board between it and the rim", () => {
    const { poleBase, rim, board } = hoopGeometry("left");
    const boardX = board.reduce((sum, p) => sum + p.x, 0) / board.length;
    expect(poleBase.x).toBeLessThan(boardX);
    expect(boardX).toBeLessThan(rim.x);
  });

  it("raises the board around the rim", () => {
    const { rim, board } = hoopGeometry("left");
    expect(Math.min(...board.map((p) => p.y))).toBeLessThan(rim.y);
    expect(Math.max(...board.map((p) => p.y))).toBeGreaterThan(rim.y);
  });
});

describe("ballHeightAt", () => {
  const view = COURT_FIXTURE_VIEW;
  const shotPlay = buildPlayChoreography(view, 0)!;
  const heightOf = ballHeightAt(shotPlay, true);
  const shot = shotPlay.legs.indexOf("shot");
  const release = shotPlay.beats[shot]!;
  const rim = shotPlay.beats[shot + 1]!;

  it("arrives at the rim at rim height", () => {
    expect(heightOf(rim)).toBeCloseTo(RIM_HEIGHT_FT);
  });

  it("leaves the hands well above the floor and arcs over the rim", () => {
    expect(heightOf(release)).toBeGreaterThan(6);
    expect(heightOf((release + rim) / 2)).toBeGreaterThan(RIM_HEIGHT_FT + 1);
  });

  it("drops a make through the net", () => {
    expect(heightOf(rim + (1 - rim) / 2)).toBeLessThan(RIM_HEIGHT_FT);
    expect(heightOf(1)).toBeLessThan(1);
  });

  it("holds a miss up at the rim for the rebound", () => {
    expect(ballHeightAt(shotPlay, false)(1)).toBeCloseTo(RIM_HEIGHT_FT);
  });

  it("stays low on a dribble and never goes below the floor", () => {
    for (let p = 0; p <= 1; p += 0.01) {
      expect(heightOf(p)).toBeGreaterThanOrEqual(0);
    }
    expect(heightOf(0)).toBeLessThan(5);
  });

  it("makes keyframes that match the height in pixels", () => {
    const frames = ballHeightKeyframes(shotPlay, 10);
    const atRim = frames.find((frame) => frame.offset === rim)!;
    const match = /translateY\((-?[\d.]+)px\)/.exec(String(atRim.transform));
    expect(Number(match?.[1])).toBeCloseTo(-RIM_HEIGHT_FT * 10, 0);
    const offsets = frames.map((frame) => frame.offset as number);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });
});

import { describe, expect, it } from "vitest";
import {
  athletePose,
  type AthletePoseInput,
} from "@/components/game/watch/court/fx/fx-athlete";

const STILL = { x: 0.5, y: 0.5 };

function input(extra: Partial<AthletePoseInput> = {}): AthletePoseInput {
  return {
    at: () => STILL,
    ball: () => ({ x: 0.5, y: 0.9 }),
    holds: () => false,
    rim: { x: 0.95, y: 0.5 },
    release: null,
    p: 0.5,
    motionMs: 2000,
    ...extra,
  };
}

/** Runs along the floor's length at `feetPerSecond`, in a 2 s play. */
const running =
  (feetPerSecond: number, direction = 1) =>
  (p: number) => ({
    x: 0.5 + (direction * feetPerSecond * 2 * (p - 0.5)) / 94,
    y: 0.5,
  });

describe("athletePose", () => {
  it("is the same every time for the same moment", () => {
    const a = input({ at: running(12) });
    expect(athletePose(a)).toEqual(athletePose(a));
  });

  it("faces where they run", () => {
    expect(athletePose(input({ at: running(12) })).facing).toBeCloseTo(0);
    expect(
      Math.abs(athletePose(input({ at: running(12, -1) })).facing),
    ).toBeCloseTo(Math.PI);
  });

  it("stands still watching the ball", () => {
    const pose = athletePose(input());
    expect(pose.facing).toBeCloseTo(Math.PI / 2);
    expect(pose.stride).toBeCloseTo(0);
    expect(pose.lift).toBe(0);
  });

  it("looks at the rim with the ball in hand", () => {
    const pose = athletePose(input({ holds: () => true }));
    expect(pose.hold).toBe(1);
    expect(pose.facing).toBeCloseTo(0);
  });

  it("strides harder the faster they go, and swings both ways", () => {
    const strides = (speed: number) =>
      Array.from(
        { length: 40 },
        (_, i) =>
          athletePose(input({ at: running(speed), p: 0.3 + i * 0.01 })).stride,
      );
    expect(Math.max(...strides(14))).toBeGreaterThan(Math.max(...strides(5)));
    expect(Math.min(...strides(14))).toBeLessThan(0);
  });

  it("raises the arms through a shot and comes back down", () => {
    const at = (p: number) => athletePose(input({ release: 0.5, p })).lift;
    expect(at(0.2)).toBe(0);
    expect(at(0.45)).toBeGreaterThan(0);
    expect(at(0.5)).toBeGreaterThan(0.5);
    expect(at(0.55)).toBe(1);
    expect(at(0.8)).toBe(0);
  });

  it("squares up to the rim to shoot, even while drifting", () => {
    const drifting = (p: number) => ({ x: 0.5, y: 0.5 + (p - 0.5) * 0.4 });
    const pose = athletePose(input({ at: drifting, release: 0.5, p: 0.55 }));
    // At this moment they have drifted 0.02 of the floor from the rim line.
    expect(pose.facing).toBeCloseTo(Math.atan2(-0.02 * 50, 0.45 * 94), 3);
    expect(pose.stride).toBeCloseTo(0);
  });

  it("eases into a catch instead of snapping", () => {
    const holds = (p: number) => p >= 0.5;
    const at = (p: number) => athletePose(input({ holds, p })).hold;
    expect(at(0.4)).toBe(0);
    expect(at(0.5)).toBeGreaterThan(0);
    expect(at(0.5)).toBeLessThan(1);
    expect(at(0.6)).toBe(1);
  });

  it("keeps a usable direction with the ball on top of them at the rim", () => {
    const pose = athletePose(input({ ball: () => STILL, rim: STILL }));
    expect(Number.isFinite(pose.facing)).toBe(true);
  });
});

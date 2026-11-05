import { describe, expect, it } from "vitest";
import { athleteRig } from "@/components/game/watch/court/fx/athlete-rig";

const STANDING = { facing: 0, stride: 0, lift: 0, hold: 0 };

describe("athleteRig", () => {
  it("stands about six and a half feet tall, feet on the floor", () => {
    const rig = athleteRig(STANDING);
    expect(rig.head.u).toBeGreaterThan(5.5);
    expect(rig.head.u).toBeLessThan(6.6);
    expect(rig.leftFoot.u).toBe(0);
    expect(rig.rightFoot.u).toBe(0);
  });

  it("has shoulders in proportion, wider than the hips", () => {
    const rig = athleteRig(STANDING);
    const shoulders = rig.rightShoulder.s - rig.leftShoulder.s;
    const hips = rig.rightHip.s - rig.leftHip.s;
    expect(shoulders).toBeGreaterThan(hips);
    expect(shoulders).toBeLessThan(2);
  });

  it("orders the body from feet to head", () => {
    const rig = athleteRig(STANDING);
    expect(rig.rightFoot.u).toBeLessThan(rig.rightKnee.u);
    expect(rig.rightKnee.u).toBeLessThan(rig.rightHip.u);
    expect(rig.rightHip.u).toBeLessThan(rig.rightShoulder.u);
    expect(rig.rightShoulder.u).toBeLessThan(rig.head.u);
  });

  it("is mirrored left to right when standing still", () => {
    const rig = athleteRig(STANDING);
    expect(rig.leftShoulder.s).toBe(-rig.rightShoulder.s);
    expect(rig.leftElbow.s).toBeCloseTo(-rig.rightElbow.s);
  });

  it("swings the legs opposite each other in a stride", () => {
    const rig = athleteRig({ ...STANDING, stride: 1 });
    expect(rig.rightFoot.f).toBeGreaterThan(0);
    expect(rig.leftFoot.f).toBeLessThan(0);
    expect(rig.leftFoot.u).toBeGreaterThan(0);
    expect(rig.rightFoot.u).toBe(0);
  });

  it("swings each arm against the leg on its side", () => {
    const rig = athleteRig({ ...STANDING, stride: 1 });
    expect(rig.leftHand.f).toBeGreaterThan(rig.rightHand.f);
  });

  it("leans into a run", () => {
    expect(
      athleteRig({ ...STANDING, stride: 1 }).rightShoulder.f,
    ).toBeGreaterThan(athleteRig(STANDING).rightShoulder.f);
  });

  it("puts the right hand low and out front to dribble", () => {
    const rig = athleteRig({ ...STANDING, hold: 1 });
    expect(rig.rightHand.f).toBeGreaterThan(1);
    expect(rig.rightHand.u).toBeLessThan(rig.rightHip.u + 0.5);
  });

  it("gets both hands above the head in a shot, off the floor", () => {
    const rig = athleteRig({ ...STANDING, lift: 1 });
    expect(rig.leftHand.u).toBeGreaterThan(rig.head.u);
    expect(rig.rightHand.u).toBeGreaterThan(rig.head.u);
    expect(rig.leftFoot.u).toBeGreaterThan(1);
    expect(rig.rightFoot.u).toBeGreaterThan(1);
  });

  it("reaches only to about ten feet at the top of a jump", () => {
    const rig = athleteRig({ ...STANDING, lift: 1 });
    expect(rig.rightHand.u).toBeLessThan(10);
  });
});

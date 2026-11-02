import { describe, expect, it } from "vitest";
import { PORTRAIT_TRAIT_CARDINALITY } from "@/domain/entities/player-portrait";
import { libraryEntry } from "../../factories/portrait-library";
import { validatePortraitManifest } from "@/domain/portrait-library";
import {
  libraryTargetId,
  planLibraryTargets,
} from "@/systems/portraits/plan-library-targets";

type Key = "skinTone" | "hairStyle" | "facialHair" | "faceShape" | "hairColor";

function counts(plan: ReturnType<typeof planLibraryTargets>, key: Key) {
  const out = Array.from({ length: PORTRAIT_TRAIT_CARDINALITY[key] }, () => 0);
  for (const target of plan) out[target.traits[key]]! += 1;
  return out;
}

describe("planLibraryTargets", () => {
  const plan = planLibraryTargets(800);

  it("is deterministic and prefix-stable", () => {
    expect(planLibraryTargets(800)).toEqual(plan);
    expect(planLibraryTargets(100)).toEqual(plan.slice(0, 100));
    expect(planLibraryTargets(800, "other-seed")).not.toEqual(plan);
  });

  it("produces unique ids and a manifest-valid, signature-unique set", () => {
    expect(plan[0]!.id).toBe(libraryTargetId(0));
    expect(plan.at(-1)!.id).toBe("p0800");
    const manifest = {
      version: 1,
      entries: plan.map((target) => libraryEntry(target.id, target.traits)),
    };
    expect(validatePortraitManifest(manifest)).toEqual([]);
  });

  it("represents every skin tone, hair style and face shape evenly", () => {
    for (const count of counts(plan, "skinTone")) {
      expect(count).toBeGreaterThanOrEqual(76);
      expect(count).toBeLessThanOrEqual(84);
    }
    for (const count of counts(plan, "hairStyle")) {
      expect(count).toBeGreaterThanOrEqual(54);
      expect(count).toBeLessThanOrEqual(60);
    }
    for (const count of counts(plan, "faceShape")) {
      expect(count).toBeGreaterThanOrEqual(196);
    }
  });

  it("covers every facial-hair option as often as player generation draws it", () => {
    const facial = counts(plan, "facialHair");
    for (const count of facial) {
      expect(Math.abs(count - plan.length / 7)).toBeLessThanOrEqual(2);
    }
    const heavy = facial[2]! + facial[4]! + facial[5]! + facial[6]!;
    expect(Math.abs(heavy / plan.length - 4 / 7)).toBeLessThan(0.01);
  });

  it("balances every prefix, not just the full plan", () => {
    for (const count of counts(planLibraryTargets(100), "skinTone")) {
      expect(count).toBeGreaterThanOrEqual(9);
      expect(count).toBeLessThanOrEqual(11);
    }
  });

  it("pins hair colour for shaved heads and spreads it for the rest", () => {
    const shaved = plan.filter((target) => target.traits.hairStyle === 0);
    expect(shaved.length).toBeGreaterThan(0);
    expect(shaved.every((target) => target.traits.hairColor === 0)).toBe(true);
    const haired = plan.filter((target) => target.traits.hairStyle !== 0);
    const colours = counts(haired, "hairColor");
    expect(Math.max(...colours) - Math.min(...colours)).toBeLessThanOrEqual(2);
  });
});

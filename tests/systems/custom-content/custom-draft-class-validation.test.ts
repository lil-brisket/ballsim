import { describe, expect, it } from "vitest";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { validateDraftClassPackage } from "@/systems/custom-content/validate-draft-class";
import { makeDraftClassPackage, makePlayerSource } from "../../helpers/custom-content";

describe("custom draft class validation", () => {
  it("accepts a future class within the pick horizon", () => {
    const pkg = makeDraftClassPackage({
      draftYear: 2027,
      prospects: [
        makePlayerSource({ sourceId: "p1", age: 21, position: "PG", archetype: "floor_general", heightInches: 74, weightPounds: 190 }),
        makePlayerSource({ sourceId: "p2", age: 20, position: "C", archetype: "rim_protector", heightInches: 83, weightPounds: 250 }),
      ],
    });
    const result = validateDraftClassPackage(pkg, {
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      seasonYear: 2026,
      draftHorizonYear: 2029,
    });
    expect(result.ok).toBe(true);
    expect(result.normalized?.payload.prospects).toHaveLength(2);
  });

  it("rejects duplicate prospect sourceIds", () => {
    const pkg = makeDraftClassPackage({
      draftYear: 2027,
      prospects: [
        makePlayerSource({ sourceId: "p1", age: 21 }),
        makePlayerSource({ sourceId: "p1", age: 20, lastName: "Other" }),
      ],
    });
    const result = validateDraftClassPackage(pkg, {
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      seasonYear: 2026,
      draftHorizonYear: 2029,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.code === "duplicate_source_id")).toBe(
      true,
    );
  });
});

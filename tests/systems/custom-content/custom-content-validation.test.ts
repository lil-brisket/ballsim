import { describe, expect, it } from "vitest";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { parseCustomContentJson } from "@/systems/custom-content/parse";
import { validateRosterPackage } from "@/systems/custom-content/validate-roster";
import { validateDraftClassPackage } from "@/systems/custom-content/validate-draft-class";
import {
  makeDraftClassPackage,
  makeFullRosterPackage,
  makePlayerSource,
  makeRosterPackage,
} from "../../helpers/custom-content";

describe("custom content validation", () => {
  it("rejects invalid JSON without a partial result", () => {
    const parsed = parseCustomContentJson("{not json");
    expect(parsed.ok).toBe(false);
    expect(parsed.normalized).toBeUndefined();
    expect(parsed.errors[0]?.code).toBe("invalid_json");
  });

  it("rejects unsupported formatVersion", () => {
    const pkg = makeFullRosterPackage({ teamCount: 12 });
    const result = validateRosterPackage(
      { ...pkg, formatVersion: 99 },
      { teamCount: 12, schemaVersion: GAME_STATE_SCHEMA_VERSION },
    );
    expect(result.ok).toBe(false);
    expect(result.normalized).toBeUndefined();
    expect(result.errors.some((entry) => entry.code === "unsupported_format_version")).toBe(
      true,
    );
  });

  it("rejects ratings outside 1–99", () => {
    const pkg = makeRosterPackage({
      teams: [{ sourceId: "t0", name: "A" }],
      players: [
        {
          ...makePlayerSource({
            sourceId: "p0",
            attributes: {
              ...makePlayerSource({ sourceId: "p0" }).attributes,
              speed: 0,
            },
          }),
          teamSourceId: "t0",
        },
      ],
    });
    const result = validateRosterPackage(pkg, {
      teamCount: 1,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.code === "rating_out_of_range")).toBe(
      true,
    );
  });

  it("rejects archetype/position incompatibility", () => {
    const pkg = makeRosterPackage({
      teams: [{ sourceId: "t0", name: "A" }],
      players: [
        {
          ...makePlayerSource({
            sourceId: "p0",
            position: "C",
            archetype: "floor_general",
            heightInches: 82,
            weightPounds: 245,
          }),
          teamSourceId: "t0",
        },
      ],
    });
    const result = validateRosterPackage(pkg, {
      teamCount: 1,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
    });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((entry) => entry.code === "archetype_position_incompatible"),
    ).toBe(true);
  });

  it("warns on missing optional metadata but still imports", () => {
    const pkg = makeFullRosterPackage({ teamCount: 12 });
    const raw = {
      ...pkg,
      metadata: { ...pkg.metadata, description: undefined, author: undefined },
    };
    delete (raw.metadata as { description?: string }).description;
    delete (raw.metadata as { author?: string }).author;
    const result = validateRosterPackage(raw, {
      teamCount: 12,
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((entry) => entry.code === "missing_author")).toBe(
      true,
    );
  });

  it("rejects a past draft year", () => {
    const pkg = makeDraftClassPackage({
      draftYear: 2026,
      prospects: [makePlayerSource({ sourceId: "p1", age: 21 })],
    });
    const result = validateDraftClassPackage(pkg, {
      schemaVersion: GAME_STATE_SCHEMA_VERSION,
      seasonYear: 2026,
      draftHorizonYear: 2029,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((entry) => entry.code === "draft_year_in_past")).toBe(
      true,
    );
  });
});

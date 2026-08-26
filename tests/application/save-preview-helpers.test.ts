import { describe, expect, it } from "vitest";
import type { OwnerSavePreview } from "@/application/game-service";
import {
  filterSavePreviewsForMode,
  latestValidSaveForMode,
} from "@/application/save-preview-helpers";

function validPreview(
  overrides: Partial<OwnerSavePreview & { ok: true }> & { id: string },
): OwnerSavePreview & { ok: true } {
  return {
    ok: true,
    name: "Franchise",
    updatedAt: new Date("2026-08-10T12:00:00.000Z"),
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    mode: "owner",
    controlledTeam: {
      id: "team_1",
      city: "Harbor",
      name: "Waves",
      abbreviation: "HAR",
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "shield",
      },
    },
    seasonYear: 2026,
    currentDate: "2026-11-01",
    seasonPhase: "regular",
    teamSelectionLocked: true,
    ...overrides,
  };
}

describe("save-preview-helpers", () => {
  it("latestValidSaveForMode picks newest valid owner save", () => {
    const older = validPreview({
      id: "a",
      updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const newer = validPreview({
      id: "b",
      updatedAt: new Date("2026-08-15T00:00:00.000Z"),
      controlledTeam: {
        id: "team_2",
        city: "Toronto",
        name: "Huskies",
        abbreviation: "TOR",
        branding: {
          primaryColor: "#0B1F3A",
          secondaryColor: "#C4CED4",
          accentColor: "#F5B800",
          logoId: "wolf",
        },
      },
    });
    const invalid: OwnerSavePreview = {
      ok: false,
      id: "c",
      name: "Broken",
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      error: "bad",
    };
    const latest = latestValidSaveForMode([older, invalid, newer], "owner");
    expect(latest?.id).toBe("b");
    expect(latest?.controlledTeam.name).toBe("Huskies");
  });

  it("latestValidSaveForMode returns null when no valid saves for mode", () => {
    const invalid: OwnerSavePreview = {
      ok: false,
      id: "c",
      name: "Broken",
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      error: "bad",
    };
    expect(latestValidSaveForMode([invalid], "owner")).toBeNull();
    expect(latestValidSaveForMode([], "owner")).toBeNull();
  });

  it("filterSavePreviewsForMode keeps matching valid and all invalid rows", () => {
    const owner = validPreview({ id: "owner_1" });
    const invalid: OwnerSavePreview = {
      ok: false,
      id: "bad",
      name: "Broken",
      updatedAt: new Date("2026-08-20T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      error: "bad",
    };
    const filtered = filterSavePreviewsForMode([owner, invalid], "owner");
    expect(filtered.map((p) => p.id)).toEqual(["owner_1", "bad"]);
  });
});

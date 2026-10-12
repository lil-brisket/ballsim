import { describe, expect, it } from "vitest";
import { playerPortraitOverlayRelativePath } from "@/presentation/portrait-overlay-path";

describe("playerPortraitOverlayRelativePath", () => {
  it("uses saveGameId and playerId so overlay keys survive draft selection", () => {
    expect(
      playerPortraitOverlayRelativePath(
        "save_abc",
        "prospect_draft_2028_3",
        1,
        "deadbeef",
      ),
    ).toBe("portraits/save_abc/prospect_draft_2028_3.v1.deadbeef.webp");
  });

  it("rejects empty identity pieces", () => {
    expect(() =>
      playerPortraitOverlayRelativePath("", "p1", 1, "abc"),
    ).toThrow();
    expect(() =>
      playerPortraitOverlayRelativePath("s1", "", 1, "abc"),
    ).toThrow();
    expect(() =>
      playerPortraitOverlayRelativePath("s1", "p1", 0, "abc"),
    ).toThrow();
    expect(() =>
      playerPortraitOverlayRelativePath("s1", "p1", 1, ""),
    ).toThrow();
  });
});

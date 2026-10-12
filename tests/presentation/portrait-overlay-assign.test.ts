import { describe, expect, it } from "vitest";
import { decidePortraitOverlayAssignment } from "@/presentation/portrait-overlay-assign";

describe("decidePortraitOverlayAssignment", () => {
  it("skips when the destination already exists", () => {
    expect(
      decidePortraitOverlayAssignment({
        destinationExists: true,
        sourceExists: true,
      }),
    ).toBe("skip");
  });

  it("copies when a local original-fictional source exists", () => {
    expect(
      decidePortraitOverlayAssignment({
        destinationExists: false,
        sourceExists: true,
      }),
    ).toBe("copy");
  });

  it("falls back when no source is configured", () => {
    expect(
      decidePortraitOverlayAssignment({
        destinationExists: false,
        sourceExists: false,
      }),
    ).toBe("fallback");
  });
});

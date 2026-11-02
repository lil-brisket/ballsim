import { describe, expect, it } from "vitest";
import { formatPositionLabel } from "@/presentation/position-label";

describe("formatPositionLabel", () => {
  it("shows only the primary position without a secondary", () => {
    expect(formatPositionLabel("PG")).toBe("PG");
    expect(formatPositionLabel("PG", null)).toBe("PG");
    expect(formatPositionLabel("PG", undefined)).toBe("PG");
  });

  it("shows primary first, then the secondary after a slash", () => {
    expect(formatPositionLabel("PG", "SG")).toBe("PG/SG");
    expect(formatPositionLabel("C", "PF")).toBe("C/PF");
  });
});

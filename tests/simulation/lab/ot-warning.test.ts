import { describe, expect, it } from "vitest";
import {
  LAB_OT_PERIODS_HIGH_THRESHOLD,
  overtimeHighFailure,
} from "@/simulation/lab/collect-game-failures";

describe("LAB_OT_PERIODS_HIGH", () => {
  it("is a warning only above four overtime periods", () => {
    expect(overtimeHighFailure(LAB_OT_PERIODS_HIGH_THRESHOLD, "g1")).toBeNull();
    const warning = overtimeHighFailure(
      LAB_OT_PERIODS_HIGH_THRESHOLD + 1,
      "g1",
    );
    expect(warning?.rule).toBe("LAB_OT_PERIODS_HIGH");
  });
});

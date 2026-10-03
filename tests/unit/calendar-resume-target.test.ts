import { describe, expect, it } from "vitest";
import { remainingSimulateTarget } from "@/components/calendar/calendar-resume-target";

describe("remainingSimulateTarget", () => {
  it("keeps the original date when a blocking decision pauses the jump", () => {
    expect(
      remainingSimulateTarget({
        requestedTargetDate: "2026-10-15",
        currentDate: "2026-10-03",
        stopReason: "pending_owner_decision",
      }),
    ).toBe("2026-10-15");
  });

  it("clears when the jump reached the requested date", () => {
    expect(
      remainingSimulateTarget({
        requestedTargetDate: "2026-10-15",
        currentDate: "2026-10-15",
        stopReason: "pending_owner_decision",
      }),
    ).toBeNull();
  });

  it("clears for completed jumps without a decision pause", () => {
    expect(
      remainingSimulateTarget({
        requestedTargetDate: "2026-10-15",
        currentDate: "2026-10-15",
      }),
    ).toBeNull();
  });
});

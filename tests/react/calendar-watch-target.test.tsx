import { afterEach, describe, expect, it } from "vitest";
import {
  readCalendarWatchTarget,
  writeCalendarWatchTarget,
} from "@/components/calendar/calendar-resume-target";

describe("calendar watch target storage", () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips and clears", () => {
    expect(readCalendarWatchTarget("s1")).toBeNull();
    writeCalendarWatchTarget("s1", { gameId: "g1", gameDate: "2026-09-18" });
    expect(readCalendarWatchTarget("s1")).toEqual({
      gameId: "g1",
      gameDate: "2026-09-18",
    });
    expect(readCalendarWatchTarget("s2")).toBeNull();
    writeCalendarWatchTarget("s1", null);
    expect(readCalendarWatchTarget("s1")).toBeNull();
  });

  it("rejects malformed stored values", () => {
    window.sessionStorage.setItem("bball.calendarWatchTarget.s1", "not json");
    expect(readCalendarWatchTarget("s1")).toBeNull();
    window.sessionStorage.setItem(
      "bball.calendarWatchTarget.s1",
      JSON.stringify({ gameId: "g1", gameDate: "soon" }),
    );
    expect(readCalendarWatchTarget("s1")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { addCalendarDays, parseCalendarDate } from "@/domain/calendar-date";

describe("calendar-date", () => {
  it("parses and formats YYYY-MM-DD", () => {
    expect(parseCalendarDate("2026-10-01")).toEqual({
      year: 2026,
      month: 10,
      day: 1,
    });
  });

  it("adds days across month boundaries", () => {
    expect(addCalendarDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addCalendarDays("2026-10-01", 0)).toBe("2026-10-01");
  });

  it("rejects invalid dates", () => {
    expect(() => parseCalendarDate("2026-13-01")).toThrow();
    expect(() => parseCalendarDate("not-a-date")).toThrow();
  });
});

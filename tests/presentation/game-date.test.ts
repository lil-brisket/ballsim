import { describe, expect, it } from "vitest";
import {
  formatGameDate,
  formatRelativeGameDay,
} from "@/presentation/game-date";

describe("formatGameDate", () => {
  it("formats ISO days like a broadcast", () => {
    expect(formatGameDate("2026-10-08")).toBe("Oct 8");
    expect(formatGameDate("2026-10-10", { weekday: true })).toBe("Sat, Oct 10");
    expect(formatGameDate("2026-10-08", { year: true })).toBe("Oct 8, 2026");
  });

  it("ignores the time part of a timestamp", () => {
    expect(formatGameDate("2026-12-31T23:59:59.000Z")).toBe("Dec 31");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatGameDate("soon")).toBe("soon");
  });
});

describe("formatRelativeGameDay", () => {
  it("counts days from today", () => {
    expect(formatRelativeGameDay("2026-10-08", "2026-10-08")).toBe("Today");
    expect(formatRelativeGameDay("2026-10-09", "2026-10-08")).toBe("Tomorrow");
    expect(formatRelativeGameDay("2026-10-11", "2026-10-08")).toBe("In 3 days");
    expect(formatRelativeGameDay("2026-10-05", "2026-10-08")).toBe(
      "3 days ago",
    );
  });
});

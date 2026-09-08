import { describe, expect, it } from "vitest";
import {
  RECENT_FORM_GAME_LIMIT,
  recentFormFromResults,
} from "@/state/recent-form-selectors";

describe("recent-form-selectors", () => {
  it("uses last 5 games as the shared definition", () => {
    expect(RECENT_FORM_GAME_LIMIT).toBe(5);
    const results = Array.from({ length: 8 }, (_, i) => ({
      gameId: `g${i}`,
      date: `2026-09-${String(8 - i).padStart(2, "0")}`,
      opponentAbbreviation: "OPP",
      home: true,
      teamScore: i % 2 === 0 ? 110 : 90,
      opponentScore: 100,
      won: i % 2 === 0,
    }));
    const form = recentFormFromResults(results);
    expect(form.games).toHaveLength(5);
    expect(form.marks).toHaveLength(5);
    expect(form.streak).toMatch(/^[WL]\d+$/);
  });

  it("handles empty results", () => {
    const form = recentFormFromResults([]);
    expect(form.games).toHaveLength(0);
    expect(form.record).toBe("—");
    expect(form.streak).toBeNull();
  });
});

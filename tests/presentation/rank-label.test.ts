import { describe, expect, it } from "vitest";
import {
  groupRankLabel,
  leagueRankLabel,
  rankNumberLabel,
} from "@/presentation/rank-label";

describe("rank labels", () => {
  it("names the league scope", () => {
    expect(leagueRankLabel(2)).toBe("League #2");
    expect(rankNumberLabel(2)).toBe("#2");
  });

  it("names a conference or division scope", () => {
    expect(groupRankLabel("Coastal", 1)).toBe("Coastal #1");
  });

  it("shows a dash when unranked", () => {
    for (const rank of [null, undefined, 0]) {
      expect(leagueRankLabel(rank)).toBe("—");
      expect(rankNumberLabel(rank)).toBe("—");
    }
  });
});

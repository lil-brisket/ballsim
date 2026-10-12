import { describe, expect, it } from "vitest";
import { parseGameResultHeadline } from "@/presentation/game-result-headline";

describe("parseGameResultHeadline", () => {
  it("parses wins, losses and ties with an en dash", () => {
    expect(parseGameResultHeadline("W 112–104 vs SAC")).toEqual({
      result: "W",
      teamScore: 112,
      opponentScore: 104,
      opponent: "SAC",
    });
    expect(parseGameResultHeadline("L 87–97 vs TOR")?.result).toBe("L");
    expect(parseGameResultHeadline("T 100–100 vs NYC")?.result).toBe("T");
  });

  it("accepts a plain hyphen", () => {
    expect(parseGameResultHeadline("W 110-102 vs POR")?.teamScore).toBe(110);
  });

  it("returns null for anything else", () => {
    expect(parseGameResultHeadline("Trade completed")).toBeNull();
    expect(parseGameResultHeadline("X 1–2 vs ABC")).toBeNull();
    expect(parseGameResultHeadline("")).toBeNull();
  });
});

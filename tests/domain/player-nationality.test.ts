import { describe, expect, it } from "vitest";
import {
  isPlayerNationality,
  NATIONALITY_LABELS,
  PLAYER_NATIONALITIES,
} from "@/domain/entities/player-nationality";

describe("player nationality catalog", () => {
  it("exposes nationalities with display labels", () => {
    expect(PLAYER_NATIONALITIES.length).toBeGreaterThan(0);
    for (const nationality of PLAYER_NATIONALITIES) {
      expect(isPlayerNationality(nationality)).toBe(true);
      expect(NATIONALITY_LABELS[nationality].length).toBeGreaterThan(0);
    }
    expect(isPlayerNationality("Atlantis")).toBe(false);
  });

  it("contains no duplicate nationality identifiers", () => {
    expect(new Set(PLAYER_NATIONALITIES).size).toBe(PLAYER_NATIONALITIES.length);
  });
});

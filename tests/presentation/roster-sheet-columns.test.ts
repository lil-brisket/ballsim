import { describe, expect, it } from "vitest";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities";
import {
  SHEET_ATTRIBUTE_COLUMNS,
  SHEET_SKILL_COLUMNS,
  SHEET_STAT_COLUMNS,
  formatSheetStat,
  toRosterSheetRow,
} from "@/presentation/roster-sheet-columns";
import { categoryRatings } from "@/presentation/player-rating-categories";
import { FLAT_ATTRIBUTES } from "../factories/roster-page-player";

describe("Simple columns", () => {
  it("has the nine skill columns in sheet order", () => {
    expect(SHEET_SKILL_COLUMNS.map((c) => c.short)).toEqual([
      "INS",
      "MID",
      "3PT",
      "INT D",
      "PER D",
      "PLAY",
      "REB",
      "ATHL",
      "IQ",
    ]);
  });

  it("maps every attribute to at most one column; only FT, STL, BLK are left to Detail", () => {
    const seen = new Map<string, string>();
    for (const column of SHEET_SKILL_COLUMNS) {
      for (const key of column.attributes) {
        expect(seen.get(key), `${key} is in two columns`).toBeUndefined();
        seen.set(key, column.short);
      }
    }
    const uncovered = PLAYER_ATTRIBUTE_KEYS.filter((key) => !seen.has(key));
    expect([...uncovered].sort()).toEqual(["block", "freeThrow", "steal"]);
  });

  it("uses the player card's Athleticism and IQ categories", () => {
    const attributes = {
      ...FLAT_ATTRIBUTES,
      speed: 90,
      strength: 70,
      athleticism: 80,
      stamina: 50,
      basketballIq: 90,
      offensiveIq: 80,
      defensiveIq: 70,
      consistency: 60,
    };
    const row = toRosterSheetRow({ attributes });
    const categories = categoryRatings(attributes);
    expect(row.athl).toBe(
      categories.find((c) => c.key === "athleticism")!.rating,
    );
    expect(row.iq).toBe(categories.find((c) => c.key === "iq")!.rating);
  });

  it("computes PLAY as the mean of handling and passing, others as single attributes", () => {
    const row = toRosterSheetRow({
      attributes: {
        ...FLAT_ATTRIBUTES,
        ballHandling: 80,
        passing: 71,
        finishing: 91,
        midRange: 62,
        threePoint: 73,
        interiorDefense: 54,
        perimeterDefense: 65,
        rebounding: 76,
      },
    });
    expect(row).toMatchObject({
      ins: 91,
      mid: 62,
      three: 73,
      intD: 54,
      perD: 65,
      play: 76,
      reb: 76,
    });
  });
});

describe("Detail and Stats columns", () => {
  it("lists all 19 attributes exactly once", () => {
    const keys = SHEET_ATTRIBUTE_COLUMNS.map((c) => c.key);
    expect(new Set(keys).size).toBe(19);
    expect([...keys].sort()).toEqual([...PLAYER_ATTRIBUTE_KEYS].sort());
    expect(SHEET_ATTRIBUTE_COLUMNS.map((c) => c.short)).toEqual([
      "FIN",
      "MID",
      "3PT",
      "FT",
      "HND",
      "PAS",
      "PER D",
      "INT D",
      "STL",
      "BLK",
      "REB",
      "SPD",
      "STR",
      "ATH",
      "STA",
      "BBIQ",
      "OIQ",
      "DIQ",
      "CON",
    ]);
  });

  it("has the ten stat columns", () => {
    expect(SHEET_STAT_COLUMNS.map((c) => c.short)).toEqual([
      "GP",
      "MPG",
      "PPG",
      "RPG",
      "APG",
      "SPG",
      "BPG",
      "FG%",
      "3P%",
      "FT%",
    ]);
  });

  it("shows a dash, not a zero, for a missing average", () => {
    expect(formatSheetStat(null)).toBe("—");
    expect(formatSheetStat(0)).toBe("0");
    expect(formatSheetStat(12.4)).toBe("12.4");
  });
});

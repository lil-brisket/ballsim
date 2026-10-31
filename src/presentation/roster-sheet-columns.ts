/**
 * Column definitions for the roster sheet. Every skill column is computed
 * from the 19 stored attributes; nothing here is stored or feeds gameplay.
 */

import type { PlayerAttributes } from "@/domain/entities/player";
import { RATING_CATEGORIES } from "@/presentation/player-rating-categories";
import type { PlayerPerformanceView } from "@/state/player-performance";

export type SheetSkillKey =
  "ins" | "mid" | "three" | "intD" | "perD" | "play" | "reb" | "athl" | "iq";

export type SheetSkillColumn = {
  key: SheetSkillKey;
  short: string;
  long: string;
  /** Attributes the column averages; no attribute feeds two columns. */
  attributes: ReadonlyArray<keyof PlayerAttributes>;
};

function categoryAttributes(
  key: string,
): ReadonlyArray<keyof PlayerAttributes> {
  return RATING_CATEGORIES.find((c) => c.key === key)!.attributes;
}

/**
 * Free throw, steal and block have no Simple column (they sit inside the
 * player card's Outside Scoring and Defense averages); the Detail tab shows
 * them.
 */
export const SHEET_SKILL_COLUMNS: readonly SheetSkillColumn[] = [
  {
    key: "ins",
    short: "INS",
    long: "Inside scoring",
    attributes: ["finishing"],
  },
  { key: "mid", short: "MID", long: "Mid-range", attributes: ["midRange"] },
  {
    key: "three",
    short: "3PT",
    long: "Three-point",
    attributes: ["threePoint"],
  },
  {
    key: "intD",
    short: "INT D",
    long: "Interior defense",
    attributes: ["interiorDefense"],
  },
  {
    key: "perD",
    short: "PER D",
    long: "Perimeter defense",
    attributes: ["perimeterDefense"],
  },
  {
    key: "play",
    short: "PLAY",
    long: "Playmaking",
    attributes: ["ballHandling", "passing"],
  },
  { key: "reb", short: "REB", long: "Rebounding", attributes: ["rebounding"] },
  {
    key: "athl",
    short: "ATHL",
    long: "Athleticism",
    attributes: categoryAttributes("athleticism"),
  },
  {
    key: "iq",
    short: "IQ",
    long: "Basketball IQ",
    attributes: categoryAttributes("iq"),
  },
];

export type SheetSkillRow = Record<SheetSkillKey, number>;

/** The nine Simple-tab skill values: rounded mean of each column's attributes. */
export function toRosterSheetRow(player: {
  attributes: PlayerAttributes;
}): SheetSkillRow {
  const row = {} as SheetSkillRow;
  for (const column of SHEET_SKILL_COLUMNS) {
    const total = column.attributes.reduce(
      (sum, key) => sum + player.attributes[key],
      0,
    );
    row[column.key] = Math.round(total / column.attributes.length);
  }
  return row;
}

export type SheetAttributeColumn = {
  key: keyof PlayerAttributes;
  short: string;
  long: string;
};

/** Detail tab: all 19 attributes. */
export const SHEET_ATTRIBUTE_COLUMNS: readonly SheetAttributeColumn[] = [
  { key: "finishing", short: "FIN", long: "Finishing" },
  { key: "midRange", short: "MID", long: "Mid-range" },
  { key: "threePoint", short: "3PT", long: "Three-point" },
  { key: "freeThrow", short: "FT", long: "Free throw" },
  { key: "ballHandling", short: "HND", long: "Ball handling" },
  { key: "passing", short: "PAS", long: "Passing" },
  { key: "perimeterDefense", short: "PER D", long: "Perimeter defense" },
  { key: "interiorDefense", short: "INT D", long: "Interior defense" },
  { key: "steal", short: "STL", long: "Steal" },
  { key: "block", short: "BLK", long: "Block" },
  { key: "rebounding", short: "REB", long: "Rebounding" },
  { key: "speed", short: "SPD", long: "Speed" },
  { key: "strength", short: "STR", long: "Strength" },
  { key: "athleticism", short: "ATH", long: "Athleticism" },
  { key: "stamina", short: "STA", long: "Stamina" },
  { key: "basketballIq", short: "BBIQ", long: "Basketball IQ" },
  { key: "offensiveIq", short: "OIQ", long: "Offensive IQ" },
  { key: "defensiveIq", short: "DIQ", long: "Defensive IQ" },
  { key: "consistency", short: "CON", long: "Consistency" },
];

export type SheetStatColumn = {
  key: keyof PlayerPerformanceView;
  short: string;
  long: string;
};

/** Stats tab. Averages are per game; a player without games shows a dash. */
export const SHEET_STAT_COLUMNS: readonly SheetStatColumn[] = [
  { key: "games", short: "GP", long: "Games played" },
  { key: "mpg", short: "MPG", long: "Minutes per game" },
  { key: "ppg", short: "PPG", long: "Points per game" },
  { key: "rpg", short: "RPG", long: "Rebounds per game" },
  { key: "apg", short: "APG", long: "Assists per game" },
  { key: "spg", short: "SPG", long: "Steals per game" },
  { key: "bpg", short: "BPG", long: "Blocks per game" },
  { key: "fgPct", short: "FG%", long: "Field goal percentage" },
  { key: "threePct", short: "3P%", long: "Three-point percentage" },
  { key: "ftPct", short: "FT%", long: "Free throw percentage" },
];

/** A dash for a missing average, never a zero. */
export function formatSheetStat(value: number | null): string {
  return value === null ? "—" : String(value);
}

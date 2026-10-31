/**
 * Pure model for the draft prospect scouting sheet: columns and sorting. No
 * React; nothing here feeds gameplay. Every value comes from a
 * ProspectSheetRow, which holds scouting estimates only (see
 * prospect-sheet-view.ts).
 *
 * No best-in-column markers here, unlike the roster sheet: ranges overlap and
 * a marker on the higher midpoint would claim a certainty the scouts do not
 * have. There are no role groups either; the pool is one list.
 */

import { PLAYER_POSITIONS } from "@/domain/entities/player";
import {
  ratingRangeMidpoint,
  SCOUT_CONFIDENCES,
  SCOUT_GRADES,
  type EstimatedScoutingCategoryKey,
  type RatingRange,
} from "@/domain/entities/scouting-types";
import {
  DEFAULT_SHEET_SORT,
  moveSortColumn,
  type SheetGroup,
  type SheetSort,
} from "@/presentation/roster-sheet-model";
import type { ProspectSheetRow } from "@/state/prospect-sheet-view";

export { DEFAULT_SHEET_SORT, moveSortColumn };

export type ProspectColumnKind = "text" | "age" | "range";

export type ProspectCellValue = string | number | RatingRange | null;

export type ProspectColumn = {
  id: string;
  short: string;
  long: string;
  kind: ProspectColumnKind;
  /** What the cell shows. */
  get: (row: ProspectSheetRow) => ProspectCellValue;
  /** What the column sorts on; null sorts last in either direction. */
  sortValue: (row: ProspectSheetRow) => number | string | null;
  /** Direction of the first click: best first for ranges and the letter. */
  firstDirection: SheetSort["direction"];
  /** OVR and POT always show numbers, whatever the grade/rating display. */
  plain?: boolean;
};

const POSITION_ORDER = Object.fromEntries(
  PLAYER_POSITIONS.map((position, index) => [position, index]),
) as Record<string, number>;

function rangeColumn(
  id: string,
  short: string,
  long: string,
  get: (row: ProspectSheetRow) => RatingRange | null,
  plain = false,
): ProspectColumn {
  return {
    id,
    short,
    long,
    kind: "range",
    get,
    sortValue: (row) => {
      const range = get(row);
      return range ? ratingRangeMidpoint(range) : null;
    },
    firstDirection: "desc",
    plain,
  };
}

function categoryColumn(
  key: EstimatedScoutingCategoryKey,
  short: string,
  long: string,
): ProspectColumn {
  return rangeColumn(key, short, long, (row) => row.categories[key] ?? null);
}

/** Position, age, scouting letter, overall, 8 categories, potential, confidence. */
export const PROSPECT_COLUMNS: readonly ProspectColumn[] = [
  {
    id: "pos",
    short: "POS",
    long: "Position",
    kind: "text",
    get: (row) => row.position,
    sortValue: (row) => POSITION_ORDER[row.position] ?? 99,
    firstDirection: "asc",
  },
  {
    id: "age",
    short: "AGE",
    long: "Age",
    kind: "age",
    get: (row) => row.age,
    sortValue: (row) => row.age,
    firstDirection: "asc",
  },
  {
    id: "scout",
    short: "SCOUT",
    long: "Scouting grade",
    kind: "text",
    get: (row) => row.scoutGrade,
    // Better letters sort higher: A+ is the top of SCOUT_GRADES.
    sortValue: (row) => {
      const index = SCOUT_GRADES.findIndex((grade) => grade === row.scoutGrade);
      return index === -1 ? null : SCOUT_GRADES.length - index;
    },
    firstDirection: "desc",
  },
  rangeColumn("ovr", "OVR", "Estimated overall", (row) => row.overall, true),
  categoryColumn("shooting", "SHOOT", "Shooting"),
  categoryColumn("finishing", "FIN", "Finishing"),
  categoryColumn("passing", "PASS", "Passing"),
  categoryColumn("ballHandling", "HND", "Ball handling"),
  categoryColumn("perimeterDefense", "PER D", "Perimeter defense"),
  categoryColumn("interiorDefense", "INT D", "Interior defense"),
  categoryColumn("rebounding", "REB", "Rebounding"),
  categoryColumn("athleticism", "ATHL", "Athleticism"),
  rangeColumn(
    "pot",
    "POT",
    "Estimated potential",
    (row) => row.potential,
    true,
  ),
  {
    id: "conf",
    short: "CONF",
    long: "Scouting confidence",
    kind: "text",
    get: (row) => row.confidence,
    sortValue: (row) => {
      const index = SCOUT_CONFIDENCES.findIndex(
        (level) => level === row.confidence,
      );
      return index === -1 ? null : index + 1;
    },
    firstDirection: "desc",
  },
];

export function prospectNameCompare(
  a: ProspectSheetRow,
  b: ProspectSheetRow,
): number {
  return `${a.lastName}${a.firstName}`.localeCompare(
    `${b.lastName}${b.firstName}`,
  );
}

/**
 * Sorted copy. `rows` arrive in the page's order (scouted overall, best
 * first), which is the "default" sort and the tie-break for every other sort.
 * Missing values (null) are always last whatever the direction.
 */
export function sortProspectRows(
  rows: readonly ProspectSheetRow[],
  columns: readonly ProspectColumn[],
  sort: SheetSort,
): ProspectSheetRow[] {
  const copy = [...rows];
  if (sort.columnId === "default") return copy;
  const position = new Map(rows.map((row, index) => [row.playerId, index]));
  const tieBreak = (a: ProspectSheetRow, b: ProspectSheetRow) =>
    (position.get(a.playerId) ?? 0) - (position.get(b.playerId) ?? 0);
  const sign = sort.direction === "asc" ? 1 : -1;
  if (sort.columnId === "name") {
    return copy.sort(
      (a, b) => sign * prospectNameCompare(a, b) || tieBreak(a, b),
    );
  }
  const column = columns.find((entry) => entry.id === sort.columnId);
  if (!column) return copy;
  return copy.sort((a, b) => {
    const left = column.sortValue(a);
    const right = column.sortValue(b);
    if (left === null && right === null) return tieBreak(a, b);
    if (left === null) return 1;
    if (right === null) return -1;
    const cmp =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return cmp !== 0 ? sign * cmp : tieBreak(a, b);
  });
}

/** One ungrouped list, in the shape the shared grid expects. */
export function ungroupedProspects(
  rows: readonly ProspectSheetRow[],
): SheetGroup<ProspectSheetRow>[] {
  return [{ id: "all", label: null, rows: [...rows] }];
}

/**
 * Pure model for the roster sheet: tab columns, sorting, grouping and the
 * "best on team" markers. No React; nothing here feeds gameplay.
 */

import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { SheetPlayerView } from "@/state/roster-sheet-view";
import { rotationRoleSortKey } from "@/state/roster-page-selectors";
import {
  SHEET_ATTRIBUTE_COLUMNS,
  SHEET_SKILL_COLUMNS,
  SHEET_STAT_COLUMNS,
  toRosterSheetRow,
} from "@/presentation/roster-sheet-columns";

export type SheetTab = "simple" | "detail" | "stats";

export type SheetColumnKind = "text" | "age" | "rating" | "stat";

export type SheetColumn = {
  id: string;
  short: string;
  long: string;
  kind: SheetColumnKind;
  get: (player: SheetPlayerView) => number | string | null;
  higherIsBetter?: boolean;
};

export type SheetSort = {
  columnId: string | "default" | "name";
  direction: "asc" | "desc";
};

export const DEFAULT_SHEET_SORT: SheetSort = {
  columnId: "default",
  direction: "desc",
};

const POSITION_ORDER = Object.fromEntries(
  PLAYER_POSITIONS.map((position, index) => [position, index]),
) as Record<string, number>;

const POS_COLUMN: SheetColumn = {
  id: "pos",
  short: "POS",
  long: "Position",
  kind: "text",
  get: (player) => player.position,
};

const AGE_COLUMN: SheetColumn = {
  id: "age",
  short: "AGE",
  long: "Age",
  kind: "age",
  get: (player) => player.age,
};

const OVR_COLUMN: SheetColumn = {
  id: "ovr",
  short: "OVR",
  long: "Overall",
  kind: "rating",
  get: (player) => player.overall,
  higherIsBetter: true,
};

const POT_COLUMN: SheetColumn = {
  id: "pot",
  short: "POT",
  long: "Potential",
  kind: "rating",
  get: (player) => player.potential,
  higherIsBetter: true,
};

const SIMPLE_COLUMNS: readonly SheetColumn[] = [
  POS_COLUMN,
  AGE_COLUMN,
  OVR_COLUMN,
  ...SHEET_SKILL_COLUMNS.map((column): SheetColumn => ({
    id: column.key,
    short: column.short,
    long: column.long,
    kind: "rating",
    get: (player) => toRosterSheetRow(player)[column.key],
    higherIsBetter: true,
  })),
  POT_COLUMN,
];

const DETAIL_COLUMNS: readonly SheetColumn[] = [
  POS_COLUMN,
  OVR_COLUMN,
  ...SHEET_ATTRIBUTE_COLUMNS.map((column): SheetColumn => ({
    id: column.key,
    short: column.short,
    long: column.long,
    kind: "rating",
    get: (player) => player.attributes[column.key],
    higherIsBetter: true,
  })),
];

const STATS_COLUMNS: readonly SheetColumn[] = [
  POS_COLUMN,
  OVR_COLUMN,
  ...SHEET_STAT_COLUMNS.map((column): SheetColumn => ({
    id: column.key,
    short: column.short,
    long: column.long,
    kind: "stat",
    get: (player) => player.performance[column.key],
    higherIsBetter: true,
  })),
];

const TAB_COLUMNS: Record<SheetTab, readonly SheetColumn[]> = {
  simple: SIMPLE_COLUMNS,
  detail: DETAIL_COLUMNS,
  stats: STATS_COLUMNS,
};

export function sheetColumns(tab: SheetTab): readonly SheetColumn[] {
  return TAB_COLUMNS[tab];
}

/**
 * Existing roster order: rotation role, then overall (high first), position,
 * last name. Mirrors the role-first ordering the roster page already uses
 * (RosterManagementTable keeps its own private copy with overall first;
 * the sheet groups by role, so role leads here).
 */
export function defaultSheetCompare(
  a: SheetPlayerView,
  b: SheetPlayerView,
): number {
  if (a.rotationRole != null && b.rotationRole != null) {
    const roleCmp =
      rotationRoleSortKey(a.rotationRole) - rotationRoleSortKey(b.rotationRole);
    if (roleCmp !== 0) return roleCmp;
  } else {
    // Rows without a role (market lists): overall, then name.
    return tieBreak(a, b);
  }
  if (b.overall !== a.overall) return b.overall - a.overall;
  const posCmp =
    (POSITION_ORDER[a.primaryPosition] ?? 99) -
    (POSITION_ORDER[b.primaryPosition] ?? 99);
  if (posCmp !== 0) return posCmp;
  return a.lastName.localeCompare(b.lastName);
}

function nameCompare(a: SheetPlayerView, b: SheetPlayerView): number {
  return `${a.lastName}${a.firstName}`.localeCompare(
    `${b.lastName}${b.firstName}`,
  );
}

/** Overall high first, then name: the tie-break for every column sort. */
function tieBreak(a: SheetPlayerView, b: SheetPlayerView): number {
  if (b.overall !== a.overall) return b.overall - a.overall;
  return nameCompare(a, b);
}

function compareValues(
  a: number | string,
  b: number | string,
  kind: SheetColumnKind,
): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const left = String(a);
  const right = String(b);
  if (kind === "text") {
    const leftOrder = POSITION_ORDER[left];
    const rightOrder = POSITION_ORDER[right];
    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
  }
  return left.localeCompare(right);
}

/**
 * Sorted copy. Missing values (null) are always last whatever the direction;
 * ties fall back to overall (high first) then name.
 */
export function sortSheetRows<T extends SheetPlayerView>(
  rows: readonly T[],
  columns: readonly SheetColumn[],
  sort: SheetSort,
): T[] {
  const copy = [...rows];
  if (sort.columnId === "default") return copy.sort(defaultSheetCompare);
  const sign = sort.direction === "asc" ? 1 : -1;
  if (sort.columnId === "name") {
    return copy.sort((a, b) => sign * nameCompare(a, b) || tieBreak(a, b));
  }
  const column = columns.find((entry) => entry.id === sort.columnId);
  if (!column) return copy.sort(defaultSheetCompare);
  return copy.sort((a, b) => {
    const left = column.get(a);
    const right = column.get(b);
    if (left === null && right === null) return tieBreak(a, b);
    if (left === null) return 1;
    if (right === null) return -1;
    const cmp = compareValues(left, right, column.kind);
    return cmp !== 0 ? sign * cmp : tieBreak(a, b);
  });
}

export type SheetGroup<T extends SheetPlayerView = SheetPlayerView> = {
  id: "starters" | "rotation" | "bench" | "all";
  /** Null for the single ungrouped list. */
  label: string | null;
  rows: T[];
};

const GROUPS: ReadonlyArray<{
  id: "starters" | "rotation" | "bench";
  label: string;
  roles: ReadonlyArray<NonNullable<SheetPlayerView["rotationRole"]>>;
}> = [
  { id: "starters", label: "Starters", roles: ["starter"] },
  { id: "rotation", label: "Rotation", roles: ["sixth_man", "rotation"] },
  {
    id: "bench",
    label: "Bench",
    roles: ["bench", "deep_bench", "emergency"],
  },
];

/**
 * Starters / Rotation / Bench groups, only for the default sort (rows must
 * already be sorted). Any other sort is one ungrouped list. Empty groups are
 * omitted.
 */
export function groupSheetRows<T extends SheetPlayerView>(
  rows: readonly T[],
  sort: SheetSort,
): SheetGroup<T>[] {
  if (
    sort.columnId !== "default" ||
    !rows.some((row) => row.rotationRole != null)
  ) {
    return [{ id: "all", label: null, rows: [...rows] }];
  }
  return GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    rows: rows.filter(
      (row) =>
        row.rotationRole != null && group.roles.includes(row.rotationRole),
    ),
  })).filter((group) => group.rows.length > 0);
}

/**
 * Per rating or stat column, the players holding the highest value (ties all
 * marked). GP is a count, not a quality, and is never marked. Columns with
 * fewer than two values or all-equal values have no best.
 */
export function bestInColumn(
  rows: readonly SheetPlayerView[],
  columns: readonly SheetColumn[],
): Map<string, Set<string>> {
  const best = new Map<string, Set<string>>();
  for (const column of columns) {
    if (column.kind !== "rating" && column.kind !== "stat") continue;
    if (column.id === "games") continue;
    const values: Array<{ id: string; value: number }> = [];
    for (const row of rows) {
      const value = column.get(row);
      if (typeof value === "number") values.push({ id: row.playerId, value });
    }
    if (values.length < 2) continue;
    const max = Math.max(...values.map((entry) => entry.value));
    const min = Math.min(...values.map((entry) => entry.value));
    if (max === min) continue;
    best.set(
      column.id,
      new Set(
        values.filter((entry) => entry.value === max).map((entry) => entry.id),
      ),
    );
  }
  return best;
}

/**
 * The column id the Left/Right keys move the sort to. Wraps at the ends; from
 * the default (or name) sort, Right starts at the first column and Left at
 * the last.
 */
export function moveSortColumn(
  columns: readonly SheetColumn[],
  sort: SheetSort,
  delta: -1 | 1,
): string {
  const index = columns.findIndex((column) => column.id === sort.columnId);
  if (index === -1) {
    return (delta === 1 ? columns[0] : columns[columns.length - 1])!.id;
  }
  return columns[(index + delta + columns.length) % columns.length]!.id;
}

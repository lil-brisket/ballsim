import { describe, expect, it } from "vitest";
import {
  bestInColumn,
  groupSheetRows,
  moveSortColumn,
  sheetColumns,
  sortSheetRows,
  type SheetSort,
} from "@/presentation/roster-sheet-model";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import { createRosterPagePlayer } from "../factories/roster-page-player";

const DEFAULT: SheetSort = { columnId: "default", direction: "desc" };

function player(
  id: string,
  overrides: Partial<RosterPagePlayerView> = {},
): RosterPagePlayerView {
  return createRosterPagePlayer({
    playerId: id,
    firstName: "F",
    lastName: id,
    ...overrides,
  });
}

function ids(rows: RosterPagePlayerView[]): string[] {
  return rows.map((row) => row.playerId);
}

describe("sheet columns", () => {
  it("lists the simple tab", () => {
    expect(sheetColumns("simple").map((c) => c.short)).toEqual([
      "POS",
      "AGE",
      "OVR",
      "INS",
      "MID",
      "3PT",
      "INT D",
      "PER D",
      "PLAY",
      "REB",
      "ATHL",
      "IQ",
      "POT",
    ]);
  });

  it("lists POS, OVR and 19 attributes on detail", () => {
    const columns = sheetColumns("detail");
    expect(columns).toHaveLength(21);
    expect(columns.slice(0, 2).map((c) => c.id)).toEqual(["pos", "ovr"]);
    expect(new Set(columns.map((c) => c.id)).size).toBe(21);
  });

  it("lists POS, OVR and 10 stats on stats, null without games", () => {
    const columns = sheetColumns("stats");
    expect(columns).toHaveLength(12);
    const ppg = columns.find((c) => c.id === "ppg")!;
    expect(ppg.get(player("a"))).toBeNull();
    expect(columns.find((c) => c.id === "games")!.get(player("a"))).toBe(0);
  });
});

describe("sortSheetRows", () => {
  const simple = sheetColumns("simple");

  it("default sort is role, overall desc, position, last name", () => {
    const rows = [
      player("bench", { rotationRole: "bench", overall: 90 }),
      player("s2", { overall: 70 }),
      player("s1", { overall: 80 }),
    ];
    expect(ids(sortSheetRows(rows, simple, DEFAULT))).toEqual([
      "s1",
      "s2",
      "bench",
    ]);
  });

  it("sorts rating columns both ways", () => {
    const rows = [
      player("a", { overall: 60 }),
      player("b", { overall: 80 }),
      player("c", { overall: 70 }),
    ];
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "ovr", direction: "desc" })),
    ).toEqual(["b", "c", "a"]);
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "ovr", direction: "asc" })),
    ).toEqual(["a", "c", "b"]);
  });

  it("sorts age and name", () => {
    const rows = [
      player("b", { age: 30 }),
      player("a", { age: 20 }),
      player("c", { age: 25 }),
    ];
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "age", direction: "asc" })),
    ).toEqual(["a", "c", "b"]);
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "name", direction: "asc" })),
    ).toEqual(["a", "b", "c"]);
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "name", direction: "desc" })),
    ).toEqual(["c", "b", "a"]);
  });

  it("sorts position text in court order", () => {
    const rows = [
      player("c", { position: "C" }),
      player("pg", { position: "PG" }),
      player("sf", { position: "SF" }),
    ];
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "pos", direction: "asc" })),
    ).toEqual(["pg", "sf", "c"]);
  });

  it("puts missing stats last in both directions", () => {
    const stats = sheetColumns("stats");
    const perf = (ppg: number | null) => ({
      ...player("x").performance,
      games: ppg === null ? 0 : 10,
      ppg,
    });
    const rows = [
      player("none", { performance: perf(null) }),
      player("low", { performance: perf(5) }),
      player("high", { performance: perf(20) }),
    ];
    expect(
      ids(sortSheetRows(rows, stats, { columnId: "ppg", direction: "desc" })),
    ).toEqual(["high", "low", "none"]);
    expect(
      ids(sortSheetRows(rows, stats, { columnId: "ppg", direction: "asc" })),
    ).toEqual(["low", "high", "none"]);
  });

  it("breaks ties by overall desc then name", () => {
    const rows = [
      player("b", { age: 25, overall: 70 }),
      player("a", { age: 25, overall: 70 }),
      player("z", { age: 25, overall: 80 }),
    ];
    expect(
      ids(sortSheetRows(rows, simple, { columnId: "age", direction: "asc" })),
    ).toEqual(["z", "a", "b"]);
  });
});

describe("groupSheetRows", () => {
  const rows = [
    player("s", { rotationRole: "starter" }),
    player("sx", { rotationRole: "sixth_man" }),
    player("r", { rotationRole: "rotation" }),
    player("b", { rotationRole: "bench" }),
    player("d", { rotationRole: "deep_bench" }),
    player("e", { rotationRole: "emergency" }),
  ];

  it("groups the default sort", () => {
    const groups = groupSheetRows(rows, DEFAULT);
    expect(groups.map((g) => g.label)).toEqual([
      "Starters",
      "Rotation",
      "Bench",
    ]);
    expect(groups.map((g) => ids(g.rows))).toEqual([
      ["s"],
      ["sx", "r"],
      ["b", "d", "e"],
    ]);
  });

  it("omits empty groups", () => {
    const groups = groupSheetRows([rows[0]!], DEFAULT);
    expect(groups.map((g) => g.label)).toEqual(["Starters"]);
  });

  it("returns one ungrouped list for any other sort", () => {
    const groups = groupSheetRows(rows, { columnId: "ovr", direction: "desc" });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBeNull();
    expect(groups[0]!.rows).toHaveLength(6);
  });
});

describe("bestInColumn", () => {
  const simple = sheetColumns("simple");

  it("marks the highest rating", () => {
    const best = bestInColumn(
      [player("a", { overall: 70 }), player("b", { overall: 80 })],
      simple,
    );
    expect([...best.get("ovr")!]).toEqual(["b"]);
  });

  it("marks every tied leader", () => {
    const best = bestInColumn(
      [
        player("a", { overall: 80 }),
        player("b", { overall: 80 }),
        player("c", { overall: 60 }),
      ],
      simple,
    );
    expect([...best.get("ovr")!].sort()).toEqual(["a", "b"]);
  });

  it("marks nothing when all equal, with one row, or for age and text", () => {
    const equal = bestInColumn(
      [player("a", { age: 20 }), player("b", { age: 30 })],
      simple,
    );
    expect(equal.has("ovr")).toBe(false);
    expect(equal.has("age")).toBe(false);
    expect(equal.has("pos")).toBe(false);
    expect(bestInColumn([player("a")], simple).size).toBe(0);
  });

  it("skips GP and missing stat values", () => {
    const stats = sheetColumns("stats");
    const withGames = (games: number, ppg: number | null) =>
      player(`g${games}`, {
        performance: { ...player("x").performance, games, ppg },
      });
    const best = bestInColumn(
      [withGames(10, 20), withGames(50, 10), withGames(0, null)],
      stats,
    );
    expect(best.has("games")).toBe(false);
    expect([...best.get("ppg")!]).toEqual(["g10"]);
  });
});

describe("moveSortColumn", () => {
  const columns = sheetColumns("simple");
  const at = (columnId: string): SheetSort => ({ columnId, direction: "desc" });

  it("starts at the first or last column from default", () => {
    expect(moveSortColumn(columns, DEFAULT, 1)).toBe("pos");
    expect(moveSortColumn(columns, DEFAULT, -1)).toBe("pot");
  });

  it("moves to neighbours", () => {
    expect(moveSortColumn(columns, at("ovr"), 1)).toBe("ins");
    expect(moveSortColumn(columns, at("ovr"), -1)).toBe("age");
  });

  it("wraps at both ends", () => {
    expect(moveSortColumn(columns, at("pot"), 1)).toBe("pos");
    expect(moveSortColumn(columns, at("pos"), -1)).toBe("pot");
  });
});

/**
 * Pure helpers for the Statistics tab: line selection, per-game vs total
 * formatting, game-series metrics and season-table sorting. No React.
 */

import type { PlayerStatLine } from "@/domain/player-stat-aggregation";
import type {
  PlayerGameSeriesPoint,
  PlayerSeasonStatsView,
} from "@/state/player-profile-selectors";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";
import { EMPTY_VALUE, percent } from "./format";

export type StatScope = "season" | "career";
export type StatSplit = "regular" | "playoffs" | "development";
export type StatMode = "perGame" | "totals";

export const SPLIT_LABELS: Record<StatSplit, string> = {
  regular: "Regular season",
  playoffs: "Playoffs",
  development: "Development League",
};

type Stats = PlayerDrawerView["stats"];

export function selectLine(
  stats: Stats,
  scope: StatScope,
  seasonId: string | null,
  split: StatSplit,
): PlayerStatLine | null {
  if (scope === "career") return stats.career[split];
  const season = stats.seasons.find((s) => s.seasonId === seasonId);
  return season ? season[split] : null;
}

export function availableSplits(
  stats: Stats,
  scope: StatScope,
  seasonId: string | null,
): StatSplit[] {
  const splits: StatSplit[] = ["regular"];
  for (const split of ["playoffs", "development"] as const) {
    const line = selectLine(stats, scope, seasonId, split);
    if (line && line.games > 0) splits.push(split);
  }
  return splits;
}

export function defaultSeasonId(
  seasons: PlayerSeasonStatsView[],
): string | null {
  if (seasons.length === 0) return null;
  return (seasons.find((s) => s.current) ?? seasons[seasons.length - 1])
    .seasonId;
}

export function seasonOptionLabel(season: PlayerSeasonStatsView): string {
  return season.current
    ? `${season.seasonYear} (current)`
    : `${season.seasonYear}`;
}

// ---- value formatting ------------------------------------------------------

export function formatCount(
  total: number,
  games: number,
  mode: StatMode,
): string {
  if (mode === "totals") return String(total);
  if (games <= 0) return EMPTY_VALUE;
  return (total / games).toFixed(1);
}

function pctLabel(made: number, attempted: number): string {
  const value = percent(made, attempted);
  return value === EMPTY_VALUE ? value : `${value}%`;
}

function shooting(
  made: number,
  attempted: number,
  games: number,
  mode: StatMode,
): string {
  return `${formatCount(made, games, mode)}–${formatCount(attempted, games, mode)}`;
}

export type StatItem = { key: string; label: string; value: string };
export type StatGroup = { title: string; items: StatItem[] };

/** Columns the season-summary snapshots cannot supply. */
const EXTENDED_KEYS = new Set(["gs", "orb", "drb", "pf", "dd", "td"]);

export type ExtendedMode = "complete" | "unavailable" | "partial";

export function buildStatGroups(
  line: PlayerStatLine,
  mode: StatMode,
  extended: ExtendedMode,
): StatGroup[] {
  const g = line.games;
  const pg = mode === "perGame";
  const c = (total: number) => formatCount(total, g, mode);
  const label = (perGame: string, total: string) => (pg ? perGame : total);
  const groups: StatGroup[] = [
    {
      title: "Playing time",
      items: [
        { key: "gp", label: "GP", value: String(g) },
        { key: "gs", label: "GS", value: String(line.gamesStarted) },
        {
          key: "min",
          label: label("MPG", "MIN"),
          value: c(line.minutes),
        },
      ],
    },
    {
      title: "Scoring",
      items: [
        { key: "pts", label: label("PPG", "PTS"), value: c(line.points) },
        {
          key: "fg",
          label: "FGM–FGA",
          value: shooting(line.fgMade, line.fgAttempted, g, mode),
        },
        {
          key: "fgp",
          label: "FG%",
          value: pctLabel(line.fgMade, line.fgAttempted),
        },
        {
          key: "3p",
          label: "3PM–3PA",
          value: shooting(line.threeMade, line.threeAttempted, g, mode),
        },
        {
          key: "3pp",
          label: "3P%",
          value: pctLabel(line.threeMade, line.threeAttempted),
        },
        {
          key: "ft",
          label: "FTM–FTA",
          value: shooting(line.ftMade, line.ftAttempted, g, mode),
        },
        {
          key: "ftp",
          label: "FT%",
          value: pctLabel(line.ftMade, line.ftAttempted),
        },
      ],
    },
    {
      title: "Rebounding",
      items: [
        {
          key: "orb",
          label: label("ORPG", "ORB"),
          value: c(line.offensiveRebounds),
        },
        {
          key: "drb",
          label: label("DRPG", "DRB"),
          value: c(line.defensiveRebounds),
        },
        { key: "reb", label: label("RPG", "REB"), value: c(line.rebounds) },
      ],
    },
    {
      title: "Playmaking",
      items: [
        { key: "ast", label: label("APG", "AST"), value: c(line.assists) },
        { key: "tov", label: label("TOPG", "TOV"), value: c(line.turnovers) },
      ],
    },
    {
      title: "Defense",
      items: [
        { key: "stl", label: label("SPG", "STL"), value: c(line.steals) },
        { key: "blk", label: label("BPG", "BLK"), value: c(line.blocks) },
      ],
    },
    {
      title: "Other",
      items: [
        { key: "pf", label: label("PFPG", "PF"), value: c(line.fouls) },
        {
          key: "dd",
          label: "Double-doubles",
          value: String(line.doubleDoubles),
        },
        {
          key: "td",
          label: "Triple-doubles",
          value: String(line.tripleDoubles),
        },
      ],
    },
  ];
  if (extended === "complete") return groups;
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (!EXTENDED_KEYS.has(item.key)) return item;
      return extended === "unavailable"
        ? { ...item, value: EMPTY_VALUE }
        : { ...item, value: `${item.value}†` };
    }),
  }));
}

// ---- chart metrics ---------------------------------------------------------

export type MetricKey =
  "ppg" | "rpg" | "apg" | "spg" | "bpg" | "mpg" | "fg" | "three" | "ft";

export type MetricDef = {
  key: MetricKey;
  label: string;
  kind: "count" | "pct";
};

export const METRICS: readonly MetricDef[] = [
  { key: "ppg", label: "PPG", kind: "count" },
  { key: "rpg", label: "RPG", kind: "count" },
  { key: "apg", label: "APG", kind: "count" },
  { key: "spg", label: "SPG", kind: "count" },
  { key: "bpg", label: "BPG", kind: "count" },
  { key: "mpg", label: "MPG", kind: "count" },
  { key: "fg", label: "FG%", kind: "pct" },
  { key: "three", label: "3P%", kind: "pct" },
  { key: "ft", label: "FT%", kind: "pct" },
];

export function metricDef(key: MetricKey): MetricDef {
  return METRICS.find((m) => m.key === key) ?? METRICS[0];
}

type Countable = Pick<
  PlayerGameSeriesPoint,
  | "minutes"
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "fgMade"
  | "fgAttempted"
  | "threeMade"
  | "threeAttempted"
  | "ftMade"
  | "ftAttempted"
>;

function countOf(row: Countable, key: MetricKey): number {
  switch (key) {
    case "ppg":
      return row.points;
    case "rpg":
      return row.rebounds;
    case "apg":
      return row.assists;
    case "spg":
      return row.steals;
    case "bpg":
      return row.blocks;
    default:
      return row.minutes;
  }
}

function pctPartsOf(
  row: Countable,
  key: MetricKey,
): { made: number; attempted: number } {
  if (key === "fg") return { made: row.fgMade, attempted: row.fgAttempted };
  if (key === "three")
    return { made: row.threeMade, attempted: row.threeAttempted };
  return { made: row.ftMade, attempted: row.ftAttempted };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** A line's aggregate metric (per-game average or shooting %), or null. */
export function lineMetricValue(
  line: PlayerStatLine,
  key: MetricKey,
): number | null {
  const def = metricDef(key);
  if (def.kind === "count") {
    if (line.games <= 0) return null;
    return round1(countOf(line, key) / line.games);
  }
  const { made, attempted } = pctPartsOf(line, key);
  return attempted > 0 ? round1((made / attempted) * 100) : null;
}

export type GameChartPoint = {
  game: number;
  date: string;
  opponent: string;
  /** Count metrics: that game's value. Null for percentage metrics. */
  value: number | null;
  /** Count: running average. Percentage: running season-to-date %. */
  toDate: number | null;
};

export function gameSeriesPoints(
  games: PlayerGameSeriesPoint[],
  split: StatSplit,
  key: MetricKey,
): GameChartPoint[] {
  if (split === "development") return [];
  const def = metricDef(key);
  const filtered = games.filter((g) => g.bucket === split);
  const points: GameChartPoint[] = [];
  let total = 0;
  let made = 0;
  let attempted = 0;
  filtered.forEach((game, index) => {
    const base = {
      game: index + 1,
      date: game.date,
      opponent: game.opponentAbbreviation,
    };
    if (def.kind === "count") {
      const value = countOf(game, key);
      total += value;
      points.push({
        ...base,
        value,
        toDate: round1(total / (index + 1)),
      });
      return;
    }
    const parts = pctPartsOf(game, key);
    made += parts.made;
    attempted += parts.attempted;
    if (attempted > 0) {
      points.push({
        ...base,
        value: null,
        toDate: round1((made / attempted) * 100),
      });
    }
  });
  return points;
}

export type SeasonChartPoint = { seasonYear: number; value: number };

export function seasonSeriesPoints(
  seasons: PlayerSeasonStatsView[],
  split: StatSplit,
  key: MetricKey,
): SeasonChartPoint[] {
  const points: SeasonChartPoint[] = [];
  for (const season of seasons) {
    const line = season[split];
    if (line.games <= 0) continue;
    const value = lineMetricValue(line, key);
    if (value != null) points.push({ seasonYear: season.seasonYear, value });
  }
  return points;
}

// ---- career seasons table --------------------------------------------------

export type SeasonRow = {
  seasonId: string;
  seasonYear: number;
  current: boolean;
  age: number | null;
  line: PlayerStatLine;
};

export function seasonRows(
  seasons: PlayerSeasonStatsView[],
  split: StatSplit,
): SeasonRow[] {
  return seasons
    .filter((s) => s[split].games > 0)
    .map((s) => ({
      seasonId: s.seasonId,
      seasonYear: s.seasonYear,
      current: s.current,
      age: s.age,
      line: s[split],
    }));
}

export type SeasonColumn = {
  key: string;
  label: string;
  /** Numeric sort key (null sorts last). */
  sortValue: (row: SeasonRow) => number | null;
  display: (row: SeasonRow, mode: StatMode) => string;
};

function countColumn(
  key: string,
  label: string,
  pick: (line: PlayerStatLine) => number,
): SeasonColumn {
  return {
    key,
    label,
    sortValue: (row) => pick(row.line) / Math.max(1, row.line.games),
    display: (row, mode) => formatCount(pick(row.line), row.line.games, mode),
  };
}

function pctColumn(
  key: string,
  label: string,
  made: (l: PlayerStatLine) => number,
  attempted: (l: PlayerStatLine) => number,
): SeasonColumn {
  return {
    key,
    label,
    sortValue: (row) =>
      attempted(row.line) > 0 ? made(row.line) / attempted(row.line) : null,
    display: (row) => pctLabel(made(row.line), attempted(row.line)),
  };
}

export function seasonColumns(mode: StatMode): SeasonColumn[] {
  const lead: SeasonColumn[] = [
    {
      key: "season",
      label: "Season",
      sortValue: (row) => row.seasonYear,
      display: (row) => `${row.seasonYear}${row.current ? "*" : ""}`,
    },
    {
      key: "age",
      label: "Age",
      sortValue: (row) => row.age,
      display: (row) => (row.age == null ? EMPTY_VALUE : String(row.age)),
    },
    {
      key: "gp",
      label: "GP",
      sortValue: (row) => row.line.games,
      display: (row) => String(row.line.games),
    },
  ];
  if (mode === "perGame") {
    return [
      ...lead,
      countColumn("mpg", "MPG", (l) => l.minutes),
      countColumn("ppg", "PPG", (l) => l.points),
      countColumn("rpg", "RPG", (l) => l.rebounds),
      countColumn("apg", "APG", (l) => l.assists),
      countColumn("spg", "SPG", (l) => l.steals),
      countColumn("bpg", "BPG", (l) => l.blocks),
      pctColumn(
        "fgp",
        "FG%",
        (l) => l.fgMade,
        (l) => l.fgAttempted,
      ),
      pctColumn(
        "3pp",
        "3P%",
        (l) => l.threeMade,
        (l) => l.threeAttempted,
      ),
      pctColumn(
        "ftp",
        "FT%",
        (l) => l.ftMade,
        (l) => l.ftAttempted,
      ),
    ];
  }
  const shoot = (
    key: string,
    label: string,
    made: (l: PlayerStatLine) => number,
    attempted: (l: PlayerStatLine) => number,
  ): SeasonColumn => ({
    key,
    label,
    sortValue: (row) => made(row.line),
    display: (row) => `${made(row.line)}-${attempted(row.line)}`,
  });
  return [
    ...lead,
    countColumn("min", "MIN", (l) => l.minutes),
    countColumn("pts", "PTS", (l) => l.points),
    countColumn("reb", "REB", (l) => l.rebounds),
    countColumn("ast", "AST", (l) => l.assists),
    countColumn("stl", "STL", (l) => l.steals),
    countColumn("blk", "BLK", (l) => l.blocks),
    shoot(
      "fg",
      "FGM-FGA",
      (l) => l.fgMade,
      (l) => l.fgAttempted,
    ),
    shoot(
      "3p",
      "3PM-3PA",
      (l) => l.threeMade,
      (l) => l.threeAttempted,
    ),
    shoot(
      "ft",
      "FTM-FTA",
      (l) => l.ftMade,
      (l) => l.ftAttempted,
    ),
  ];
}

/**
 * Totals-mode count columns sort by the raw total, not the per-game rate.
 */
export function sortValueFor(
  column: SeasonColumn,
  row: SeasonRow,
  mode: StatMode,
): number | null {
  if (mode === "totals" && column.key !== "season" && column.key !== "age") {
    const totals: Record<string, number> = {
      gp: row.line.games,
      min: row.line.minutes,
      pts: row.line.points,
      reb: row.line.rebounds,
      ast: row.line.assists,
      stl: row.line.steals,
      blk: row.line.blocks,
    };
    if (column.key in totals) return totals[column.key];
  }
  return column.sortValue(row);
}

export function sortSeasonRows(
  rows: SeasonRow[],
  column: SeasonColumn,
  direction: "asc" | "desc",
  mode: StatMode,
): SeasonRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValueFor(column, a, mode);
    const bv = sortValueFor(column, b, mode);
    if (av == null && bv == null) return a.seasonYear - b.seasonYear;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av === bv) return a.seasonYear - b.seasonYear;
    return (av - bv) * factor;
  });
}

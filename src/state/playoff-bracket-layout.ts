/**
 * Pure bracket layout for the Playoffs page: which column and which vertical
 * position each series gets, and which series connect. Lines follow
 * `feederSeriesIds` only; they are never inferred from slots.
 *
 * Vertical positions (`rowOf`) are in row units, where one unit is the height
 * of one slot card plus its gap:
 * - an opening (feeder-less) series takes the next integer row on its side,
 *   walking the tree in feeder order so the tree is planar;
 * - a series with two feeders sits at the midpoint of their rows;
 * - a bye series (one feeder plus a bye team) sits half a row ABOVE its
 *   feeder: the bye team is the higher seed and is drawn on top, and the half
 *   row keeps the two cards from overlapping in neighbouring columns.
 * Rows are shifted so the smallest is 0, so they may end in .5.
 *
 * Two-conference brackets are drawn as a mirrored tree: the first conference
 * on the left (round 1 at the far left), the cross-conference rounds in the
 * centre, the second conference on the right with its latest round nearest
 * the centre. Columns are listed in visual left-to-right order. Every other
 * bracket is one left-to-right tree in round order; its final round is
 * "center".
 */

import type {
  PlayoffHubView,
  PlayoffRoundView,
  PlayoffSeriesView,
} from "@/state/playoff-hub-selectors";

export type BracketSide = "left" | "right" | "center";

export type BracketColumn = {
  key: string;
  label: string;
  side: BracketSide;
  round: number;
  /** Conference the column belongs to; null in the centre and league-wide. */
  conferenceName: string | null;
  /** Top to bottom. */
  seriesIds: string[];
};

export type BracketEdge = { fromSeriesId: string; toSeriesId: string };

export type BracketLayout = {
  columns: BracketColumn[];
  edges: BracketEdge[];
  rowOf: Record<string, number>;
  rowCount: number;
};

function column(
  side: BracketSide,
  round: PlayoffRoundView,
  conferenceName: string | null,
): BracketColumn {
  return {
    key: `${side}-r${round.round}`,
    label: round.label,
    side,
    round: round.round,
    conferenceName,
    seriesIds: round.series.map((series) => series.id),
  };
}

export function layoutBracket(hub: PlayoffHubView): BracketLayout {
  const seriesById = new Map<string, PlayoffSeriesView>();
  for (const round of hub.rounds) {
    for (const series of round.series) seriesById.set(series.id, series);
  }

  const mirrored =
    hub.isConferenceBracket &&
    hub.conferenceSections.length === 2 &&
    hub.crossConferenceRounds.length > 0;

  const columns: BracketColumn[] = [];
  const sideOf = new Map<string, BracketSide>();
  if (mirrored) {
    const [first, second] = hub.conferenceSections as [
      (typeof hub.conferenceSections)[number],
      (typeof hub.conferenceSections)[number],
    ];
    for (const round of first.rounds) {
      columns.push(column("left", round, first.conferenceName));
    }
    for (const round of hub.crossConferenceRounds) {
      columns.push(column("center", round, null));
    }
    for (const round of [...second.rounds].reverse()) {
      columns.push(column("right", round, second.conferenceName));
    }
  } else {
    const lastRound = hub.rounds.length - 1;
    hub.rounds.forEach((round, index) => {
      columns.push(
        column(index === lastRound ? "center" : "left", round, null),
      );
    });
  }
  for (const col of columns) {
    for (const id of col.seriesIds) sideOf.set(id, col.side);
  }

  const edges: BracketEdge[] = [];
  const feedsSomething = new Set<string>();
  for (const round of hub.rounds) {
    for (const series of round.series) {
      for (const feeder of series.feederSeriesIds) {
        if (!seriesById.has(feeder)) continue;
        edges.push({ fromSeriesId: feeder, toSeriesId: series.id });
        feedsSomething.add(feeder);
      }
    }
  }

  const rowOf: Record<string, number> = {};
  const nextRow: Record<BracketSide, number> = {
    left: 0,
    right: 0,
    center: 0,
  };
  const visiting = new Set<string>();
  const assign = (id: string): number => {
    const known = rowOf[id];
    if (known !== undefined) return known;
    // Corrupt data with a feeder cycle: treat the repeat as the top row.
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const series = seriesById.get(id)!;
    const feeders = series.feederSeriesIds
      .filter((feeder) => seriesById.has(feeder))
      .sort((a, b) => seriesById.get(a)!.slot - seriesById.get(b)!.slot);
    let row: number;
    if (feeders.length === 0) {
      // Centre leaves only occur in malformed data; use the left counter so
      // they still get a unique row.
      const side = sideOf.get(id) ?? "left";
      const counter = side === "right" ? "right" : "left";
      row = nextRow[counter];
      nextRow[counter] += 1;
    } else {
      const rows = feeders.map(assign);
      row =
        rows.length === 1
          ? rows[0]! - (series.bye ? 0.5 : 0)
          : rows.reduce((sum, value) => sum + value, 0) / rows.length;
    }
    visiting.delete(id);
    rowOf[id] = row;
    return row;
  };

  const roots = [...seriesById.values()]
    .filter((series) => !feedsSomething.has(series.id))
    .sort((a, b) => b.round - a.round || a.slot - b.slot);
  for (const root of roots) assign(root.id);
  // Series reachable from no root (cycles in corrupt data) still get a row.
  for (const id of seriesById.keys()) assign(id);

  const rows = Object.values(rowOf);
  const min = rows.length > 0 ? Math.min(...rows) : 0;
  for (const id of Object.keys(rowOf)) rowOf[id] = rowOf[id]! - min;
  const max = rows.length > 0 ? Math.max(...rows) - min : -1;

  for (const col of columns) {
    col.seriesIds.sort((a, b) => rowOf[a]! - rowOf[b]!);
  }

  return { columns, edges, rowOf, rowCount: Math.ceil(max + 1) };
}

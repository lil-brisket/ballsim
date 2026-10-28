import { describe, expect, it } from "vitest";
import type { GameState } from "@/state/game-state";
import { layoutBracket } from "@/state/playoff-bracket-layout";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import {
  conferenceBracketState,
  leagueWideState,
} from "./playoff-bracket-fixtures";

function build(state: GameState) {
  const hub = toPlayoffHubView(state);
  return { hub, layout: layoutBracket(hub) };
}

/** Structural invariants every bracket layout must satisfy. */
function expectSoundLayout(state: GameState) {
  const { hub, layout } = build(state);
  const series = state.competition.playoffs.series;

  // Edges are exactly the (feeder -> series) pairs; nothing inferred.
  const expected = series
    .flatMap((s) =>
      (s.feederSeriesIds ?? []).map((feeder) => `${feeder}>${s.id}`),
    )
    .sort();
  const actual = layout.edges
    .map((edge) => `${edge.fromSeriesId}>${edge.toSeriesId}`)
    .sort();
  expect(actual).toEqual(expected);

  // Each series sits in exactly one column.
  const placed = layout.columns.flatMap((column) => column.seriesIds).sort();
  expect(placed).toEqual(series.map((s) => s.id).sort());

  // Target rows are the feeders' midpoint, or half a row above a lone feeder
  // when the series has a bye team.
  for (const s of series) {
    const feeders = (s.feederSeriesIds ?? []).map((id) => layout.rowOf[id]!);
    const row = layout.rowOf[s.id]!;
    if (feeders.length === 2) {
      expect(row).toBeGreaterThanOrEqual(Math.min(...feeders));
      expect(row).toBeLessThanOrEqual(Math.max(...feeders));
      expect(row).toBe((feeders[0]! + feeders[1]!) / 2);
    } else if (feeders.length === 1) {
      expect(row).toBe(feeders[0]! - (s.byeParticipant ? 0.5 : 0));
    }
  }

  // No two series share a row within a column; columns list top to bottom.
  for (const column of layout.columns) {
    const rows = column.seriesIds.map((id) => layout.rowOf[id]!);
    expect(new Set(rows).size).toBe(rows.length);
    expect([...rows].sort((a, b) => a - b)).toEqual(rows);
  }
  for (const row of Object.values(layout.rowOf)) {
    expect(row).toBeGreaterThanOrEqual(0);
    expect(row).toBeLessThan(layout.rowCount);
  }

  // Pure and deterministic.
  expect(layoutBracket(hub)).toEqual(layout);
  return { hub, layout };
}

function rowsOf(layout: ReturnType<typeof layoutBracket>, column: number) {
  return layout.columns[column]!.seriesIds.map((id) => layout.rowOf[id]);
}

describe("layoutBracket league-wide", () => {
  it.each([
    [8, [4, 2, 1]],
    [16, [8, 4, 2, 1]],
  ])("lays out a %i-team bracket as one tree", (field, sizes) => {
    const { layout } = expectSoundLayout(
      leagueWideState(1, 16, field, `layout-lw-${field}`),
    );
    expect(layout.columns.map((c) => c.seriesIds.length)).toEqual(sizes);
    expect(layout.columns.map((c) => c.side)).toEqual([
      ...sizes.slice(1).map(() => "left"),
      "center",
    ]);
    expect(layout.columns.map((c) => c.round)).toEqual(sizes.map((_, i) => i));
    expect(layout.rowCount).toBe(field / 2);
    // Opening series take consecutive integer rows.
    expect(rowsOf(layout, 0)).toEqual(
      Array.from({ length: field / 2 }, (_, i) => i),
    );
  });

  it("places each later series between its feeders (8 teams)", () => {
    const { layout } = build(leagueWideState(1, 16, 8, "layout-lw-8-rows"));
    expect(rowsOf(layout, 1)).toEqual([0.5, 2.5]);
    expect(layout.rowOf["playoff_r2_s0"]).toBe(1.5);
  });

  it("puts a bye series half a row above its only feeder (6 teams)", () => {
    const { layout } = expectSoundLayout(
      leagueWideState(1, 12, 6, "layout-lw-6"),
    );
    expect(layout.columns.map((c) => c.seriesIds.length)).toEqual([2, 2, 1]);
    // Semi 0 (#1 bye) is fed by the 4v5 opener (r0_s1), semi 1 (#2 bye) by
    // 3v6 (r0_s0). Feeders are walked in slot order, so the top opener is
    // the one feeding semi 0; the whole layout is then shifted by +0.5.
    expect(layout.rowOf["playoff_r0_s1"]).toBe(0.5);
    expect(layout.rowOf["playoff_r0_s0"]).toBe(1.5);
    expect(layout.rowOf["playoff_r1_s0"]).toBe(0);
    expect(layout.rowOf["playoff_r1_s1"]).toBe(1);
    expect(layout.rowOf["playoff_r2_s0"]).toBe(0.5);
  });

  it("lays out a 12-team bracket with four bye series", () => {
    const { layout } = expectSoundLayout(
      leagueWideState(1, 12, 12, "layout-lw-12"),
    );
    expect(layout.columns.map((c) => c.seriesIds.length)).toEqual([4, 4, 2, 1]);
    const quarterfinals = layout.columns[1]!.seriesIds;
    const byeEdges = layout.edges.filter((e) =>
      quarterfinals.includes(e.toSeriesId),
    );
    expect(byeEdges).toHaveLength(4);
    for (const edge of byeEdges) {
      expect(layout.rowOf[edge.toSeriesId]).toBe(
        layout.rowOf[edge.fromSeriesId]! - 0.5,
      );
    }
  });
});

describe("layoutBracket with two conferences", () => {
  it("lays out and mirrors a 16-team conference bracket", () => {
    const { hub, layout } = expectSoundLayout(
      conferenceBracketState(2, 10, 8, "layout-conf-16"),
    );
    expect(
      layout.columns.map((c) => [c.side, c.label, c.seriesIds.length]),
    ).toEqual([
      ["left", "First Round", 4],
      ["left", "Conference Semifinals", 2],
      ["left", "Conference Finals", 1],
      ["center", "Finals", 1],
      ["right", "Conference Finals", 1],
      ["right", "Conference Semifinals", 2],
      ["right", "First Round", 4],
    ]);
    // First conference on the left, second on the right.
    const [first, second] = hub.conferenceSections.map((s) => s.conferenceName);
    expect(layout.columns[0]!.conferenceName).toBe(first);
    expect(layout.columns[6]!.conferenceName).toBe(second);
    // Right-side rounds run latest to earliest.
    expect(layout.columns.slice(4).map((c) => c.round)).toEqual([2, 1, 0]);
    expect(layout.columns.slice(0, 3).map((c) => c.round)).toEqual([0, 1, 2]);
    // Each conference numbers its openers 0..3 on its own side.
    expect(rowsOf(layout, 0)).toEqual([0, 1, 2, 3]);
    expect(rowsOf(layout, 6)).toEqual([0, 1, 2, 3]);
    expect(layout.rowOf["playoff_r3_s0"]).toBe(1.5);
    expect(layout.rowCount).toBe(4);
  });

  it("lays out and mirrors an 8-team conference bracket", () => {
    const { layout } = expectSoundLayout(
      conferenceBracketState(2, 10, 4, "layout-conf-8"),
    );
    expect(layout.columns.map((c) => c.side)).toEqual([
      "left",
      "left",
      "center",
      "right",
      "right",
    ]);
    expect(layout.columns.map((c) => c.seriesIds.length)).toEqual([
      2, 1, 1, 1, 2,
    ]);
    expect(layout.columns[2]!.label).toBe("Finals");
  });

  it("handles byes inside each conference (3 and 6 per conference)", () => {
    const three = expectSoundLayout(
      conferenceBracketState(2, 6, 3, "layout-conf-bye-3"),
    );
    expect(
      three.layout.columns.map((c) => [c.side, c.seriesIds.length]),
    ).toEqual([
      ["left", 1],
      ["left", 1],
      ["center", 1],
      ["right", 1],
      ["right", 1],
    ]);
    // The conference final (bye) sits half a row above the 2v3 opener.
    const left = three.layout.columns[1]!.seriesIds[0]!;
    const opener = three.layout.columns[0]!.seriesIds[0]!;
    expect(three.layout.rowOf[left]).toBe(three.layout.rowOf[opener]! - 0.5);

    const six = expectSoundLayout(
      conferenceBracketState(2, 8, 6, "layout-conf-bye-6"),
    );
    expect(six.layout.columns.map((c) => c.side)).toEqual([
      "left",
      "left",
      "left",
      "center",
      "right",
      "right",
      "right",
    ]);
  });
});

describe("layoutBracket other shapes", () => {
  it("draws four conferences as one left-to-right tree", () => {
    const { hub, layout } = expectSoundLayout(
      conferenceBracketState(4, 6, 4, "layout-4conf"),
    );
    expect(hub.isConferenceBracket).toBe(true);
    expect(layout.columns.map((c) => c.side)).toEqual([
      "left",
      "left",
      "left",
      "center",
    ]);
    expect(layout.columns.map((c) => c.label)).toEqual([
      "First Round",
      "Conference Finals",
      "Semifinals",
      "Finals",
    ]);
  });

  it("returns an empty layout when there is no bracket", () => {
    const state = leagueWideState(1, 12, 8, "layout-empty");
    const empty: GameState = {
      ...state,
      competition: {
        ...state.competition,
        playoffs: {
          ...state.competition.playoffs,
          status: "not_started",
          fieldSize: 0,
          series: [],
        },
      },
    };
    const layout = layoutBracket(toPlayoffHubView(empty));
    expect(layout.columns).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.rowCount).toBe(0);
  });
});

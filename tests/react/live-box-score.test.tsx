import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  COURT_AWAY,
  COURT_FIXTURE_VIEW,
  COURT_HOME,
} from "@/app/dev/broadcast-ui/court-fixture";
import { LiveBoxScore } from "@/components/game/watch/LiveBoxScore";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";

afterEach(cleanup);

const TOTAL = COURT_FIXTURE_VIEW.plays.length;
const HOME_PLAYER = COURT_FIXTURE_VIEW.players.find((p) => p.side === 0)!;

function renderBox(
  revealed: number,
  selectedPlayerId?: typeof HOME_PLAYER.playerId,
) {
  const ui = (n: number) => (
    <LiveBoxScore
      live={buildLiveBoxScore(COURT_FIXTURE_VIEW, n)}
      away={COURT_AWAY}
      home={COURT_HOME}
      players={COURT_FIXTURE_VIEW.players}
      selectedPlayerId={selectedPlayerId}
    />
  );
  const view = render(ui(revealed));
  return { ...view, rerenderAt: (n: number) => view.rerender(ui(n)) };
}

function rowNames(): string[] {
  const table = screen.getByRole("table");
  return Array.from(table.querySelectorAll("tbody tr")).map((tr) => {
    const first = tr.querySelector("th, td");
    return (first?.textContent ?? "").replace(/on court|selected/g, "").trim();
  });
}

describe("LiveBoxScore", () => {
  it("shows the away team by default and toggles to home", () => {
    renderBox(5);
    expect(
      screen.getByRole("table", { name: "SUM live box score" }),
    ).toBeTruthy();
    const away = screen.getByRole("button", { name: /summit glaciers/i });
    const home = screen.getByRole("button", { name: /harbor harriers/i });
    expect(away.getAttribute("aria-pressed")).toBe("true");
    expect(home.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(home);
    expect(
      screen.getByRole("table", { name: "HAR live box score" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("table", { name: "SUM live box score" }),
    ).toBeNull();
    expect(home.getAttribute("aria-pressed")).toBe("true");
    expect(away.getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to the selected player's team and marks the row", () => {
    const { container } = renderBox(5, HOME_PLAYER.playerId);
    expect(
      screen.getByRole("table", { name: "HAR live box score" }),
    ).toBeTruthy();
    const selected = container.querySelectorAll('tr[data-selected="true"]');
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toContain(HOME_PLAYER.shortName);
  });

  it("lists starters, a Bench divider, then bench, in roster order", () => {
    renderBox(3);
    const names = rowNames();
    expect(names).toEqual([
      "M. Jones",
      "T. Reed",
      "I. Cole",
      "L. Webb",
      "O. Diaz",
      "Bench",
      "B. Hale",
      "Totals",
    ]);
    const divider = screen.getByRole("columnheader", { name: "Bench" });
    expect(divider.getAttribute("colspan")).toBe("11");
    expect(divider.getAttribute("scope")).toBe("colgroup");
  });

  it("keeps row order stable while points change", () => {
    const { rerenderAt } = renderBox(3);
    const before = rowNames();
    const pointsBefore = buildLiveBoxScore(COURT_FIXTURE_VIEW, 3).away.totals
      .points;
    rerenderAt(TOTAL - 1);
    const pointsAfter = buildLiveBoxScore(COURT_FIXTURE_VIEW, TOTAL - 1).away
      .totals.points;
    expect(pointsAfter).not.toBe(pointsBefore);
    expect(rowNames()).toEqual(before);
  });

  it("pins the player column", () => {
    renderBox(3);
    const header = screen.getByRole("columnheader", { name: "Player" });
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("left-0");
    const firstCell = screen
      .getAllByRole("row")
      .map((r) => r.querySelector("td"))
      .find((td) => td?.textContent?.includes("M. Jones"))!;
    expect(firstCell.className).toContain("sticky");
    expect(firstCell.className).toContain("left-0");
  });

  it("right-aligns stat headers and cells", () => {
    renderBox(3);
    expect(
      screen.getByRole("columnheader", { name: "PTS" }).className,
    ).toContain("text-right");
    const row = screen.getByText("M. Jones").closest("tr")!;
    const cells = Array.from(row.querySelectorAll("td")).slice(1);
    expect(cells.length).toBe(10);
    for (const cell of cells) {
      expect(cell.className).toContain("text-right");
      expect(cell.className).toContain("tabular-nums");
    }
  });

  it("shows MIN only at the final", () => {
    const { rerenderAt } = renderBox(3);
    expect(screen.queryByRole("columnheader", { name: "MIN" })).toBeNull();
    rerenderAt(TOTAL);
    expect(screen.getByRole("columnheader", { name: "MIN" })).toBeTruthy();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, render, screen } from "@testing-library/react";

import { COURT_FIXTURE_VIEW } from "@/app/dev/broadcast-ui/court-fixture";
import { ShotSummaryPanel } from "@/components/game/watch/ShotSummaryPanel";
import { buildCourtFrame } from "@/state/watch-court-frame";
import { buildShotSummary } from "@/state/watch-game-selectors";

const view = COURT_FIXTURE_VIEW;
const total = view.plays.length;

function renderPanel(revealed: number) {
  return render(
    <ShotSummaryPanel
      view={view}
      summary={buildShotSummary(view, revealed)}
      revealed={revealed}
    />,
  );
}

afterEach(cleanup);

describe("ShotSummaryPanel", () => {
  it("shows an empty state before any shot", () => {
    renderPanel(0);
    expect(screen.getByText("No shots yet.")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("draws one marker per revealed field-goal attempt, per team", () => {
    const { container } = renderPanel(total);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    const shots = buildCourtFrame(view, total).shots;
    expect(shots.length).toBeGreaterThan(0);
    for (const side of [0, 1] as const) {
      const mine = shots.filter((s) => s.side === side);
      const count = (kind: string) =>
        container.querySelectorAll(
          `[data-testid="${kind}"][data-side="${side}"]`,
        ).length;
      expect(count("shot-made")).toBe(mine.filter((s) => s.made).length);
      expect(count("shot-missed")).toBe(mine.filter((s) => !s.made).length);
    }
  });

  it("labels each chart with the field goals made", () => {
    renderPanel(total);
    const summary = buildShotSummary(view, total);
    for (const [team, line] of [
      [view.away, summary.away.total],
      [view.home, summary.home.total],
    ] as const) {
      expect(
        screen.getByRole("img", {
          name: `${team.abbreviation} shot chart: ${line.fgm} of ${line.fga} field goals made`,
        }),
      ).toBeTruthy();
    }
  });

  it("says the spots are illustrative and drops the scorers list", () => {
    renderPanel(total);
    expect(screen.getByText(/Shot spots are illustrative/)).toBeTruthy();
    expect(screen.queryByText("Top scorers")).toBeNull();
  });
});

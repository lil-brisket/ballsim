import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  loadPlayerDrawerAction: vi.fn(),
  loadTeamDrawerAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/development-league",
  useSearchParams: () => new URLSearchParams(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import {
  DL_EMPTY_NO_ASSIGNMENTS,
  DL_EMPTY_SEASON_NOT_STARTED,
  DlTeamPerformancePanel,
} from "@/components/development-league/DlTeamPerformancePanel";
import type { DlRecentResultView } from "@/state/development-league-selectors";

afterEach(() => {
  cleanup();
});

function wrap(ui: React.ReactNode) {
  return <EntityDrawerProvider saveId="s1">{ui}</EntityDrawerProvider>;
}

const sampleGame: DlRecentResultView = {
  gameId: "dl_game_1",
  date: "2026-11-11",
  opponentAbbreviation: "NYK",
  opponentTeamId: "t2",
  opponentName: "New York Knights",
  opponentBranding: null,
  home: true,
  teamScore: 112,
  opponentScore: 101,
  won: true,
};

describe("DlTeamPerformancePanel", () => {
  it("renders W/L and opponent for completed results", () => {
    render(
      wrap(
        <DlTeamPerformancePanel
          saveId="s1"
          assignedCount={4}
          games={[sampleGame]}
        />,
      ),
    );
    expect(screen.getByText(/New York Knights/)).toBeTruthy();
    expect(screen.getByText(/W 112–101/)).toBeTruthy();
  });

  it("uses no-assignment empty copy", () => {
    render(
      wrap(
        <DlTeamPerformancePanel saveId="s1" assignedCount={0} games={[]} />,
      ),
    );
    expect(screen.getByText(DL_EMPTY_NO_ASSIGNMENTS)).toBeTruthy();
  });

  it("uses season-not-started empty copy when prospects are assigned", () => {
    render(
      wrap(
        <DlTeamPerformancePanel saveId="s1" assignedCount={3} games={[]} />,
      ),
    );
    expect(screen.getByText(DL_EMPTY_SEASON_NOT_STARTED)).toBeTruthy();
  });
});

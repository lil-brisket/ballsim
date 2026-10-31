import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, render, screen, within } from "@testing-library/react";

const openPlayer = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/league/teams/t2",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  toggleTradeBlockAction: vi.fn(),
}));

vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer,
    openTeam: vi.fn(),
    openStaff: vi.fn(),
    close: vi.fn(),
  }),
}));

import { TeamRosterPage } from "@/components/league/TeamRosterPage";
import { RosterSheet } from "@/components/roster/sheet/RosterSheet";
import { setRatingDisplay } from "@/components/ui/rating-display";
import type { SheetPlayerView } from "@/state/roster-sheet-view";
import type { TeamRosterView } from "@/state/team-roster-view";
import { createRosterPagePlayer } from "../factories/roster-page-player";

function player(id: string, overrides: Partial<SheetPlayerView> = {}) {
  const {
    rotationRole: _role,
    onTradeBlock: _block,
    ...base
  } = createRosterPagePlayer({
    playerId: id,
    firstName: "P",
    lastName: id,
    contractSalary: 12_000_000,
    contractYearsRemaining: 2,
  });
  return { ...base, ...overrides } as SheetPlayerView;
}

function players(): SheetPlayerView[] {
  return [
    player("a1", { overall: 80 }),
    player("a2", {
      overall: 70,
      canPlay: false,
      injuryKind: "injured",
      availabilityLabel: "Out 3 weeks",
    }),
  ];
}

describe("RosterSheet league variant", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    openPlayer.mockClear();
    setRatingDisplay("grades");
    window.localStorage.clear();
  });

  it("shows salary, years and Open card without Contracts or actions", () => {
    render(
      <RosterSheet
        variant="league"
        saveId="save_test"
        players={players()}
        returnPath="/dashboard/save_test/league/teams/t2"
      />,
    );
    const header = screen.getByRole("region", { name: "Selected player" });
    expect(within(header).getByText("$12.0M")).toBeTruthy();
    expect(within(header).getByText("2 years left")).toBeTruthy();
    expect(
      within(header).getByRole("button", { name: "Open card" }),
    ).toBeTruthy();
    expect(within(header).queryByText("Contracts")).toBeNull();
    expect(
      within(header).queryByRole("link", { name: "Contracts" }),
    ).toBeNull();
    expect(
      within(header).queryByRole("button", { name: /Actions for/ }),
    ).toBeNull();
  });

  it("renders the team page with a picker and the sheet", () => {
    const view: TeamRosterView = {
      teamId: "t2",
      city: "Boston",
      name: "Harbor",
      abbreviation: "BOS",
      record: { wins: 3, losses: 1 },
      isUserTeam: false,
      players: players(),
      teams: [
        {
          teamId: "t1",
          label: "ATL",
          href: "/dashboard/save_test/league/teams/t1",
        },
        {
          teamId: "t2",
          label: "BOS",
          href: "/dashboard/save_test/league/teams/t2",
        },
      ],
    };
    render(<TeamRosterPage saveId="save_test" view={view} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Boston Harbor" }),
    ).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Team rosters" });
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(
      within(nav)
        .getByRole("link", { name: "BOS" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.queryByRole("link", { name: "Contracts" })).toBeNull();
  });
});

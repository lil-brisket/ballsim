import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

const openPlayer = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/roster",
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

import { FreeAgentRosterView } from "@/components/roster/FreeAgentRosterView";
import { setRatingDisplay } from "@/components/ui/rating-display";
import type { SheetPlayerView } from "@/state/roster-sheet-view";
import {
  createRosterPagePlayer,
  FLAT_ATTRIBUTES,
} from "../factories/roster-page-player";

const HUB = "/dashboard/save_test/free-agency";

function agent(id: string, overrides: Partial<SheetPlayerView> = {}) {
  const {
    rotationRole: _role,
    onTradeBlock: _block,
    ...base
  } = createRosterPagePlayer({
    playerId: id,
    firstName: "F",
    lastName: id,
    contractSalary: null,
    contractYearsRemaining: null,
  });
  return { ...base, ...overrides } as SheetPlayerView;
}

function agents(): SheetPlayerView[] {
  return [
    agent("a1", {
      firstName: "Gus",
      lastName: "Alpha",
      overall: 80,
      attributes: { ...FLAT_ATTRIBUTES, finishing: 90 },
    }),
    agent("a2", { firstName: "Hal", lastName: "Beta", overall: 70 }),
    agent("a3", { firstName: "Ian", lastName: "Gamma", overall: 60 }),
  ];
}

function renderView(
  freeAgents = agents(),
  freeAgentCount = freeAgents.length,
  freeAgencyActive = true,
) {
  return render(
    <FreeAgentRosterView
      saveId="save_test"
      freeAgents={freeAgents}
      freeAgentCount={freeAgentCount}
      freeAgencyHubHref={HUB}
      freeAgencyActive={freeAgencyActive}
    />,
  );
}

const grid = () => screen.getByRole("grid", { name: "Free agent sheet" });
const rowIds = () =>
  Array.from(grid().querySelectorAll("tr[data-player-id]")).map((row) =>
    row.getAttribute("data-player-id"),
  );
const selectedName = () =>
  within(screen.getByRole("region", { name: "Selected player" })).getByRole(
    "heading",
    { level: 3 },
  ).textContent;

describe("Free Agents tab sheet", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    openPlayer.mockClear();
    setRatingDisplay("grades");
    window.localStorage.clear();
  });

  it("lists the free agents by overall with no role groups", () => {
    renderView();
    expect(rowIds()).toEqual(["a1", "a2", "a3"]);
    expect(within(grid()).queryByText("Starters")).toBeNull();
    expect(within(grid()).queryByText("Bench")).toBeNull();
    expect(selectedName()).toBe("Gus Alpha");
  });

  it("shows free agent text and a Free Agency link instead of roster actions", () => {
    renderView();
    const header = screen.getByRole("region", { name: "Selected player" });
    expect(within(header).getByText("Free agent")).toBeTruthy();
    expect(within(header).queryByText("Contracts")).toBeNull();
    expect(
      within(header).queryByRole("button", { name: /Actions for/ }),
    ).toBeNull();
    const link = within(header).getByRole("link", {
      name: "View in Free Agency",
    });
    expect(link.getAttribute("href")).toBe(HUB);
    expect(
      screen.getByRole("link", { name: "Full Free Agency →" }),
    ).toBeTruthy();
  });

  it("moves the selection with the keys and opens the card", () => {
    renderView();
    fireEvent.keyDown(grid(), { key: "ArrowDown" });
    expect(selectedName()).toBe("Hal Beta");
    fireEvent.keyDown(grid(), { key: "Enter" });
    expect(openPlayer).toHaveBeenCalledWith("a2");
    fireEvent.click(screen.getByRole("button", { name: "Open card" }));
    expect(openPlayer).toHaveBeenLastCalledWith("a2");
    fireEvent.doubleClick(grid().querySelector('tr[data-player-id="a3"]')!);
    expect(openPlayer).toHaveBeenLastCalledWith("a3");
  });

  it("switches tabs and between grades and ratings", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    expect(
      within(grid()).getByRole("columnheader", { name: "PPG" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Simple" }));
    const row = grid().querySelector<HTMLElement>('tr[data-player-id="a1"]')!;
    expect(within(row).getByText(/^A, 90/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    expect(within(row).queryByText(/^A, 90/)).toBeNull();
  });

  it("adds the See all footnote only when the list is cut short", () => {
    const { unmount } = renderView(agents(), 3);
    expect(screen.queryByText(/Showing top 40 by overall/)).toBeNull();
    unmount();
    renderView(agents(), 120);
    expect(screen.getByText(/Showing top 40 by overall/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "See all" }).getAttribute("href"),
    ).toBe(HUB);
  });

  it("keeps the empty states", () => {
    const { unmount } = renderView([], 0, true);
    expect(screen.getByText("No free agents available.")).toBeTruthy();
    expect(screen.queryByRole("grid")).toBeNull();
    unmount();
    renderView([], 0, false);
    expect(
      screen.getByText("Free agency market is empty right now."),
    ).toBeTruthy();
  });
});

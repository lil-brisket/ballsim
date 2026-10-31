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
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/roster",
  useRouter: () => ({ replace: vi.fn(), push, refresh: vi.fn() }),
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

import { RosterSheet } from "@/components/roster/sheet/RosterSheet";
import {
  RATING_DISPLAY_STORAGE_KEY,
  setRatingDisplay,
} from "@/components/ui/rating-display";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import {
  createRosterPagePlayer,
  FLAT_ATTRIBUTES,
} from "../factories/roster-page-player";

function squad(): RosterPagePlayerView[] {
  return [
    createRosterPagePlayer({
      playerId: "p1",
      firstName: "Alex",
      lastName: "Rivera",
      age: 30,
      overall: 85,
      potential: 91,
      position: "PG",
      primaryPosition: "PG",
      rotationRole: "starter",
      attributes: { ...FLAT_ATTRIBUTES, finishing: 90 },
    }),
    createRosterPagePlayer({
      playerId: "p2",
      firstName: "Ben",
      lastName: "Adams",
      age: 22,
      overall: 70,
      position: "C",
      primaryPosition: "C",
      rotationRole: "starter",
      attributes: { ...FLAT_ATTRIBUTES, finishing: 70 },
      performance: {
        games: 10,
        mpg: 20,
        ppg: 12.5,
        rpg: 5,
        apg: 2,
        spg: 1,
        bpg: 1,
        fgPct: 45,
        threePct: 30,
        ftPct: 70,
      },
    }),
    createRosterPagePlayer({
      playerId: "p3",
      firstName: "Cal",
      lastName: "Young",
      age: 27,
      overall: 60,
      position: "SF",
      primaryPosition: "SF",
      rotationRole: "bench",
      canPlay: false,
      injuryKind: "injured",
      availabilityLabel: "Out 3 weeks",
      attributes: { ...FLAT_ATTRIBUTES, finishing: 50 },
    }),
    createRosterPagePlayer({
      playerId: "p4",
      firstName: "Dan",
      lastName: "Fox",
      age: 25,
      overall: 65,
      position: "SG",
      primaryPosition: "SG",
      rotationRole: "rotation",
      attributes: { ...FLAT_ATTRIBUTES, finishing: 70 },
    }),
  ];
}

function renderSheet(players = squad()) {
  return render(
    <RosterSheet
      saveId="save_test"
      players={players}
      returnPath="/dashboard/save_test/roster?view=sheet"
    />,
  );
}

const grid = () => screen.getByRole("grid", { name: "Roster sheet" });
const rowIds = () =>
  Array.from(grid().querySelectorAll("tr[data-player-id]")).map((row) =>
    row.getAttribute("data-player-id"),
  );
const row = (id: string) =>
  grid().querySelector<HTMLElement>(`tr[data-player-id="${id}"]`)!;
const selectedName = () =>
  within(screen.getByRole("region", { name: "Selected player" })).getByRole(
    "heading",
    { level: 3 },
  ).textContent;
const sortButton = (name: string) =>
  within(grid()).getByRole("button", { name });
const header = (name: string) =>
  within(grid()).getByRole("columnheader", { name });

describe("RosterSheet", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    openPlayer.mockClear();
    push.mockClear();
    setRatingDisplay("grades");
    window.localStorage.clear();
  });

  it("selects the first player and follows clicks and Up/Down keys", () => {
    renderSheet();
    expect(selectedName()).toBe("Alex Rivera");
    expect(grid().getAttribute("aria-activedescendant")).toBe("sheet-row-p1");

    fireEvent.click(row("p3"));
    expect(selectedName()).toBe("Cal Young");
    expect(row("p3").getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(grid(), { key: "ArrowUp" });
    // Visible order is starters, rotation, bench: p1 p2 p4 p3.
    expect(selectedName()).toBe("Dan Fox");
    fireEvent.keyDown(grid(), { key: "ArrowUp" });
    fireEvent.keyDown(grid(), { key: "ArrowUp" });
    fireEvent.keyDown(grid(), { key: "ArrowUp" });
    expect(selectedName()).toBe("Alex Rivera");
    fireEvent.keyDown(grid(), { key: "End" });
    expect(selectedName()).toBe("Cal Young");
    fireEvent.keyDown(grid(), { key: "ArrowDown" });
    expect(selectedName()).toBe("Cal Young");
    fireEvent.keyDown(grid(), { key: "Home" });
    expect(selectedName()).toBe("Alex Rivera");
  });

  it("only handles keys it uses", () => {
    renderSheet();
    const handled = fireEvent.keyDown(grid(), { key: "ArrowDown" });
    const ignored = fireEvent.keyDown(grid(), { key: "q" });
    expect(handled).toBe(false);
    expect(ignored).toBe(true);
  });

  it("sorts by a skill column, toggles direction and keeps the selection", () => {
    renderSheet();
    fireEvent.click(row("p3"));
    expect(header("INS").getAttribute("aria-sort")).toBe("none");

    fireEvent.click(sortButton("INS"));
    expect(header("INS").getAttribute("aria-sort")).toBe("descending");
    expect(rowIds()).toEqual(["p1", "p2", "p4", "p3"]);
    expect(selectedName()).toBe("Cal Young");

    fireEvent.click(sortButton("INS"));
    expect(header("INS").getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()).toEqual(["p3", "p2", "p4", "p1"]);
  });

  it("sorts text and age columns ascending first, and by name", () => {
    renderSheet();
    fireEvent.click(sortButton("AGE"));
    expect(header("AGE").getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()).toEqual(["p2", "p4", "p3", "p1"]);

    fireEvent.click(sortButton("POS"));
    expect(header("POS").getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()).toEqual(["p1", "p4", "p3", "p2"]);

    fireEvent.click(sortButton("Player"));
    expect(header("Player").getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()).toEqual(["p2", "p4", "p1", "p3"]);
  });

  it("puts missing stats last in either direction", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    fireEvent.click(sortButton("PPG"));
    expect(rowIds()[0]).toBe("p2");
    fireEvent.click(sortButton("PPG"));
    expect(header("PPG").getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()[0]).toBe("p2");
    // Dashes, never zeros.
    expect(row("p1").textContent).toContain("—");
  });

  it("moves the sorted column with Left/Right", () => {
    renderSheet();
    fireEvent.keyDown(grid(), { key: "ArrowRight" });
    expect(header("POS").getAttribute("aria-sort")).toBe("ascending");
    fireEvent.keyDown(grid(), { key: "ArrowRight" });
    expect(header("AGE").getAttribute("aria-sort")).toBe("ascending");
    fireEvent.keyDown(grid(), { key: "ArrowRight" });
    expect(header("OVR").getAttribute("aria-sort")).toBe("descending");
    fireEvent.keyDown(grid(), { key: "ArrowLeft" });
    expect(header("AGE").getAttribute("aria-sort")).toBe("ascending");
  });

  it("opens the card on Enter and double-click, not on a single click", () => {
    renderSheet();
    fireEvent.click(row("p2"));
    expect(openPlayer).not.toHaveBeenCalled();
    fireEvent.keyDown(grid(), { key: "Enter" });
    expect(openPlayer).toHaveBeenCalledWith("p2");
    fireEvent.doubleClick(row("p4"));
    expect(openPlayer).toHaveBeenLastCalledWith("p4");
  });

  it("does not hijack Enter from a header button", () => {
    renderSheet();
    fireEvent.keyDown(sortButton("INS"), { key: "Enter" });
    expect(openPlayer).not.toHaveBeenCalled();
  });

  it("shows letters in Grades and numbers in Ratings, with the number spoken", () => {
    renderSheet();
    expect(within(row("p1")).getByText(/^A, 90/)).toBeTruthy();
    const visible = () =>
      Array.from(row("p1").querySelectorAll("[aria-hidden]")).map(
        (node) => node.textContent,
      );
    expect(visible()).toContain("A");

    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    expect(visible()).toContain("90");
    expect(
      within(row("p1")).getByText(/^90/, { selector: ".sr-only" }),
    ).toBeTruthy();
    expect(within(row("p1")).queryByText(/^A, 90/)).toBeNull();
  });

  it("keeps OVR, POT and AGE as numbers in Grades mode", () => {
    renderSheet();
    const text = row("p1").textContent ?? "";
    expect(text).toContain("85");
    expect(text).toContain("91");
    expect(text).toContain("30");
    expect(text).not.toContain("A minus, 85");
    expect(within(row("p1")).queryByText(/, 91$/)).toBeNull();
  });

  it("persists the display choice and survives blocked storage", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    expect(window.localStorage.getItem(RATING_DISPLAY_STORAGE_KEY)).toBe(
      "ratings",
    );
    cleanup();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Grades" }));
    expect(within(row("p1")).getByText(/^A, 90/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    expect(
      within(row("p1")).getByText(/^90/, { selector: ".sr-only" }),
    ).toBeTruthy();
  });

  it("marks the best in a column, and nothing when all are equal", () => {
    const { unmount } = renderSheet();
    expect(row("p1").querySelectorAll("[data-best]").length).toBeGreaterThan(0);
    expect(
      within(row("p1")).getAllByText(/best on team/).length,
    ).toBeGreaterThan(0);
    expect(row("p2").querySelector("[data-best]")).toBeNull();
    unmount();

    renderSheet(
      squad().map((player) => ({
        ...player,
        overall: 70,
        potential: 80,
        attributes: { ...FLAT_ATTRIBUTES },
      })),
    );
    expect(grid().querySelector("[data-best]")).toBeNull();
  });

  it("groups rows only in the default order", () => {
    renderSheet();
    const groups = () =>
      Array.from(grid().querySelectorAll('th[scope="rowgroup"]')).map(
        (cell) => cell.textContent,
      );
    expect(groups()).toEqual(["Starters", "Rotation", "Bench"]);
    fireEvent.click(sortButton("INS"));
    expect(groups()).toEqual([]);
  });

  it("dims an unavailable player and labels them with a chip", () => {
    renderSheet();
    expect(row("p3").className).toContain("opacity-70");
    expect(within(row("p3")).getByText("Out 3 weeks")).toBeTruthy();
    expect(row("p1").className).not.toContain("opacity-70");
  });

  it("switches tabs by button and with [ and ]", () => {
    renderSheet();
    const count = () => within(grid()).getAllByRole("columnheader").length - 1;
    expect(count()).toBe(13);
    fireEvent.click(screen.getByRole("button", { name: "Detail" }));
    expect(count()).toBe(21);
    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    expect(count()).toBe(12);
    fireEvent.keyDown(grid(), { key: "]" });
    expect(count()).toBe(13);
    fireEvent.keyDown(grid(), { key: "[" });
    expect(count()).toBe(12);
  });

  it("falls back to the default order when the sorted column leaves the tab", () => {
    renderSheet();
    fireEvent.click(sortButton("INS"));
    fireEvent.click(screen.getByRole("button", { name: "Stats" }));
    expect(rowIds()).toEqual(["p1", "p2", "p4", "p3"]);
    expect(grid().querySelector('th[scope="rowgroup"]')).not.toBeNull();
  });

  it("reselects the first player when the selected one leaves the roster", () => {
    const players = squad();
    const { rerender } = renderSheet(players);
    fireEvent.click(row("p3"));
    rerender(
      <RosterSheet
        saveId="save_test"
        players={players.filter((player) => player.playerId !== "p3")}
        returnPath="/dashboard/save_test/roster?view=sheet"
      />,
    );
    expect(selectedName()).toBe("Alex Rivera");
  });
  describe("compare key", () => {
    it("marks on the first C and opens the compare page on the second", () => {
      renderSheet();
      fireEvent.click(row("p2"));
      fireEvent.keyDown(grid(), { key: "c" });
      expect(push).not.toHaveBeenCalled();
      expect(screen.getByRole("status").textContent).toMatch(
        /Comparing Ben Adams/,
      );

      fireEvent.click(row("p1"));
      fireEvent.keyDown(grid(), { key: "C" });
      expect(push).toHaveBeenCalledWith(
        "/dashboard/save_test/players/compare?a=p2&b=p1",
      );
    });

    it("clears the mark on C for the same player or Cancel compare", () => {
      renderSheet();
      fireEvent.keyDown(grid(), { key: "c" });
      expect(screen.getByRole("status")).toBeTruthy();
      fireEvent.keyDown(grid(), { key: "c" });
      expect(screen.queryByRole("status")).toBeNull();
      expect(push).not.toHaveBeenCalled();

      fireEvent.keyDown(grid(), { key: "c" });
      fireEvent.click(screen.getByRole("button", { name: "Cancel compare" }));
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("works from the header button too", () => {
      renderSheet();
      fireEvent.click(screen.getByRole("button", { name: "Compare" }));
      fireEvent.click(row("p3"));
      fireEvent.click(
        screen.getByRole("button", { name: /^Compare with Rivera$/ }),
      );
      expect(push).toHaveBeenCalledWith(
        expect.stringMatching(/\/players\/compare\?a=p1&b=p3$/),
      );
    });

    it("lists the key in the hints", () => {
      renderSheet();
      expect(screen.getByText("Compare", { selector: "span" })).toBeTruthy();
    });
  });
});

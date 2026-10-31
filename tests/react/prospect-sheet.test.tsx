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
let search = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/draft",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
}));

vi.mock("@/components/entity/EntityDrawerProvider", () => ({
  useEntityDrawer: () => ({
    openPlayer,
    openTeam: vi.fn(),
    openStaff: vi.fn(),
    close: vi.fn(),
  }),
}));

import { ProspectPoolView } from "@/components/draft/ProspectPoolView";
import {
  PROSPECT_VIEW_STORAGE_KEY,
  setProspectView,
} from "@/components/draft/prospect-view-preference";
import { ProspectSheet } from "@/components/roster/sheet/ProspectSheet";
import { setRatingDisplay } from "@/components/ui/rating-display";
import type { ProspectSheetRow } from "@/state/prospect-sheet-view";

function prospect(overrides: Partial<ProspectSheetRow>): ProspectSheetRow {
  return {
    playerId: "x",
    portrait: null,
    firstName: "First",
    lastName: "Last",
    position: "SF",
    age: 19,
    nationality: "USA",
    scoutGrade: "B",
    confidence: "medium",
    knowledgeLevel: "developing",
    projectedPick: null,
    previousProjectedPick: null,
    projectedRank: { min: 5, max: 12 },
    overall: { min: 60, max: 70 },
    potential: { min: 70, max: 84 },
    categories: {},
    strengths: [],
    weaknesses: [],
    onBoard: false,
    ...overrides,
  };
}

function pool(): ProspectSheetRow[] {
  return [
    prospect({
      playerId: "p1",
      firstName: "Alex",
      lastName: "Rivera",
      position: "PG",
      age: 20,
      scoutGrade: "A-",
      confidence: "high",
      knowledgeLevel: "detailed",
      projectedPick: 3,
      previousProjectedPick: 6,
      overall: { min: 74, max: 86 },
      potential: { min: 80, max: 92 },
      categories: {
        shooting: { min: 80, max: 84 },
        finishing: { min: 76, max: 79 },
      },
      strengths: ["Strong perimeter shooting"],
      weaknesses: ["Weak rebounding"],
    }),
    prospect({
      playerId: "p2",
      firstName: "Ben",
      lastName: "Adams",
      position: "C",
      age: 18,
      scoutGrade: "C+",
      confidence: "low",
      overall: { min: 55, max: 65 },
      categories: { shooting: { min: 50, max: 60 } },
    }),
    prospect({
      playerId: "p3",
      firstName: "Cal",
      lastName: "Young",
      position: "SG",
      age: 21,
      scoutGrade: null,
      confidence: null,
      knowledgeLevel: "unknown",
      projectedRank: null,
      overall: null,
      potential: null,
    }),
    prospect({
      playerId: "p4",
      firstName: "Dan",
      lastName: "Fox",
      position: "SF",
      age: 19,
      scoutGrade: "B+",
      overall: { min: 68, max: 74 },
      categories: { shooting: { min: 90, max: 94 } },
    }),
  ];
}

function renderSheet(
  rows = pool(),
  total = rows.length,
  actionsById: Record<string, React.ReactNode> = {},
) {
  return render(
    <ProspectSheet rows={rows} total={total} actionsById={actionsById} />,
  );
}

const grid = () => screen.getByRole("grid", { name: "Prospect pool sheet" });
const rowIds = () =>
  Array.from(grid().querySelectorAll("tr[data-player-id]")).map((row) =>
    row.getAttribute("data-player-id"),
  );
const row = (id: string) =>
  grid().querySelector<HTMLElement>(`tr[data-player-id="${id}"]`)!;
const selectedName = () =>
  within(screen.getByRole("region", { name: "Selected prospect" })).getByRole(
    "heading",
    { level: 3 },
  ).textContent;
const sortButton = (name: string) =>
  within(grid()).getByRole("button", { name });
const header = (name: string) =>
  within(grid()).getByRole("columnheader", { name });

describe("ProspectSheet", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    openPlayer.mockClear();
    setRatingDisplay("grades");
    setProspectView("sheet");
    window.localStorage.clear();
    search = "";
  });

  it("selects the first prospect and follows clicks and Up/Down keys", () => {
    renderSheet();
    expect(selectedName()).toBe("Alex Rivera");
    expect(grid().getAttribute("aria-activedescendant")).toBe("sheet-row-p1");

    fireEvent.keyDown(grid(), { key: "ArrowDown" });
    expect(selectedName()).toBe("Ben Adams");
    fireEvent.click(row("p4"));
    expect(selectedName()).toBe("Dan Fox");
    fireEvent.keyDown(grid(), { key: "Home" });
    expect(selectedName()).toBe("Alex Rivera");
    fireEvent.keyDown(grid(), { key: "End" });
    expect(selectedName()).toBe("Dan Fox");
  });

  it("shows ranges as grade spans in Grades and numbers in Ratings, with spoken text", () => {
    renderSheet();
    expect(row("p1").textContent).toContain("B+–A-");
    // A range inside one grade shows a single letter.
    expect(
      within(row("p1")).getByText("B, 76 to 79", { selector: ".sr-only" }),
    ).toBeTruthy();
    // OVR and POT stay numbers whatever the display.
    expect(row("p1").textContent).toContain("74–86");
    expect(row("p1").textContent).toContain("80–92");

    fireEvent.click(screen.getByRole("button", { name: "Ratings" }));
    expect(row("p1").textContent).toContain("80–84");
    expect(
      within(row("p1")).getByText("80 to 84", { selector: ".sr-only" }),
    ).toBeTruthy();
    expect(row("p1").textContent).not.toContain("B+–A-");
  });

  it("spells out grade ranges for screen readers", () => {
    renderSheet();
    expect(
      within(row("p1")).getByText("B plus to A minus, 80 to 84", {
        selector: ".sr-only",
      }),
    ).toBeTruthy();
  });

  it("shows dashes, never zeros, for a prospect with no estimate", () => {
    renderSheet();
    const cells = Array.from(row("p3").querySelectorAll("td")).map(
      (cell) => cell.textContent,
    );
    expect(cells.filter((text) => text === "—").length).toBeGreaterThanOrEqual(
      10,
    );
    expect(row("p3").textContent).not.toMatch(/\b0\b/);
  });

  it("sorts by range midpoint with missing estimates last in either direction", () => {
    renderSheet();
    fireEvent.click(sortButton("OVR"));
    expect(header("OVR").getAttribute("aria-sort")).toBe("descending");
    expect(rowIds()).toEqual(["p1", "p4", "p2", "p3"]);
    fireEvent.click(sortButton("OVR"));
    expect(header("OVR").getAttribute("aria-sort")).toBe("ascending");
    expect(rowIds()).toEqual(["p2", "p4", "p1", "p3"]);

    // A category only some prospects have: the rest are last.
    fireEvent.click(sortButton("SHOOT"));
    expect(rowIds()).toEqual(["p4", "p1", "p2", "p3"]);
  });

  it("sorts by age, scouting letter (best first) and name", () => {
    renderSheet();
    fireEvent.click(sortButton("AGE"));
    expect(rowIds()).toEqual(["p2", "p4", "p1", "p3"]);
    fireEvent.click(sortButton("SCOUT"));
    expect(header("SCOUT").getAttribute("aria-sort")).toBe("descending");
    expect(rowIds()).toEqual(["p1", "p4", "p2", "p3"]);
    fireEvent.click(sortButton("Prospect"));
    expect(rowIds()).toEqual(["p2", "p4", "p1", "p3"]);
  });

  it("returns to the page order when nothing is sorted", () => {
    renderSheet();
    expect(rowIds()).toEqual(["p1", "p2", "p3", "p4"]);
    expect(grid().querySelector('th[scope="rowgroup"]')).toBeNull();
  });

  it("moves the sorted column with Left/Right", () => {
    renderSheet();
    fireEvent.keyDown(grid(), { key: "ArrowRight" });
    expect(header("POS").getAttribute("aria-sort")).toBe("ascending");
    fireEvent.keyDown(grid(), { key: "ArrowLeft" });
    expect(header("CONF").getAttribute("aria-sort")).toBe("descending");
  });

  it("never marks a best in column", () => {
    renderSheet();
    expect(grid().querySelector("[data-best]")).toBeNull();
  });

  it("never opens a player card: undrafted prospects have none", () => {
    renderSheet();
    fireEvent.click(row("p2"));
    fireEvent.keyDown(grid(), { key: "Enter" });
    fireEvent.doubleClick(row("p4"));
    expect(openPlayer).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Open card" })).toBeNull();
    expect(screen.queryByText("Player card")).toBeNull();
  });

  it("shows the selected prospect's estimate facts once, and only theirs", () => {
    renderSheet(pool(), 40, {
      p1: <button type="button">Draft Alex</button>,
      p2: <button type="button">Draft Ben</button>,
    });
    const region = screen.getByRole("region", { name: "Selected prospect" });
    expect(
      within(region).getByRole("img", { name: "Estimated overall 74 to 86" }),
    ).toBeTruthy();
    expect(within(region).getByText("Strong perimeter shooting")).toBeTruthy();
    expect(within(region).getByText("Weak rebounding")).toBeTruthy();
    expect(within(region).getByText("#3")).toBeTruthy();
    expect(within(region).getByText("A-")).toBeTruthy();
    expect(
      within(region).getByRole("button", { name: "Draft Alex" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Draft Ben" })).toBeNull();

    fireEvent.keyDown(grid(), { key: "ArrowDown" });
    expect(screen.getByRole("button", { name: "Draft Ben" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Draft Alex" })).toBeNull();
  });

  it("shows dashes in the header for a prospect with no estimate", () => {
    renderSheet();
    fireEvent.click(row("p3"));
    const region = screen.getByRole("region", { name: "Selected prospect" });
    expect(within(region).queryByRole("img")).toBeNull();
    expect(within(region).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });

  it("notes when the pool is capped", () => {
    renderSheet(pool(), 61);
    expect(screen.getByText(/Showing 4 of 61 prospects/)).toBeTruthy();
    cleanup();
    renderSheet(pool(), 4);
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});

describe("ProspectPoolView", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    setProspectView("sheet");
    window.localStorage.clear();
    search = "";
  });

  function renderPool() {
    return render(
      <ProspectPoolView
        sheet={<p>SHEET LAYOUT</p>}
        cards={<p>CARDS LAYOUT</p>}
      />,
    );
  }

  it("defaults to the sheet and links both views", () => {
    renderPool();
    expect(screen.getByText("SHEET LAYOUT")).toBeTruthy();
    expect(screen.queryByText("CARDS LAYOUT")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Cards" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/draft?pool=cards");
    expect(
      screen.getByRole("link", { name: "Sheet" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("lets the URL beat the stored choice, and remembers a URL choice", () => {
    setProspectView("sheet");
    search = "pool=cards";
    renderPool();
    expect(screen.getByText("CARDS LAYOUT")).toBeTruthy();
    expect(window.localStorage.getItem(PROSPECT_VIEW_STORAGE_KEY)).toBe(
      "cards",
    );
  });

  it("uses the stored choice when the URL has none", () => {
    setProspectView("cards");
    renderPool();
    expect(screen.getByText("CARDS LAYOUT")).toBeTruthy();
  });

  it("keeps resumeTo and drops a stale error in the switch links", () => {
    search = "resumeTo=abc&error=oops&pool=sheet";
    renderPool();
    const href = screen
      .getByRole("link", { name: "Cards" })
      .getAttribute("href")!;
    expect(href).toContain("resumeTo=abc");
    expect(href).toContain("pool=cards");
    expect(href).not.toContain("error");
  });

  it("ignores an unknown pool value", () => {
    search = "pool=bogus";
    renderPool();
    expect(screen.getByText("SHEET LAYOUT")).toBeTruthy();
  });
});

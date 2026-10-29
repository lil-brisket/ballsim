import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const openPlayer = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/roster",
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

import { RatingCell } from "@/components/roster/sheet/RatingCell";
import { SheetHeader } from "@/components/roster/sheet/SheetHeader";
import {
  createRosterPagePlayer,
  FLAT_ATTRIBUTES,
} from "../factories/roster-page-player";

describe("RatingCell", () => {
  afterEach(cleanup);

  it("shows a letter grade with the number in the accessible label", () => {
    const { container } = render(<RatingCell value={82} mode="grades" />);
    expect(container.querySelector("[aria-hidden]")!.textContent).toBe("B+");
    expect(screen.getByText("B plus, 82").className).toContain("sr-only");
    expect(container.firstElementChild!.getAttribute("title")).toBe(
      "B plus, 82",
    );
  });

  it("shows the number in ratings mode", () => {
    const { container } = render(<RatingCell value={82} mode="ratings" />);
    expect(container.querySelector("[aria-hidden]")!.textContent).toBe("82");
    expect(screen.getByText("82", { selector: ".sr-only" })).toBeTruthy();
  });

  it("carries the tier on data-tier", () => {
    const { container } = render(<RatingCell value={95} mode="grades" />);
    expect(container.firstElementChild!.getAttribute("data-tier")).toBe(
      "elite",
    );
  });

  it("marks the best with a non-colour marker and spoken text", () => {
    const { container } = render(<RatingCell value={70} mode="ratings" best />);
    expect(container.querySelector("[data-best]")).toBeTruthy();
    expect(screen.getByText("70 best on team")).toBeTruthy();
  });

  it("has no marker when not best", () => {
    const { container } = render(<RatingCell value={70} mode="ratings" />);
    expect(container.querySelector("[data-best]")).toBeNull();
  });
});

describe("SheetHeader", () => {
  afterEach(() => {
    cleanup();
    openPlayer.mockClear();
  });

  function renderHeader(
    overrides: Parameters<typeof createRosterPagePlayer>[0] = {},
  ) {
    return render(
      <SheetHeader
        saveId="save_test"
        returnPath="/dashboard/save_test/roster"
        mode="ratings"
        player={createRosterPagePlayer(overrides)}
      />,
    );
  }

  it("renders the selected player's facts", () => {
    renderHeader();
    expect(
      screen.getByRole("region", { name: "Selected player" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Alex Rivera" }),
    ).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall 78" })).toBeTruthy();
    expect(screen.getByText("Playmaker")).toBeTruthy();
    expect(screen.getByText("$5.0M")).toBeTruthy();
    expect(screen.getByText("3 years left")).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Contracts" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/team/contracts");
  });

  it("announces the name and overall politely", () => {
    renderHeader();
    const heading = screen.getByRole("heading", { name: "Alex Rivera" });
    expect(heading.closest("[aria-live='polite']")).toBeTruthy();
  });

  it("lists the three highest skill areas", () => {
    renderHeader({
      attributes: {
        ...FLAT_ATTRIBUTES,
        threePoint: 95,
        finishing: 90,
        rebounding: 85,
        midRange: 70,
      },
    });
    const items = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("Three-point");
    expect(items[1]).toContain("Inside scoring");
    expect(items[2]).toContain("Rebounding");
  });

  it("shows dashes without a contract", () => {
    renderHeader({
      contractSalary: null,
      contractEndYear: null,
      contractYearsRemaining: null,
    });
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("No contract")).toBeTruthy();
  });

  it("opens the player card", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Open card" }));
    expect(openPlayer).toHaveBeenCalledWith("player_1");
  });
});

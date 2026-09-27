import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { addCalendarDays } from "@/domain/calendar-date";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/transactions",
  useSearchParams: () => new URLSearchParams("limit=50&type=trades"),
}));

import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import type { ComponentProps } from "react";

const defaultProps: ComponentProps<typeof TransactionFilters> = {
  saveId: "s1",
  basePath: "/dashboard/s1/transactions",
  group: "trades",
  range: "7d",
  teamValue: "my",
  search: "smith",
  teams: [{ teamId: "t1", label: "Boston Celtics", abbreviation: "BOS" }],
  myTeamId: "t1",
  limit: 50,
  sort: "contract",
  activityMode: "myTeam",
  today: "2026-03-15",
};

describe("TransactionFilters", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders type, team, time, sort, activity, and search controls", () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(screen.getByLabelText("Transaction Type")).toBeTruthy();
    expect(screen.getByRole("button", { name: "All Teams" })).toBeTruthy();
    expect(screen.getByLabelText("Time")).toBeTruthy();
    expect(screen.getByLabelText("Sort By")).toBeTruthy();
    expect(screen.getByRole("link", { name: "League Activity" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "My Team" })).toBeTruthy();
    expect(screen.getByLabelText("Search")).toBeTruthy();
  });

  it("disables waivers and extensions options", () => {
    render(<TransactionFilters {...defaultProps} />);
    const typeSelect = screen.getByLabelText("Transaction Type");
    const waivers = within(typeSelect).getByRole("option", {
      name: "Waivers (coming soon)",
    }) as HTMLOptionElement;
    const extensions = within(typeSelect).getByRole("option", {
      name: "Extensions (coming soon)",
    }) as HTMLOptionElement;
    expect(waivers.disabled).toBe(true);
    expect(extensions.disabled).toBe(true);
  });

  it("reflects the current selections", () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(
      (screen.getByLabelText("Transaction Type") as HTMLSelectElement).value,
    ).toBe("trades");
    expect((screen.getByLabelText("Time") as HTMLSelectElement).value).toBe(
      "7d",
    );
    expect((screen.getByLabelText("Sort By") as HTMLSelectElement).value).toBe(
      "contract",
    );
    expect(
      screen.getByRole("link", { name: "My Team" }).getAttribute("href"),
    ).toContain("activity=myTeam");
  });

  it("shows custom date inputs only for a custom range", () => {
    const { rerender } = render(<TransactionFilters {...defaultProps} />);
    expect(screen.queryByLabelText("Start")).toBeNull();
    expect(screen.queryByLabelText("End")).toBeNull();

    rerender(
      <TransactionFilters
        {...defaultProps}
        range="custom"
        start="2026-01-01"
        end="2026-03-31"
      />,
    );
    expect(screen.getByLabelText("Start")).toBeTruthy();
    expect(screen.getByLabelText("End")).toBeTruthy();
  });

  it("seeds start and end when choosing Custom", () => {
    render(<TransactionFilters {...defaultProps} />);
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "custom" },
    });
    expect(pushMock).toHaveBeenCalled();
    const url = String(pushMock.mock.calls[0]![0]);
    expect(url).toContain("range=custom");
    expect(url).toContain(`start=${addCalendarDays("2026-03-15", -29)}`);
    expect(url).toContain("end=2026-03-15");
    expect(url).not.toContain("limit=");
  });

  it("drops start and end when switching away from custom", () => {
    render(
      <TransactionFilters
        {...defaultProps}
        range="custom"
        start="2026-01-01"
        end="2026-03-31"
      />,
    );
    fireEvent.change(screen.getByLabelText("Time"), {
      target: { value: "today" },
    });
    const url = String(pushMock.mock.calls[0]![0]);
    expect(url).toContain("range=today");
    expect(url).not.toContain("start=");
    expect(url).not.toContain("end=");
  });

  it("omits limit when changing a filter control", () => {
    render(<TransactionFilters {...defaultProps} />);
    fireEvent.change(screen.getByLabelText("Transaction Type"), {
      target: { value: "draft" },
    });
    const url = String(pushMock.mock.calls[0]![0]);
    expect(url).toContain("type=draft");
    expect(url).not.toContain("limit=");
  });

  it("preserves other query params in search and omits limit", () => {
    render(
      <TransactionFilters
        {...defaultProps}
        range="custom"
        start="2026-01-01"
        end="2026-03-31"
      />,
    );
    const search = screen.getByLabelText("Search");
    const form = search.closest("form");
    expect(form).toBeTruthy();
    expect(
      form!.querySelector('input[name="type"]')?.getAttribute("value"),
    ).toBe("trades");
    expect(
      form!.querySelector('input[name="range"]')?.getAttribute("value"),
    ).toBe("custom");
    expect(
      form!.querySelector('input[name="start"]')?.getAttribute("value"),
    ).toBe("2026-01-01");
    expect(
      form!.querySelector('input[name="end"]')?.getAttribute("value"),
    ).toBe("2026-03-31");
    expect(
      form!.querySelector('input[name="team"]')?.getAttribute("value"),
    ).toBe("my");
    expect(
      form!.querySelector('input[name="sort"]')?.getAttribute("value"),
    ).toBe("contract");
    expect(
      form!.querySelector('input[name="activity"]')?.getAttribute("value"),
    ).toBe("myTeam");
    expect(form!.querySelector('input[name="limit"]')).toBeNull();
  });

  it("points Clear filters at the bare path", () => {
    render(<TransactionFilters {...defaultProps} />);
    expect(
      screen.getByRole("link", { name: "Clear filters" }).getAttribute("href"),
    ).toBe("/dashboard/s1/transactions");
  });
});

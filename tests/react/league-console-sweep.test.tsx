import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard/s1/league/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

import { SimulateToDateConfirm } from "@/components/calendar/SimulateToDateConfirm";
import { HistoryHubHeader } from "@/components/history/HistoryHubHeader";
import { TeamFilter } from "@/components/league/TeamFilter";
import { OffseasonQuickLinks } from "@/components/offseason/OffseasonQuickLinks";

afterEach(cleanup);

describe("HistoryHubHeader", () => {
  it("renders the section tabs as a view switch with the active tab current", () => {
    render(<HistoryHubHeader saveId="s1" route="team" activeTab="teams" />);
    const nav = screen.getByRole("navigation", {
      name: "Team history sections",
    });
    const current = nav.querySelector("[aria-current='page']");
    expect(current?.textContent).toBe("Team Records");
    expect(nav.querySelectorAll("a").length).toBeGreaterThan(1);
  });
});

describe("OffseasonQuickLinks", () => {
  it("lands on focusable hub tiles, one link per destination", () => {
    const links = [
      { label: "Calendar", href: "/dashboard/s1/calendar" },
      { label: "Draft", href: "/dashboard/s1/draft" },
    ];
    const { container } = render(<OffseasonQuickLinks links={links} />);
    const tiles = container.querySelectorAll("a[data-focus-item]");
    expect(tiles.length).toBe(2);
    expect(
      screen.getByRole("link", { name: "Draft" }).getAttribute("href"),
    ).toBe("/dashboard/s1/draft");
  });
});

describe("SimulateToDateConfirm keyboard behaviour", () => {
  it("moves focus into the dialog, wraps Tab and closes on Escape", () => {
    const onCancel = vi.fn();
    render(
      <>
        <button type="button">opener</button>
        <SimulateToDateConfirm
          date="2026-11-03"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      </>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(document.activeElement).toBe(cancel);

    const last = screen.getByRole("button", { name: "Simulate to date" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("TeamFilter picker", () => {
  it("closes on Escape and returns focus to its trigger", () => {
    render(
      <TeamFilter
        teams={[
          { teamId: "t1", label: "Boston Harriers", abbreviation: "BOS" },
        ]}
        myTeamId="t1"
        value="all"
      />,
    );
    const trigger = screen.getByRole("button", { name: "Team ▾" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const search = screen.getByRole("searchbox", { name: "Search teams" });
    fireEvent.keyDown(search, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});

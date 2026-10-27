import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

import { PlayerProfileViews } from "@/components/player-profile/PlayerProfileViews";
import { StaffCoachingViews } from "@/components/staff-coaching/StaffCoachingViews";

afterEach(() => {
  cleanup();
  nav.pathname = "";
});

function currentLabels(): string[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent ?? "");
}

describe("PlayerProfileViews", () => {
  it("links every section, with Overview on the bare player URL", () => {
    render(
      <PlayerProfileViews saveId="save_1" playerId="p_1" activeTab="gamelog" />,
    );
    const base = "/dashboard/save_1/players/p_1";
    const expected: Record<string, string> = {
      Overview: base,
      Attributes: `${base}?tab=attributes`,
      Statistics: `${base}?tab=stats`,
      Development: `${base}?tab=development`,
      "Game Log": `${base}?tab=gamelog`,
      Career: `${base}?tab=career`,
      Contract: `${base}?tab=contract`,
    };
    expect(
      screen.getByRole("navigation", { name: "Player profile sections" }),
    ).toBeTruthy();
    for (const [name, href] of Object.entries(expected)) {
      expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(
        href,
      );
    }
    expect(currentLabels()).toEqual(["Game Log"]);
  });
});

describe("StaffCoachingViews", () => {
  it("marks the view matching the current path", () => {
    nav.pathname = "/dashboard/save_1/staff-coaching/hiring-market";
    render(<StaffCoachingViews saveId="save_1" />);
    expect(
      screen.getByRole("navigation", { name: "Staff and coaching" }),
    ).toBeTruthy();
    expect(currentLabels()).toEqual(["Hiring Market"]);
  });

  it("has no active view off the three pages", () => {
    nav.pathname = "/dashboard/save_1/staff-coaching";
    render(<StaffCoachingViews saveId="save_1" />);
    expect(currentLabels()).toEqual([]);
  });
});

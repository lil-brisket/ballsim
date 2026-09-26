import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamHubSubNav } from "@/components/team/TeamHubSubNav";

describe("TeamHubSubNav", () => {
  it("renders Team Hub, Roster, Lineup & Rotation, and Contracts tabs", () => {
    const { unmount } = render(
      <TeamHubSubNav saveId="save_test" active="team" />,
    );

    expect(
      screen.getByRole("link", { name: "Team Hub" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/team");
    expect(
      screen.getByRole("link", { name: "Roster" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/roster");
    expect(
      screen
        .getByRole("link", { name: "Lineup & Rotation" })
        .getAttribute("href"),
    ).toBe("/dashboard/save_test/team-management/lineups");
    expect(
      screen.getByRole("link", { name: "Contracts" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/team/contracts");

    unmount();
  });

  it("marks Contracts as the current page when active", () => {
    const { unmount } = render(
      <TeamHubSubNav saveId="save_test" active="contracts" />,
    );

    expect(
      screen.getByRole("link", { name: "Contracts" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Team Hub" }).getAttribute("aria-current"),
    ).toBeNull();

    unmount();
  });
});

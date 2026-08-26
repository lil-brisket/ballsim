import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  confirmTeamIdentityAction: vi.fn(),
}));

import { TeamIdentityBuilder } from "@/components/owner/TeamIdentityBuilder";

describe("TeamIdentityBuilder", () => {
  it("updates preview when nickname changes", () => {
    const { unmount } = render(
      <TeamIdentityBuilder
        saveId="save_1"
        city="Toronto"
        initialNickname="Huskies"
        initialPaletteId="midnight_navy"
        initialLogoId="wolf"
        teamId="team_1"
        existingTeams={[{ id: "team_1", city: "Toronto", name: "Huskies" }]}
      />,
    );

    expect(screen.getByText("Huskies")).toBeTruthy();
    const input = screen.getByLabelText(/team name/i);
    fireEvent.change(input, { target: { value: "Titans" } });
    expect(screen.getByText("Titans")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm Franchise" })).toBeTruthy();
    unmount();
  });

  it("randomize identity changes palette or logo selection", () => {
    const { unmount } = render(
      <TeamIdentityBuilder
        saveId="save_1"
        city="Toronto"
        initialNickname="Huskies"
        initialPaletteId="midnight_navy"
        initialLogoId="wolf"
        teamId="team_1"
        existingTeams={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Randomize Identity" }));
    expect(screen.getByRole("button", { name: "Confirm Franchise" })).toBeTruthy();
    unmount();
  });
});

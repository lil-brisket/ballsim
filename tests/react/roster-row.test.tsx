import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/team",
}));

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { RosterRow } from "@/components/basketball/RosterRow";

describe("RosterRow", () => {
  it("renders a decorative sm portrait beside the player name", () => {
    const { container, unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <RosterRow
          saveId="save_test"
          playerId="player_1"
          firstName="Alex"
          lastName="Rivera"
          position="PG"
          overall={78}
          age={24}
        />
      </EntityDrawerProvider>,
    );

    expect(screen.getByRole("button", { name: "Alex Rivera" })).toBeTruthy();
    const portrait = container.querySelector(
      "[data-portrait-player-id='player_1']",
    );
    expect(portrait?.getAttribute("data-portrait-size")).toBe("sm");
    expect(portrait?.getAttribute("aria-hidden")).toBe("true");
    expect((portrait as HTMLElement).style.width).toBe("32px");
    expect(screen.getByText("AR")).toBeTruthy();
    unmount();
  });
});

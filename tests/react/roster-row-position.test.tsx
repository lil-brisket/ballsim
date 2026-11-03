import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, render, screen } from "@testing-library/react";

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

afterEach(cleanup);

function renderRow(secondaryPosition?: "SG" | null) {
  render(
    <EntityDrawerProvider saveId="save_test">
      <RosterRow
        saveId="save_test"
        playerId="player_1"
        firstName="Test"
        lastName="Alpha"
        position="PG"
        secondaryPosition={secondaryPosition}
        overall={80}
        age={24}
      />
    </EntityDrawerProvider>,
  );
}

describe("RosterRow position label", () => {
  it("shows PG/SG for a player with a secondary position", () => {
    renderRow("SG");
    expect(screen.getByText(/PG\/SG/)).toBeTruthy();
  });

  it("shows plain PG without a secondary position", () => {
    renderRow(null);
    expect(screen.getByText(/PG/).textContent).not.toContain("/");
  });
});

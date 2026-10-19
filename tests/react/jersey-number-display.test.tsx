import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/team",
}));

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  toggleTradeBlockAction: vi.fn(),
}));

import { PlayerProfileHero } from "@/components/basketball/PlayerProfileHero";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { RosterManagementTable } from "@/components/roster/RosterManagementTable";
import { TeamRosterPreview } from "@/components/team/hub/TeamRosterPreview";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";
import type { TeamHubView } from "@/state/team-hub-selectors";

function rosterPlayer(
  overrides: Partial<RosterPagePlayerView> = {},
): RosterPagePlayerView {
  return {
    playerId: "player_1",
    portrait: null,
    firstName: "Alex",
    lastName: "Rivera",
    jerseyNumber: 23,
    position: "PG",
    age: 24,
    overall: 78,
    contractSalary: 5_000_000,
    contractEndYear: 2030,
    contractYearsRemaining: 3,
    injuryKind: "available",
    developmentStage: "growth",
    primaryPosition: "PG",
    rotationRole: "starter",
    isInactive: false,
    onTradeBlock: false,
    canPlay: true,
    availabilityLabel: "Available",
    roleDisplayLabel: "Starter",
    ...overrides,
  };
}

describe("jersey number display", () => {
  afterEach(cleanup);

  it("shows a # column with each player's number in the roster table view", () => {
    render(
      <EntityDrawerProvider saveId="save_test">
        <RosterManagementTable
          saveId="save_test"
          returnPath="/dashboard/save_test/roster"
          players={[
            rosterPlayer(),
            rosterPlayer({
              playerId: "player_2",
              firstName: "Jordan",
              lastName: "Cole",
              jerseyNumber: 7,
            }),
          ]}
        />
      </EntityDrawerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Table" }));

    const header = screen.getByRole("columnheader", { name: /Number/ });
    expect(header.textContent).toContain("#");
    const row = screen.getByRole("row", { name: /Alex Rivera/ });
    expect(within(row).getByText("23").className).toContain("font-mono");
    const otherRow = screen.getByRole("row", { name: /Jordan Cole/ });
    expect(within(otherRow).getByText("7")).toBeTruthy();
  });

  it("shows #N beside the position in the profile hero", () => {
    render(
      <PlayerProfileHero
        playerId="player_1"
        firstName="Alex"
        lastName="Rivera"
        jerseyNumber={23}
        position="SF"
        age={24}
        overall={78}
        teamName={null}
        teamAbbreviation={null}
        branding={null}
        availabilityStatus="available"
      />,
    );

    expect(screen.getByText("#23")).toBeTruthy();
    expect(screen.getByText("SF")).toBeTruthy();
  });

  it("shows #N before the name in the team hub roster preview", () => {
    const hub = {
      corePlayers: [rosterPlayer()],
      injuredPlayers: [
        rosterPlayer({
          playerId: "player_3",
          firstName: "Sam",
          lastName: "Lee",
          jerseyNumber: 0,
          injuryKind: "injured",
        }),
      ],
    } as unknown as TeamHubView;

    render(
      <EntityDrawerProvider saveId="save_test">
        <TeamRosterPreview saveId="save_test" hub={hub} />
      </EntityDrawerProvider>,
    );

    expect(screen.getByText("#23")).toBeTruthy();
    expect(screen.getByText("#0")).toBeTruthy();
  });
});

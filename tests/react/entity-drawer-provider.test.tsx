import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";

const fetchPlayer = vi.fn();
const fetchTeam = vi.fn();
const fetchStaff = vi.fn();

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: (...args: unknown[]) => fetchPlayer(...args),
  fetchTeamDrawerViewAction: (...args: unknown[]) => fetchTeam(...args),
  fetchStaffDrawerViewAction: (...args: unknown[]) => fetchStaff(...args),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
  useRouter: () => ({ refresh: vi.fn() }),
}));

const samplePlayer = {
  playerId: "player_1",
  identity: {
    firstName: "Alex",
    lastName: "Rivera",
    position: "PG",
    age: 24,
    overall: 78,
  },
  team: {
    teamId: "team_1",
    teamName: "Harbor Waves",
    abbreviation: "HAR",
    branding: null,
  },
  availability: { status: "available" },
  ratings: {
    keyAttributes: [{ attribute: "Ball Handle", rating: 82 }],
  },
  contract: null,
  performance: { games: 10, ppg: 18.2, rpg: 4.1, apg: 6.5 },
  navigation: {
    playerHref: "/dashboard/save_test/players/player_1",
    teamHref: "/dashboard/save_test/team",
    contractHref: null,
    developmentHref: null,
  },
};

describe("EntityDrawerProvider", () => {
  beforeEach(() => {
    fetchPlayer.mockReset();
    fetchTeam.mockReset();
    fetchStaff.mockReset();
  });

  it("opens player drawer from PlayerEntityLink", async () => {
    fetchPlayer.mockResolvedValue(samplePlayer);
    const { unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <PlayerEntityLink saveId="save_test" playerId="player_1">
          Alex Rivera
        </PlayerEntityLink>
      </EntityDrawerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Alex Rivera" }));
    expect(fetchPlayer).toHaveBeenCalledWith("save_test", "player_1");

    await waitFor(() => {
      expect(screen.getByText("View full player")).toBeTruthy();
    });
    expect(screen.getByText("Season averages")).toBeTruthy();
    expect(screen.getByText("18.2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByText("View full player")).toBeNull();
    });
    unmount();
  });

  it("shows missing state when player is gone", async () => {
    fetchPlayer.mockResolvedValue(null);
    const { unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <PlayerEntityLink saveId="save_test" playerId="gone">
          Gone Player
        </PlayerEntityLink>
      </EntityDrawerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Gone Player" }));
    await waitFor(() => {
      expect(screen.getByText(/no longer exists/i)).toBeTruthy();
    });
    unmount();
  });

  it("opens team drawer from TeamEntityLink using teamId", async () => {
    fetchTeam.mockResolvedValue({
      teamId: "team_1",
      identity: {
        city: "Harbor",
        name: "Waves",
        abbreviation: "HAR",
        branding: null,
        conference: "East",
        division: "Atlantic",
      },
      performance: {
        wins: 10,
        losses: 5,
        rank: 2,
        streak: { type: "W", count: 3 },
      },
      roster: { topPlayers: [], injuryHighlights: [] },
      context: null,
      recentGames: [],
      navigation: {
        teamHref: "/dashboard/save_test/league",
        rosterHref: null,
        scheduleHref: "/dashboard/save_test/schedule",
      },
    });

    const { unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <TeamEntityLink saveId="save_test" teamId="team_1">
          Harbor Waves
        </TeamEntityLink>
      </EntityDrawerProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Harbor Waves" }));
    expect(fetchTeam).toHaveBeenCalledWith("save_test", "team_1");
    await waitFor(() => {
      expect(screen.getByText("View team")).toBeTruthy();
    });
    expect(screen.getByText("View schedule")).toBeTruthy();
    unmount();
  });

  it("respects preferNavigation on PlayerEntityLink", () => {
    const { unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <PlayerEntityLink
          saveId="save_test"
          playerId="player_1"
          preferNavigation
        >
          Navigate Player
        </PlayerEntityLink>
      </EntityDrawerProvider>,
    );
    const link = screen.getByRole("link", { name: "Navigate Player" });
    expect(link.getAttribute("href")).toBe(
      "/dashboard/save_test/players/player_1",
    );
    expect(fetchPlayer).not.toHaveBeenCalled();
    unmount();
  });
});

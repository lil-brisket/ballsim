import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecentResultsPanel } from "@/components/owner/dashboard/RecentResultsPanel";
import type { RecentFormGame } from "@/state/recent-form-selectors";

afterEach(cleanup);

function result(overrides: Partial<RecentFormGame> = {}): RecentFormGame {
  return {
    gameId: "g1",
    date: "2026-10-08",
    opponentAbbreviation: "MON",
    opponentTeamId: "team_mon",
    opponentBranding: null,
    home: true,
    teamScore: 104,
    opponentScore: 98,
    won: true,
    ...overrides,
  };
}

const TEAM = { abbreviation: "TOR", branding: null };

describe("RecentResultsPanel", () => {
  it("tags the result, links to the game and names the top scorer", () => {
    const { container } = render(
      <RecentResultsPanel
        saveId="s1"
        team={TEAM}
        games={[
          result({
            leader: {
              playerId: "p1",
              firstName: "Avery",
              lastName: "Ives",
              name: "Avery Ives",
              points: 32,
              portrait: null,
            },
          }),
        ]}
      />,
    );

    expect(container.textContent).toContain("W · Final");
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/dashboard/s1/games/g1",
    );
    expect(screen.getByText("Avery Ives · 32 pts")).toBeTruthy();
    // No stored portrait: the initials plate stands in, so the row still has art.
    expect(container.querySelector("li p [aria-hidden]")).toBeTruthy();
  });

  it("marks a loss and omits the scorer line when there are no box rows", () => {
    const { container } = render(
      <RecentResultsPanel
        saveId="s1"
        team={TEAM}
        games={[
          result({
            home: false,
            won: false,
            teamScore: 90,
            opponentScore: 100,
            leader: null,
          }),
        ]}
      />,
    );

    expect(container.textContent).toContain("L · Final");
    expect(screen.queryByText(/pts$/)).toBeNull();
  });

  it("falls back when there are no completed games", () => {
    render(<RecentResultsPanel saveId="s1" team={TEAM} games={[]} />);

    expect(
      screen.getByText("No completed games yet this season."),
    ).toBeTruthy();
  });
});

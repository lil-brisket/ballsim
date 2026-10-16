import { createEmptyPlayerStatLine } from "@/domain/player-stat-aggregation";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { PlayerDrawer } from "@/components/basketball/PlayerDrawer";
import { resetDrawerScrollLockForTests } from "@/components/ui/drawer-scroll-lock";
import type { PlayerAttributes } from "@/domain/entities/player";
import type { PlayerDrawerView } from "@/state/entity-drawer-selectors";

const BASE_ATTRIBUTES: PlayerAttributes = {
  speed: 60,
  strength: 60,
  athleticism: 60,
  stamina: 60,
  finishing: 60,
  midRange: 60,
  threePoint: 60,
  freeThrow: 60,
  ballHandling: 90,
  passing: 80,
  perimeterDefense: 60,
  interiorDefense: 60,
  steal: 60,
  block: 60,
  rebounding: 60,
  basketballIq: 60,
  offensiveIq: 60,
  defensiveIq: 60,
  consistency: 60,
};

function playerView(
  overrides: Partial<PlayerDrawerView> = {},
): PlayerDrawerView {
  return {
    saveId: "save_test",
    playerId: "player_1",
    portrait: null,
    identity: {
      firstName: "Alex",
      lastName: "Rivera",
      position: "PG",
      age: 24,
      overall: 78,
      potential: 88,
      archetypeLabel: "Floor General",
      heightInches: 79,
      weightPounds: 205,
      nationality: "USA",
    },
    team: {
      teamId: "team_1",
      teamName: "Harbor Waves",
      abbreviation: "HAR",
      branding: null,
    },
    availability: { status: "available" },
    ratings: { attributes: { ...BASE_ATTRIBUTES } },
    contract: null,
    performance: {
      games: 10,
      mpg: 31.4,
      ppg: 18.2,
      rpg: 4.1,
      apg: 6.5,
      spg: 1.3,
      bpg: 0.4,
    },
    stats: {
      currentSeasonId: "season_2026",
      seasons: [],
      career: {
        regular: createEmptyPlayerStatLine(),
        playoffs: createEmptyPlayerStatLine(),
        development: createEmptyPlayerStatLine(),
        combined: createEmptyPlayerStatLine(),
        extendedColumnsComplete: true,
      },
      currentSeasonGames: [],
    },
    development: {
      ratingHistory: [
        { seasonYear: 2026, age: 24, overall: 78, current: true },
      ],
      trackingStartedSeasonYear: null,
    },
    navigation: {
      playerHref: "/dashboard/save_test/players/player_1",
      teamHref: "/dashboard/save_test/team",
      contractHref: null,
      developmentHref: null,
    },
    ...overrides,
  };
}

describe("PlayerDrawer modal", () => {
  beforeEach(() => {
    resetDrawerScrollLockForTests();
  });

  afterEach(() => {
    resetDrawerScrollLockForTests();
  });

  it("renders a centered modal hero with identity, ratings, and stats", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={onOpenChange}
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("data-drawer-placement")).toBe("modal");
    expect(dialog.className).not.toMatch(/sm:justify-end/);
    expect(dialog.className).not.toMatch(/sm:border-l/);
    expect(dialog.className).not.toMatch(/max-w-md/);
    expect(dialog.parentElement?.className).not.toMatch(/sm:justify-end/);

    expect(screen.getAllByText("Alex Rivera").length).toBeGreaterThan(0);
    expect(screen.getByText("PG")).toBeTruthy();
    expect(screen.getByText("Floor General")).toBeTruthy();
    expect(screen.getByText(`6'7"`)).toBeTruthy();
    expect(screen.getByText("205 lbs")).toBeTruthy();
    expect(screen.getByText("Age 24")).toBeTruthy();
    expect(screen.getByText("POT 88")).toBeTruthy();
    expect(screen.getByText("Harbor Waves")).toBeTruthy();
    expect(screen.getByText("78")).toBeTruthy();
    expect(screen.getByText("OVR")).toBeTruthy();
    expect(screen.getByText("available")).toBeTruthy();
    expect(screen.getByText("AR")).toBeTruthy();
    expect(screen.queryByText("Availability")).toBeNull();

    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByText("Season averages")).toBeTruthy();
    expect(screen.getByText("18.2")).toBeTruthy();

    const fullPlayer = screen.getByRole("link", { name: "View full player" });
    expect(fullPlayer.getAttribute("href")).toBe(
      "/dashboard/save_test/players/player_1",
    );
    expect(fullPlayer.className).toMatch(/min-h-11/);
    expect(screen.queryByRole("link", { name: "View contract" })).toBeNull();
    expect(screen.queryByRole("link", { name: "View development" })).toBeNull();
    unmount();
  });

  it("does not close when clicking inside the panel", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("dialog"));
    fireEvent.click(screen.getByText("Season averages"));
    expect(onOpenChange).not.toHaveBeenCalled();
    unmount();
  });

  it("closes on backdrop click and Escape", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close drawer" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });

  it("focuses Close on initial open", async () => {
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close" })).toBe(
        document.activeElement,
      );
    });
    unmount();
  });

  it("closes the modal when navigating via the full-player action", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "View full player" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });

  it("shows contract and development actions when hrefs are present", () => {
    const view = playerView({
      contract: {
        salary: 12_500_000,
        yearsRemaining: 2,
        status: "active",
      },
      navigation: {
        playerHref: "/dashboard/save_test/players/player_1",
        teamHref: "/dashboard/save_test/team",
        contractHref: "/dashboard/save_test/team/contracts",
        developmentHref: "/dashboard/save_test/development",
      },
    });
    const { unmount } = render(
      <PlayerDrawer open status="ready" view={view} onOpenChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("link", { name: "View contract" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/team/contracts");
    expect(
      screen
        .getByRole("link", { name: "View development" })
        .getAttribute("href"),
    ).toBe("/dashboard/save_test/development");
    expect(screen.getByText("$12.5M")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    unmount();
  });

  it("shows season averages with em dashes when games are zero", () => {
    const view = playerView({
      performance: {
        games: 0,
        mpg: null,
        ppg: null,
        rpg: null,
        apg: null,
        spg: null,
        bpg: null,
      },
    });
    const { unmount } = render(
      <PlayerDrawer open status="ready" view={view} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Season averages")).toBeTruthy();
    expect(screen.getByText("GP")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("0.0")).toBeNull();
    unmount();
  });

  it("shows contract details unavailable for controlled players without a contract object", () => {
    const view = playerView({
      contract: null,
      navigation: {
        playerHref: "/dashboard/save_test/players/player_1",
        teamHref: "/dashboard/save_test/team",
        contractHref: "/dashboard/save_test/team/contracts",
        developmentHref: "/dashboard/save_test/development",
      },
    });
    const { unmount } = render(
      <PlayerDrawer open status="ready" view={view} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Contract details unavailable")).toBeTruthy();
    expect(screen.queryByText("No contract on file")).toBeNull();
    unmount();
  });

  it("omits the contract section for public players", () => {
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.queryByText("Contract")).toBeNull();
    expect(screen.queryByText("Contract details unavailable")).toBeNull();
    unmount();
  });

  it("renders seven category tiles and expands sub-attributes on click", () => {
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Attributes" }));
    const list = screen.getByRole("list", { name: "Category ratings" });
    expect(within(list).getAllByRole("button")).toHaveLength(7);

    // Best category (Playmaking) starts open.
    const playmaking = within(list).getByRole("button", { name: /Playmaking/ });
    expect(playmaking.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Ball Handling")).toBeTruthy();
    expect(screen.getByText("Passing")).toBeTruthy();
    expect(screen.queryByText("Finishing")).toBeNull();

    const inside = within(list).getByRole("button", { name: /Inside Scoring/ });
    expect(inside.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(inside);
    expect(inside.getAttribute("aria-expanded")).toBe("true");
    expect(playmaking.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("Finishing")).toBeTruthy();
    expect(screen.queryByText("Ball Handling")).toBeNull();

    fireEvent.click(inside);
    expect(inside.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Finishing")).toBeNull();
    unmount();
  });

  it("updates content and resets scroll when the selected player changes", () => {
    const onOpenChange = vi.fn();
    const first = playerView();
    const second = playerView({
      playerId: "player_2",
      identity: {
        firstName: "Jordan",
        lastName: "Cole",
        position: "C",
        age: 29,
        overall: 84,
        potential: 90,
        archetypeLabel: "Rim Protector",
        heightInches: 83,
        weightPounds: 245,
        nationality: "USA",
      },
      team: {
        teamId: "team_2",
        teamName: "Metro Foxes",
        abbreviation: "MTF",
        branding: null,
      },
      performance: {
        games: 4,
        mpg: 22.0,
        ppg: 11.1,
        rpg: 8.4,
        apg: 1.2,
        spg: 0.5,
        bpg: 0.8,
      },
      ratings: {
        attributes: {
          ...BASE_ATTRIBUTES,
          ballHandling: 40,
          passing: 40,
          rebounding: 95,
        },
      },
    });

    const { rerender, unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={first}
        onOpenChange={onOpenChange}
      />,
    );

    const body = document.querySelector("[data-drawer-body]");
    expect(body).toBeTruthy();
    if (body instanceof HTMLElement) {
      body.scrollTop = 140;
    }

    const fullPlayer = screen.getByRole("link", { name: "View full player" });
    fullPlayer.focus();

    rerender(
      <PlayerDrawer
        open
        status="ready"
        view={second}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getAllByText("Jordan Cole").length).toBeGreaterThan(0);
    expect(screen.queryByText("Alex Rivera")).toBeNull();
    expect(screen.getByText("Metro Foxes")).toBeTruthy();
    expect(screen.getByText("11.1")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Attributes" }));
    expect(screen.getByText("Rebounding breakdown")).toBeTruthy();
    if (body instanceof HTMLElement) {
      expect(body.scrollTop).toBe(0);
    }
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Close" }),
    );
    unmount();
  });
});

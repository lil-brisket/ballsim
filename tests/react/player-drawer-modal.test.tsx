import { createEmptyPlayerStatLine } from "@/domain/player-stat-aggregation";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/players",
}));
const { fetchProfile } = vi.hoisted(() => ({ fetchProfile: vi.fn() }));
vi.mock("@/application/actions", () => ({
  releasePlayerAction: vi.fn(),
  offerContractExtensionAction: vi.fn(),
  executeTradeAction: vi.fn(),
  assignToDevelopmentLeagueAction: vi.fn(),
  recallFromDevelopmentLeagueAction: vi.fn(),
  fetchPlayerProfileViewAction: (...args: unknown[]) => fetchProfile(...args),
}));
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ContractExtensionView } from "@/state/contract-extension-selectors";
import type { PlayerReleaseView } from "@/state/player-release-selectors";
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

const extensionView: ContractExtensionView = {
  playerId: "player_1",
  seasonsLeft: 0,
  currentSalary: 8_000_000,
  firstNewSeason: 2028,
  askSalary: 12_000_000,
  askMinYears: 3,
  maxYears: 5,
  minSalary: 1_000_000,
  maxSalary: 50_000_000,
  salaryCap: 100_000_000,
  salaryCapEnabled: true,
  seasons: [2028, 2029, 2030, 2031, 2032].map((seasonYear) => ({
    seasonYear,
    currentSalary: 0,
    payrollWithoutPlayer: 95_000_000,
  })),
  lastResponse: null,
  refusals: 0,
  testingMarket: false,
  blockedReason: null,
};

const releaseView: PlayerReleaseView = {
  playerId: "player_1",
  remainingSalary: 20_000_000,
  blockedReason: null,
  waive: {
    mode: "waive",
    cashNow: 0,
    buyoutRate: null,
    totalDeadMoney: 20_000_000,
    seasons: [{ seasonYear: 2027, capHit: 10_000_000, cashDue: 10_000_000 }],
    capSpaceAfter: 5_000_000,
  },
  buyout: {
    mode: "buyout",
    cashNow: 17_600_000,
    buyoutRate: 0.88,
    totalDeadMoney: 17_600_000,
    seasons: [{ seasonYear: 2027, capHit: 17_600_000, cashDue: 0 }],
    capSpaceAfter: -2_000_000,
  },
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
      jerseyNumber: 23,
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
    mood: {
      value: 60,
      band: "content",
      label: "Content",
      reason: "Settled",
      tradeRequested: false,
    },
    contract: null,
    performance: {
      games: 10,
      mpg: 31.4,
      ppg: 18.2,
      rpg: 4.1,
      apg: 6.5,
      spg: 1.3,
      bpg: 0.4,
      fgPct: null,
      threePct: null,
      ftPct: null,
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
    },
    actions: { onControlledRoster: false, extension: null, release: null },
    ...overrides,
  };
}

describe("PlayerDrawer modal", () => {
  beforeEach(() => {
    resetDrawerScrollLockForTests();
    fetchProfile.mockReset();
    fetchProfile.mockResolvedValue(null);
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

    expect(dialog.getAttribute("aria-label")).toBe("Alex Rivera");
    expect(screen.queryByRole("heading", { name: "Alex Rivera" })).toBeNull();
    expect(screen.queryByTestId("hero-watermark")).toBeNull();
    expect(screen.getByText("PG")).toBeTruthy();
    expect(screen.getByText("#23")).toBeTruthy();
    expect(screen.getByText("Floor General")).toBeTruthy();
    expect(screen.getByText(`6'7"`)).toBeTruthy();
    expect(screen.getByText("205 lbs")).toBeTruthy();
    expect(screen.getByText("Age 24")).toBeTruthy();
    // Potential is a ghost OvrBadge (age 24 or younger).
    expect(screen.getByRole("img", { name: "POT 88" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Overall 78" })).toBeTruthy();
    expect(screen.getByText("Harbor Waves")).toBeTruthy();
    expect(screen.getByText("78")).toBeTruthy();
    expect(screen.getByText("OVR")).toBeTruthy();
    expect(screen.getByText("available")).toBeTruthy();
    expect(screen.getByText("AR")).toBeTruthy();
    expect(screen.queryByText("Availability")).toBeNull();

    expect(screen.getByRole("tab", { name: "Overview" })).toBeTruthy();
    expect(screen.getByText("Season averages")).toBeTruthy();
    expect(screen.getByText("18.2")).toBeTruthy();

    expect(screen.queryByRole("link", { name: "View full player" })).toBeNull();
    const asPage = screen.getByRole("link", { name: "Open as page" });
    expect(asPage.getAttribute("href")).toBe(
      "/dashboard/save_test/players/player_1",
    );
    expect(asPage.className).toMatch(/min-h-11/);
    for (const name of ["Game Log", "Career", "Contract"]) {
      expect(screen.getByRole("tab", { name })).toBeTruthy();
    }
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

  it("closes the modal when opening the player as a page", () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={onOpenChange}
      />,
    );
    fireEvent.click(screen.getByRole("link", { name: "Open as page" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });

  it("shows the contract in Overview with no contract or development links", () => {
    const view = playerView({
      contract: {
        salary: 12_500_000,
        yearsRemaining: 2,
        status: "active",
      },
      actions: { onControlledRoster: true, extension: null, release: null },
    });
    const { unmount } = render(
      <PlayerDrawer open status="ready" view={view} onOpenChange={vi.fn()} />,
    );
    expect(screen.queryByRole("link", { name: "View contract" })).toBeNull();
    expect(screen.queryByRole("link", { name: "View development" })).toBeNull();
    expect(screen.getByRole("link", { name: "Compare" })).toBeTruthy();
    expect(screen.getByText("$12.5M")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    unmount();
  });

  it("opens Extend contract and Release dialogs in place", () => {
    const view = playerView({
      actions: {
        onControlledRoster: true,
        extension: extensionView,
        release: releaseView,
      },
    });
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={view}
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.queryByRole("link", { name: "Extend contract" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Release" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Extend contract" }));
    expect(
      screen.getByRole("heading", { name: "Extend Alex Rivera" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Extend" })).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("heading", { name: "Extend Alex Rivera" }),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Release" }));
    expect(
      screen.getByRole("heading", { name: "Release Alex Rivera?" }),
    ).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
    unmount();
  });

  it("Escape closes only the dialog, not the drawer", () => {
    const view = playerView({
      actions: {
        onControlledRoster: true,
        extension: extensionView,
        release: releaseView,
      },
    });
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={view}
        onOpenChange={onOpenChange}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Release" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
      screen.getByRole("heading", { name: "Release Alex Rivera?" }),
    ).toBeTruthy();

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(
      screen.queryByRole("heading", { name: "Release Alex Rivera?" }),
    ).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    unmount();
  });

  it("hides Extend contract and Release when the actions are null", () => {
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Extend contract" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Release" })).toBeNull();
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
        fgPct: null,
        threePct: null,
        ftPct: null,
      },
    });
    const { unmount } = render(
      <PlayerDrawer open status="ready" view={view} onOpenChange={vi.fn()} />,
    );
    expect(screen.getByText("Season averages")).toBeTruthy();
    expect(screen.getByText("GP")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    for (const label of ["PTS", "REB", "AST", "MIN", "STL", "BLK"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("0.0")).toBeNull();
    unmount();
  });

  it("shows contract details unavailable for controlled players without a contract object", () => {
    const view = playerView({
      contract: null,
      actions: { onControlledRoster: true, extension: null, release: null },
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
    expect(screen.queryByRole("heading", { name: "Contract" })).toBeNull();
    expect(screen.queryByText("Contract details unavailable")).toBeNull();
    unmount();
  });

  it("lists seven categories with inline breakdowns and marks best and weakest", () => {
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
    expect(
      within(list).getAllByRole("button", { name: /details/i }),
    ).toHaveLength(7);

    // Best category (Playmaking) starts open.
    const playmaking = within(list).getByRole("button", {
      name: /for Playmaking/,
    });
    expect(playmaking.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Ball Handling")).toBeTruthy();
    expect(screen.getByText("Passing")).toBeTruthy();
    expect(screen.queryByText("Finishing")).toBeNull();
    // The breakdown renders inside its category box, not in a separate panel.
    const breakdown = screen.getByRole("list", {
      name: "Playmaking attributes",
    });
    expect(breakdown.closest("li[data-category]")).toBe(
      playmaking.closest("li[data-category]"),
    );
    expect(
      within(playmaking.closest("li")!).getByText("Best category"),
    ).toBeTruthy();

    const inside = within(list).getByRole("button", {
      name: /for Inside Scoring/,
    });
    expect(inside.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(inside);
    expect(inside.getAttribute("aria-expanded")).toBe("true");
    // Boxes open independently: Playmaking stays open.
    expect(playmaking.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Finishing")).toBeTruthy();

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
        jerseyNumber: 7,
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
        fgPct: null,
        threePct: null,
        ftPct: null,
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

    const fullPlayer = screen.getByRole("link", { name: "Open as page" });
    fullPlayer.focus();

    rerender(
      <PlayerDrawer
        open
        status="ready"
        view={second}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe(
      "Jordan Cole",
    );
    expect(screen.queryByText("Alex Rivera")).toBeNull();
    expect(screen.getByText("Metro Foxes")).toBeTruthy();
    expect(screen.getByText("11.1")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Attributes" }));
    expect(
      screen.getByRole("list", { name: "Rebounding attributes" }),
    ).toBeTruthy();
    if (body instanceof HTMLElement) {
      expect(body.scrollTop).toBe(0);
    }
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: "Close" }),
    );
    unmount();
  });

  it("lazy-loads the profile once per player and shows the contract tab", async () => {
    fetchProfile.mockResolvedValue({
      tradesOpen: false,
      player: { contractProfile: null, onControlledRoster: false },
    });
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    expect(fetchProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Contract" }));
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(await screen.findByText("No contract on file.")).toBeTruthy();
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(fetchProfile).toHaveBeenCalledWith("save_test", "player_1");
    expect(screen.queryByRole("link", { name: "View contracts" })).toBeNull();

    const contractTab = screen.getByRole("tab", { name: "Contract" });
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    fireEvent.click(contractTab);
    expect(fetchProfile).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("shows an unavailable note when the profile is out of scope", async () => {
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Career" }));
    expect(
      await screen.findByText(
        "Full profile details are not available for this player.",
      ),
    ).toBeTruthy();
    unmount();
  });

  it("shows an error with retry when the profile fails to load", async () => {
    fetchProfile.mockRejectedValueOnce(new Error("boom"));
    fetchProfile.mockResolvedValueOnce({
      tradesOpen: false,
      player: { contractProfile: null, onControlledRoster: false },
    });
    const { unmount } = render(
      <PlayerDrawer
        open
        status="ready"
        view={playerView()}
        onOpenChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Contract" }));
    const retry = await screen.findByRole("button", { name: "Try again" });
    fireEvent.click(retry);
    expect(await screen.findByText("No contract on file.")).toBeTruthy();
    expect(fetchProfile).toHaveBeenCalledTimes(2);
    unmount();
  });
});

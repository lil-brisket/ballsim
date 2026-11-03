import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("server-only", () => ({}));

vi.mock("@/application/actions", () => ({
  acceptOwnerDecisionAction: vi.fn(),
  declineOwnerDecisionAction: vi.fn(),
  askAiOwnerDecisionAction: vi.fn(),
}));

import {
  HomeHero,
  resolveHomeHeroMode,
  type HomeHeroDash,
} from "@/components/owner/dashboard/HomeHero";
import {
  HomeTileBoard,
  type HomeTileBoardData,
} from "@/components/owner/dashboard/HomeTileBoard";
import type {
  ActionCenterItem,
  ActionCenterView,
} from "@/state/action-center-selectors";
import type { OwnerDashboardPendingTradeOffer } from "@/state/owner-dashboard";
import type { ScheduleGameView } from "@/state/selectors";

afterEach(cleanup);

const BRANDING = {
  primaryColor: "#7a1f1f",
  secondaryColor: "#e8d9b0",
  accentColor: "#c9a227",
  logoId: "shield",
};

function game(id: string, home = true): ScheduleGameView {
  return {
    gameId: id,
    date: "2026-10-07",
    opponentAbbreviation: "MON",
    opponentName: "Monterrey Bears",
    opponentTeamId: "team_mon",
    opponentBranding: BRANDING,
    home,
    status: "scheduled",
    teamScore: null,
    opponentScore: null,
    won: null,
    gameDayPromotion: null,
  };
}

function offer(primaryTeamId: string): OwnerDashboardPendingTradeOffer {
  return {
    decisionId: "od_1",
    offeringTeamId: "team_bos",
    offeringTeamName: "Boston Breakers",
    offeringTeamBranding: null,
    receivingTeamId: "team_har",
    receivingTeamName: "Harbor Waves",
    receivingTeamBranding: null,
    primaryTeamId,
    bothSidesOwned: false,
    createdOn: "2026-10-05",
    youReceive: ["Alex Johnson"],
    theyReceive: ["John Smith"],
    valueSummary: "even",
    motivationLabel: null,
    reasons: [],
    expiresOn: null,
  };
}

function dash(overrides: Partial<HomeHeroDash> = {}): HomeHeroDash {
  return {
    controlledTeam: {
      id: "team_tor",
      city: "Toronto",
      name: "Falcons",
      abbreviation: "TOR",
      branding: BRANDING,
    },
    flags: {
      userOnDraftClock: false,
      hasLastGameDay: false,
      hasUpcomingGames: true,
      isNewFranchise: false,
      seasonReviewPending: false,
      pendingOwnerDecision: false,
    },
    currentDate: "2026-10-06",
    seasonPhase: "regular",
    offseasonStage: "none",
    tradesOpen: true,
    daysUntilTradeDeadline: null,
    home: {
      topPlayer: null,
      biggestRiser: null,
      biggestFaller: null,
      standing: null,
      playoffSeries: null,
      payroll: { payroll: 120_000_000, taxLine: null, projectedTax: 0 },
    },
    offseasonPriorities: [],
    pendingTradeOffer: null,
    seasonRecap: null,
    seasonStory: "",
    team: {
      wins: 0,
      losses: 2,
      leagueRank: null,
      conferenceRank: null,
      conferenceName: null,
      strength: 62.1,
      payroll: 0,
      payrollVsLeaguePct: null,
      rosterProblems: [],
      upcomingGames: [game("g1")],
      nextOpponent: { wins: 3, losses: 1, strength: 66.4 },
    },
    ...overrides,
  };
}

function urgentItem(
  id: string,
  title: string,
  blocksAdvance = false,
): ActionCenterItem {
  return {
    id,
    priority: 1,
    severity: "critical",
    category: "roster",
    urgency: "immediate",
    deadline: null,
    relevance: "team",
    title,
    description: `${title} needs a decision`,
    href: `/dashboard/s1/${id}`,
    hrefLabel: `Fix ${id}`,
    blocksAdvance,
    dedupeKey: id,
  };
}

const CALM: ActionCenterView = {
  items: [],
  hasUrgentActions: false,
  focalMode: "next-game",
  urgentCount: 0,
  blockingCount: 0,
};

const URGENT: ActionCenterView = {
  items: [
    urgentItem("a1", "Injury requires rotation change"),
    urgentItem("a2", "Payroll over the cap"),
    urgentItem("a3", "Roster has an open spot"),
  ],
  hasUrgentActions: true,
  focalMode: "actions",
  urgentCount: 3,
  blockingCount: 0,
};

const BLOCKING: ActionCenterView = {
  items: [
    urgentItem("a1", "Injury requires rotation change"),
    urgentItem("a2", "Payroll over the cap"),
    urgentItem("a3", "You're on the draft clock", true),
  ],
  hasUrgentActions: true,
  focalMode: "actions",
  urgentCount: 3,
  blockingCount: 1,
};

function renderHero(
  d: HomeHeroDash,
  actionCenter: ActionCenterView = CALM,
): HTMLElement {
  const { container } = render(
    <HomeHero
      saveId="s1"
      dash={d}
      actionCenter={actionCenter}
      switchTeamAction={vi.fn()}
    />,
  );
  return container;
}

function primaryControls(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a, button")]
    .filter((el) => el.className.includes("bg-team "))
    .map((el) => el.textContent?.trim() ?? "");
}

describe("HomeHero precedence", () => {
  it("asks to switch teams when the offer belongs to another franchise", () => {
    const container = renderHero(
      dash({ pendingTradeOffer: offer("team_other") }),
      URGENT,
    );

    expect(
      screen.getByText(
        "Harbor Waves needs your attention before time can advance",
      ),
    ).toBeTruthy();
    expect(primaryControls(container)).toEqual(["Switch to Harbor Waves"]);
  });

  it("shows the pending offer panel with Accept as the only primary", () => {
    const container = renderHero(
      dash({ pendingTradeOffer: offer("team_tor") }),
      URGENT,
    );

    expect(screen.getByText(/Boston Breakers trade offer/i)).toBeTruthy();
    expect(primaryControls(container)).toEqual(["Accept"]);
  });

  it("puts the draft clock ahead of urgent actions", () => {
    const base = dash();
    const container = renderHero(
      dash({ flags: { ...base.flags, userOnDraftClock: true } }),
      URGENT,
    );

    expect(screen.getByText("You're on the clock")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open Draft" }).getAttribute("href"),
    ).toBe("/dashboard/s1/draft");
    expect(primaryControls(container)).toEqual(["Open Draft"]);
  });

  it("shows the season review ahead of urgent actions", () => {
    const base = dash();
    const container = renderHero(
      dash({
        flags: { ...base.flags, seasonReviewPending: true },
        seasonStory: "A season to remember.",
        seasonRecap: {
          record: "41-41",
          playoffResult: "Lost in round one",
          revenue: 0,
          expenses: 0,
          netIncome: 0,
          cash: 0,
          franchiseValue: 0,
          completedObjectives: 0,
          failedObjectives: 0,
          story: "",
        },
      }),
      URGENT,
    );

    expect(screen.getByText("Season review")).toBeTruthy();
    expect(screen.getByText(/41-41/)).toBeTruthy();
    expect(screen.getByText(/Lost in round one/)).toBeTruthy();
    expect(screen.getByText("A season to remember.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Continue in Schedule" })
        .getAttribute("href"),
    ).toBe("/dashboard/s1/calendar");
    expect(primaryControls(container)).toEqual(["Continue in Schedule"]);
  });

  it("leads with the first urgent action and keeps the rest quiet", () => {
    const container = renderHero(dash(), URGENT);

    expect(screen.getByText("3 actions need attention")).toBeTruthy();
    expect(screen.queryByText(/before time can advance/)).toBeNull();
    expect(screen.getByText("Injury requires rotation change")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Fix a1" }).getAttribute("href"),
    ).toBe("/dashboard/s1/a1");
    expect(
      screen.getByRole("link", { name: "Payroll over the cap" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Roster has an open spot" }),
    ).toBeTruthy();
    expect(primaryControls(container)).toEqual(["Fix a1"]);
  });

  it("only claims time is blocked for actions that block, and leads with them", () => {
    const container = renderHero(dash(), BLOCKING);

    expect(
      screen.getByText("1 action must be resolved before time can advance"),
    ).toBeTruthy();
    expect(primaryControls(container)).toEqual(["Fix a3"]);
  });

  it("shows the next game with Sim to tip-off as the only primary", () => {
    const container = renderHero(dash());

    expect(screen.getByText("vs Monterrey Bears")).toBeTruthy();
    expect(screen.getByText(/Home game/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Sim to tip-off" }).getAttribute("href"),
    ).toBe("/dashboard/s1/calendar?focus=next-game");
    expect(screen.getByRole("link", { name: "Review rotation" })).toBeTruthy();
    expect(primaryControls(container)).toEqual(["Sim to tip-off"]);
  });

  it("says how far away the game is and links to its preview", () => {
    renderHero(dash());

    expect(screen.getByText(/Tomorrow/)).toBeTruthy();
    expect(screen.getByText("Next game")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Game preview" }).getAttribute("href"),
    ).toBe("/dashboard/s1/games/g1");
  });

  it("labels preseason games", () => {
    renderHero(dash({ seasonPhase: "preseason" }));

    expect(screen.getByText("Next preseason game")).toBeTruthy();
  });

  it("shows the playoff series score and round", () => {
    const base = dash();
    renderHero(
      dash({
        seasonPhase: "playoffs",
        home: {
          ...base.home,
          playoffSeries: {
            roundLabel: "Conference Semifinals",
            opponentAbbreviation: "MON",
            teamWins: 2,
            opponentWins: 1,
          },
        },
      }),
    );

    expect(screen.getByText("Next playoff game")).toBeTruthy();
    expect(screen.getByText(/Conference Semifinals/)).toBeTruthy();
    expect(screen.getByText(/Leads MON 2-1/)).toBeTruthy();
  });

  it("shows both teams' records and ratings in the matchup", () => {
    renderHero(dash());

    const matchup = screen.getByRole("group", { name: "Matchup" });
    expect(within(matchup).getByText("TOR")).toBeTruthy();
    expect(within(matchup).getByText("0-2")).toBeTruthy();
    expect(within(matchup).getByText("Avg OVR 62.1")).toBeTruthy();
    expect(within(matchup).getByText("MON")).toBeTruthy();
    expect(within(matchup).getByText("3-1")).toBeTruthy();
    expect(within(matchup).getByText("Avg OVR 66.4")).toBeTruthy();
  });

  it("omits the opponent's record and rating when they are unknown", () => {
    const base = dash();
    renderHero(dash({ team: { ...base.team, nextOpponent: null } }));

    const matchup = screen.getByRole("group", { name: "Matchup" });
    expect(within(matchup).getByText("MON")).toBeTruthy();
    expect(within(matchup).queryByText("3-1")).toBeNull();
    expect(within(matchup).queryByText(/Avg OVR 66/)).toBeNull();
  });

  it("shows the offseason with up to three priorities when nothing is scheduled", () => {
    const base = dash();
    const container = renderHero(
      dash({
        team: { ...base.team, upcomingGames: [] },
        offseasonPriorities: ["Draft", "Re-sign", "Free agency", "Camp"],
      }),
    );

    expect(screen.getByText("Offseason")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("Free agency")).toBeTruthy();
    expect(screen.queryByText("Camp")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Open Offseason Hub" })
        .getAttribute("href"),
    ).toBe("/dashboard/s1/offseason");
    expect(primaryControls(container)).toEqual(["Open Offseason Hub"]);
  });

  it("points the offseason hero at the current stage", () => {
    const base = dash();
    const cases: Array<[string, string, string]> = [
      ["draft", "Open Draft", "/dashboard/s1/draft"],
      ["free_agency", "Open Free Agency", "/dashboard/s1/free-agency"],
      ["roster_decisions", "Review Contracts", "/dashboard/s1/team/contracts"],
      ["staff_development", "Open Staff", "/dashboard/s1/staff-coaching/staff"],
    ];
    for (const [stage, cta, href] of cases) {
      renderHero(
        dash({
          offseasonStage: stage as HomeHeroDash["offseasonStage"],
          team: { ...base.team, upcomingGames: [] },
        }),
      );
      expect(screen.getByRole("link", { name: cta }).getAttribute("href")).toBe(
        href,
      );
      expect(
        screen
          .getByRole("link", { name: "Offseason Hub" })
          .getAttribute("href"),
      ).toBe("/dashboard/s1/offseason");
      cleanup();
    }
  });

  it("counts down to the trade deadline inside the last week", () => {
    renderHero(dash({ daysUntilTradeDeadline: 3 }));

    expect(screen.getByText("Trade deadline in 3 days")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Open trades" }).getAttribute("href"),
    ).toBe("/dashboard/s1/trades");
  });

  it("stays quiet about the deadline when it is far off or trading is closed", () => {
    renderHero(dash({ daysUntilTradeDeadline: 12 }));
    expect(screen.queryByText(/Trade deadline/)).toBeNull();
    cleanup();

    renderHero(dash({ daysUntilTradeDeadline: 2, tradesOpen: false }));
    expect(screen.queryByText(/Trade deadline/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Open trades" })).toBeNull();
  });

  it("offers training and development in the preseason only", () => {
    renderHero(dash({ seasonPhase: "preseason" }));
    expect(
      screen
        .getByRole("link", { name: "Training and development" })
        .getAttribute("href"),
    ).toBe("/dashboard/s1/development");
    cleanup();

    renderHero(dash());
    expect(
      screen.queryByRole("link", { name: "Training and development" }),
    ).toBeNull();
  });

  it("resolves modes in priority order", () => {
    const base = dash();
    expect(resolveHomeHeroMode(base, CALM)).toBe("next-game");
    expect(resolveHomeHeroMode(base, URGENT)).toBe("urgent-actions");
    expect(
      resolveHomeHeroMode(
        { ...base, team: { ...base.team, upcomingGames: [] } },
        CALM,
      ),
    ).toBe("offseason");
  });
});

function boardData(
  overrides: Partial<HomeTileBoardData> = {},
): HomeTileBoardData {
  return {
    team: { strength: 62.1, upcomingGames: [game("g1"), game("g2", false)] },
    owner: {
      patience: 57,
      primaryObjectives: [
        { description: "Make the playoffs", status: "active" },
      ],
      ownership: { moodLabel: "Displeased", concern: null },
    },
    health: {
      cash: 17_700_000,
      cashContext: { text: "Net weekly surplus $726K", direction: "up" },
      financialHealth: "stable",
    },
    tradeInbox: { totalPending: 2, pendingForActiveTeam: 1 },
    tradesOpen: true,
    daysUntilTradeDeadline: 12,
    nextImportantEvent: null,
    home: {
      topPlayer: {
        playerId: "p_1",
        name: "Avery Ives",
        position: "C",
        overall: 77,
        portrait: null,
      },
      biggestRiser: {
        playerId: "p_2",
        name: "Sam Rise",
        overall: 70,
        delta: 4,
        portrait: null,
      },
      biggestFaller: null,
      payroll: { payroll: 150_000_000, taxLine: 160_000_000, projectedTax: 0 },
      standing: {
        conferenceRank: 12,
        conferenceName: "Coastal",
        gamesBack: 2,
        playoffLabel: "bubble",
        streakLabel: "W3",
      },
      playoffSeries: null,
    },
    ...overrides,
  };
}

describe("HomeTileBoard", () => {
  it("links the seven hub tiles", () => {
    render(<HomeTileBoard saveId="s1" data={boardData()} />);

    const hrefs: Record<string, string> = {
      Roster: "/dashboard/s1/roster",
      Standings: "/dashboard/s1/league/standings",
      Finances: "/dashboard/s1/finances",
      Trades: "/dashboard/s1/trades",
      Development: "/dashboard/s1/development",
      Owner: "/dashboard/s1/franchise/ownership",
      Schedule: "/dashboard/s1/calendar",
    };
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(7);
    for (const [title, href] of Object.entries(hrefs)) {
      const link = links.find((el) => el.textContent?.includes(title));
      expect(link?.getAttribute("href"), title).toBe(href);
    }
  });

  it("shows each hub's fact", () => {
    render(<HomeTileBoard saveId="s1" data={boardData()} />);

    const roster = screen.getByRole("link", { name: /Roster/ });
    expect(within(roster).getByText("62.1")).toBeTruthy();
    expect(within(roster).getByText("Top: Avery Ives, C")).toBeTruthy();
    expect(
      within(roster).getByRole("img", { name: "Overall 77", hidden: true }),
    ).toBeTruthy();

    const standings = screen.getByRole("link", { name: /Standings/ });
    expect(within(standings).getByText("#12")).toBeTruthy();
    expect(within(standings).getByText("Coastal seed")).toBeTruthy();
    expect(
      within(standings).getByText("2 GB · On the bubble · W3"),
    ).toBeTruthy();

    const finances = screen.getByRole("link", { name: /Finances/ });
    expect(within(finances).getByText("$17.7M")).toBeTruthy();
    expect(within(finances).getByText(/Net weekly surplus/)).toBeTruthy();

    const trades = screen.getByRole("link", { name: /Trades/ });
    expect(within(trades).getByText("Offers waiting")).toBeTruthy();
    expect(within(trades).getByText("Deadline in 12 days")).toBeTruthy();

    const development = screen.getByRole("link", { name: /Development/ });
    expect(within(development).getByText("+4")).toBeTruthy();
    expect(within(development).getByText("Sam Rise")).toBeTruthy();
    expect(within(development).getByText("Biggest riser")).toBeTruthy();

    const owner = screen.getByRole("link", { name: /Owner/ });
    expect(within(owner).getByText("57")).toBeTruthy();
    expect(within(owner).getByText("Displeased")).toBeTruthy();

    const schedule = screen.getByRole("link", { name: /Schedule/ });
    expect(within(schedule).getByText("vs Oct 7")).toBeTruthy();
    expect(within(schedule).getByText("@ Oct 7")).toBeTruthy();
  });

  it("handles empty states", () => {
    render(
      <HomeTileBoard
        saveId="s1"
        data={boardData({
          team: { strength: 62.1, upcomingGames: [] },
          tradesOpen: false,
          tradeInbox: { totalPending: 0, pendingForActiveTeam: 0 },
          home: {
            topPlayer: null,
            biggestRiser: null,
            biggestFaller: null,
            standing: null,
            playoffSeries: null,
            payroll: boardData().home.payroll,
          },
        })}
      />,
    );

    expect(screen.getByText("No games scheduled")).toBeTruthy();
    expect(screen.getByText("Trading is closed")).toBeTruthy();
    expect(screen.getByText("No risers this season")).toBeTruthy();
    expect(screen.getByText("Standings start with the season")).toBeTruthy();
  });

  it("shows the next important event when no games are scheduled", () => {
    render(
      <HomeTileBoard
        saveId="s1"
        data={boardData({
          team: { strength: 62.1, upcomingGames: [] },
          nextImportantEvent: {
            date: "2026-06-25",
            title: "NBA Draft",
            daysUntil: 12,
            category: "draft",
            blocking: false,
          },
        })}
      />,
    );

    expect(screen.getByText(/Next: NBA Draft/)).toBeTruthy();
    expect(screen.queryByText("No games scheduled")).toBeNull();
  });

  it("says when the team leads its conference", () => {
    render(
      <HomeTileBoard
        saveId="s1"
        data={boardData({
          home: {
            ...boardData().home,
            standing: {
              conferenceRank: 1,
              conferenceName: "Coastal",
              gamesBack: 0,
              playoffLabel: "clinched",
              streakLabel: null,
            },
          },
        })}
      />,
    );

    expect(
      screen.getByText("Leading the conference · Playoffs clinched"),
    ).toBeTruthy();
  });

  it("shows payroll against the tax line and flags tight funds", () => {
    const base = boardData();
    render(
      <HomeTileBoard
        saveId="s1"
        data={boardData({
          health: { ...base.health, financialHealth: "critical" },
          home: {
            ...base.home,
            payroll: {
              payroll: 170_000_000,
              taxLine: 160_000_000,
              projectedTax: 1,
            },
          },
        })}
      />,
    );

    const finances = screen.getByRole("link", { name: /Finances/ });
    expect(within(finances).getByText(/\$10\.0M over tax/)).toBeTruthy();
    expect(
      within(finances).getByText("Business funds under pressure"),
    ).toBeTruthy();
  });

  it("shows riser and faller on the development tile", () => {
    const base = boardData();
    render(
      <HomeTileBoard
        saveId="s1"
        data={boardData({
          home: {
            ...base.home,
            biggestFaller: {
              playerId: "p_3",
              name: "Old Timer",
              overall: 61,
              delta: -3,
            },
          },
        })}
      />,
    );

    const dev = screen.getByRole("link", { name: /Development/ });
    expect(within(dev).getByText("Biggest riser")).toBeTruthy();
    expect(within(dev).getByText("SR")).toBeTruthy();
    expect(within(dev).getByText(/Old Timer -3/)).toBeTruthy();
  });

  it("shows the owner's open objective", () => {
    render(<HomeTileBoard saveId="s1" data={boardData()} />);

    const owner = screen.getByRole("link", { name: /Owner/ });
    expect(within(owner).getByText("Goal: Make the playoffs")).toBeTruthy();
  });
});

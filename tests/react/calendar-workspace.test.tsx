import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { asTeamId } from "@/domain/ids";

vi.mock("server-only", () => ({}));

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const streamMocks = vi.hoisted(() => ({
  streamSimulateToDate: vi.fn(),
}));
const actionMocks = vi.hoisted(() => ({
  resolveCalendarTradeInterruptAction: vi.fn(),
}));

vi.mock("@/application/actions", () => ({
  simulateToDateAction: vi.fn(),
  resolveCalendarTradeInterruptAction:
    actionMocks.resolveCalendarTradeInterruptAction,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh }),
  usePathname: () => "/dashboard/save_cal/calendar",
}));

vi.mock("@/components/calendar/stream-simulate-to-date", () => streamMocks);

import type { CalendarPageView } from "@/application/game-service";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import * as simulationActivity from "@/components/game/simulation-activity";
import { SimulationActivityProvider } from "@/components/game/simulation-activity";

function makeView(overrides: Partial<CalendarPageView> = {}): CalendarPageView {
  const currentDate = "2026-09-13";
  const selectedDate = "2026-09-18";
  const teamGame = {
    gameId: "g1",
    home: true,
    homeAwayLabel: "HOME" as const,
    opponentAbbreviation: "RIV",
    opponentName: "Rivermen",
    opponentTeamId: "team_2",
    status: "scheduled",
    seasonPhase: "Regular Season",
    scoreLabel: null,
    resultLabel: null,
    startTimeLabel: null,
  };

  return {
    save: { id: "save_cal", name: "Test" } as CalendarPageView["save"],
    dashboard: {
      controlledTeam: {
        id: "team_1",
        city: "Peoria",
        name: "Rivermen",
      },
    } as CalendarPageView["dashboard"],
    currentDate,
    year: 2026,
    month: 9,
    selectedDate,
    monthGrid: {
      year: 2026,
      month: 9,
      currentDate,
      nextTeamGameDate: selectedDate,
      weeks: [
        [
          {
            date: currentDate,
            inMonth: true,
            isToday: true,
            isPast: false,
            isFuture: false,
            events: [],
            indicatorCounts: {
              games: 0,
              actionRequired: 0,
              deadlines: 0,
              other: 0,
            },
            teamGame: null,
            specialEvents: [],
            isNextTeamGame: false,
            leagueMilestones: [],
          },
          {
            date: selectedDate,
            inMonth: true,
            isToday: false,
            isPast: false,
            isFuture: true,
            events: [],
            indicatorCounts: {
              games: 1,
              actionRequired: 0,
              deadlines: 0,
              other: 0,
            },
            teamGame,
            specialEvents: [],
            isNextTeamGame: true,
            leagueMilestones: [],
          },
        ],
      ],
    },
    inspector: {
      date: selectedDate,
      longDateLabel: "Friday, September 18, 2026",
      dateStatus: "future",
      phaseLabel: "Regular Season",
      simulationStatus: "Regular Season",
      teamGame,
      specialEvents: [],
      leagueContextSnippet: null,
      simulationPreview: {
        canSimulate: true,
        summaryLines: [
          "Home vs Rivermen",
          "Regular Season",
          "5 days of world simulation",
        ],
        days: 5,
        blockReason: null,
      },
      action: "simulate_to_date",
    },
    leagueContext: {
      conferenceRank: 3,
      divisionRank: 1,
      conferenceName: "East",
      divisionName: "North",
      wins: 42,
      losses: 30,
      conferenceWins: 28,
      conferenceLosses: 18,
      divisionWins: 12,
      divisionLosses: 6,
      gamesBack: 2.5,
      streakLabel: "W4",
    },
    nextTeamGameDate: selectedDate,
    teamBranding: {},
    timeDisabled: false,
    timeDisabledFlags: {
      userOnDraftClock: false,
      seasonReviewPending: false,
      pendingOwnerDecision: false,
    },
    recentMediaHighlights: [],
    userTeamId: asTeamId("team_1"),
    seasonInitializationRequired: false,
    openingDayPending: false,
    pauseBanner: {
      reason: null,
      message: null,
      resolveHref: null,
    },
    interrupt: null,
    resumeTo: null,
    simulationSummary: null,
    ...overrides,
  };
}

describe("CalendarWorkspace redesign", () => {
  it("renders Season setup banner when seasonInitializationRequired", () => {
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView({ seasonInitializationRequired: true })}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    expect(screen.getByText("Season setup")).toBeTruthy();
    expect(
      screen.getByText(/Simulate to begin the regular season/i),
    ).toBeTruthy();
    unmount();
  });

  it("renders Opening Day banner when openingDayPending", () => {
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView({ openingDayPending: true })}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    expect(screen.getByText("Opening Day")).toBeTruthy();
    expect(
      screen.getByText(/Simulate again to play today's games/i),
    ).toBeTruthy();
    unmount();
  });

  it("renders inspector and league context without shortcuts or stop conditions", () => {
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );

    expect(screen.getByText("League context")).toBeTruthy();
    expect(screen.getByText("#3")).toBeTruthy();
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(screen.getByText("Mon")).toBeTruthy();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Simulation shortcuts")).toBeNull();
    expect(screen.queryByText("Stop conditions")).toBeNull();
    expect(screen.queryByText("1 Day")).toBeNull();
    expect(screen.queryByLabelText("Calendar filters")).toBeNull();

    const today = screen.getByRole("button", {
      name: "2026-09-13, current simulation date",
    });
    expect(today.getAttribute("data-sim-cursor")).toBeNull();
    expect(today.className).toContain("border-team-ink");
    expect(today.className).not.toContain("ring-offset-2");
    const nextGame = screen.getByRole("button", {
      name: "2026-09-18, next team game, HOME vs Rivermen",
    });
    expect(nextGame.className).toContain("team-pulse");
    expect(nextGame.className).toContain("ring-zinc-100");
    unmount();
  });

  it("uses Next Game to confirm a simulate-to-date jump", () => {
    replace.mockClear();
    push.mockClear();
    streamMocks.streamSimulateToDate.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next Game →/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Simulate to date/i }),
    ).toBeTruthy();
    expect(streamMocks.streamSimulateToDate).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    unmount();
  });

  it("does not simulate when selecting a past date", () => {
    streamMocks.streamSimulateToDate.mockClear();
    const pastInspector = {
      date: "2026-09-10",
      longDateLabel: "Thursday, September 10, 2026",
      dateStatus: "past" as const,
      phaseLabel: "Regular Season",
      simulationStatus: "Regular Season",
      teamGame: null,
      specialEvents: [],
      leagueContextSnippet: null,
      simulationPreview: null,
      action: "none" as const,
    };
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView({
            selectedDate: "2026-09-10",
            inspector: pastInspector,
          })}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    expect(
      screen.queryByRole("button", { name: /Simulate to date/i }),
    ).toBeNull();
    expect(streamMocks.streamSimulateToDate).not.toHaveBeenCalled();
    unmount();
  });

  it("disables calendar navigation while simulation is pending", () => {
    push.mockClear();
    const spy = vi
      .spyOn(simulationActivity, "useSimulationActivity")
      .mockReturnValue({
        simulationPending: true,
        setSimulationPending: vi.fn(),
        simulationProgress: null,
        setSimulationProgress: vi.fn(),
      });

    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );

    expect(screen.getByText(/Simulation in progress/i)).toBeTruthy();
    expect(screen.queryByText(/Simulating —/)).toBeNull();
    expect(screen.queryByText(/% complete/)).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Prev" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Today" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /Next Game →/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Next Game →/i }));
    expect(push).not.toHaveBeenCalled();
    spy.mockRestore();
    unmount();
  });

  it("confirms before simulating when a future date is pressed", async () => {
    replace.mockClear();
    streamMocks.streamSimulateToDate.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "2026-09-18, next team game, HOME vs Rivermen",
      }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Simulate through 2026-09-18/)).toBeTruthy();
    expect(streamMocks.streamSimulateToDate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Simulate to date/i }));
    await waitFor(() => {
      expect(streamMocks.streamSimulateToDate).toHaveBeenCalledWith(
        "save_cal",
        "2026-09-18",
        expect.any(Function),
      );
    });
    unmount();
  });

  it("keeps scroll position when changing month", () => {
    push.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(push).toHaveBeenCalled();
    expect(push.mock.calls[0]?.[1]).toEqual({ scroll: false });
    unmount();
  });

  it("moves the current-date highlight and overlays the team result during playback", async () => {
    streamMocks.streamSimulateToDate.mockImplementation(
      async (_saveId, _target, onEvent) => {
        onEvent({
          type: "progress",
          daysRequested: 5,
          daysAdvanced: 5,
          currentDate: "2026-09-18",
          completedDate: "2026-09-18",
          phase: "regular",
          offseasonStage: "in_season",
          seasonYear: 2026,
          gamesSimulated: 12,
          percentComplete: 100,
          teamGame: {
            opponentAbbreviation: "RIV",
            resultLabel: "W 110-102",
            home: true,
          },
        });
      },
    );
    const { container, unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "2026-09-18, next team game, HOME vs Rivermen",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Simulate to date/i }));
    await waitFor(() => {
      const cursor = screen.getByRole("button", {
        name: /2026-09-18, simulating, current simulation date/,
      });
      expect(cursor.getAttribute("data-sim-cursor")).toBe("true");
      expect(cursor.className).toContain("ring-offset-2");
      expect(cursor.className).not.toContain("team-pulse");
      expect(cursor.className).not.toContain("ring-zinc-100");
      expect(screen.getByText(/W 110-102/)).toBeTruthy();
      expect(screen.queryByText(/Simulating —/)).toBeNull();
      expect(screen.queryByText(/% complete/)).toBeNull();
      expect(screen.getByRole("status").textContent).toMatch(
        /Simulating regular/,
      );
      expect(screen.getByRole("status").textContent).toMatch(/2026-09-18/);
      const grid = container.querySelector(".grid.grid-cols-7");
      expect(grid?.className).toContain("pointer-events-none");
      expect(grid?.className).not.toContain("opacity-60");
    });
    unmount();
  });

  it("suppresses selected and next-game rings on every cell while simulating", async () => {
    streamMocks.streamSimulateToDate.mockImplementation(
      async (_saveId, _target, onEvent) => {
        onEvent({
          type: "progress",
          daysRequested: 5,
          daysAdvanced: 1,
          currentDate: "2026-09-13",
          completedDate: "2026-09-13",
          phase: "regular",
          offseasonStage: "in_season",
          seasonYear: 2026,
          gamesSimulated: 0,
          percentComplete: 20,
          teamGame: null,
        });
      },
    );
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "2026-09-18, next team game, HOME vs Rivermen",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Simulate to date/i }));
    await waitFor(() => {
      const cursor = screen.getByRole("button", {
        name: /2026-09-13, simulating, current simulation date/,
      });
      expect(cursor.getAttribute("data-sim-cursor")).toBe("true");
      const selectedDay = screen.getByRole("button", {
        name: /2026-09-18, next team game, HOME vs Rivermen/,
      });
      expect(selectedDay.getAttribute("data-sim-cursor")).toBeNull();
      expect(selectedDay.className).not.toContain("team-pulse");
      expect(selectedDay.className).not.toContain("ring-zinc-100");
      expect(selectedDay.className).not.toContain("ring-offset-2");
    });
    unmount();
  });

  it("flips the visible month when live current date leaves the loaded grid", async () => {
    streamMocks.streamSimulateToDate.mockImplementation(
      async (_saveId, _target, onEvent) => {
        onEvent({
          type: "progress",
          daysRequested: 20,
          daysAdvanced: 19,
          currentDate: "2026-10-02",
          completedDate: "2026-10-01",
          phase: "regular",
          offseasonStage: "in_season",
          seasonYear: 2026,
          gamesSimulated: 40,
          percentComplete: 95,
          teamGame: null,
        });
      },
    );
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "2026-09-18, next team game, HOME vs Rivermen",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Simulate to date/i }));
    await waitFor(() => {
      expect(screen.getByText("October 2026")).toBeTruthy();
      expect(screen.getByText("2026-10-02")).toBeTruthy();
      const cursor = screen.getByRole("button", {
        name: /2026-10-02, simulating, current simulation date/,
      });
      expect(cursor.getAttribute("data-sim-cursor")).toBe("true");
      expect(cursor.className).toContain("ring-offset-2");
    });
    unmount();
  });

  it("keeps the month grid on mobile and does not auto-open a drawer", async () => {
    const matchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
      }),
    });
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    expect(screen.getByText("Mon")).toBeTruthy();
    expect(screen.getByText("September 2026")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "2026-09-13, current simulation date",
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeTruthy();
    });
    expect(
      screen.queryByRole("button", { name: /Simulate to date/i }),
    ).toBeNull();
    unmount();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: matchMedia,
    });
  });

  it("shows Continue after a mid-jump owner decision pause", () => {
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    expect(
      screen.getByRole("button", { name: /Continue to 2026-10-01/ }),
    ).toBeTruthy();
    unmount();
  });
});

const tradeReview = {
  decisionId: "od_1",
  offeringTeamName: "Boston Celtics",
  receivingTeamName: "Toronto Hawks",
  motivationLabel: "Looking for help at SF",
  youReceive: [
    {
      id: "p1",
      kind: "player" as const,
      name: "Wei Bright",
      detail: "C · OVR 59",
      href: null,
    },
  ],
  youSend: [
    {
      id: "p2",
      kind: "player" as const,
      name: "OG Anunoby",
      detail: "SF · OVR 84",
      href: null,
    },
  ],
  recommendation: "favor_send" as const,
  netValue: -52,
  reasons: ["Trade favors the other side on asset value"],
  rosterFitPct: 61,
  strategicFitPct: 50,
  financialPct: 75,
  rosterImpact: [],
  bothSidesOwned: false,
};

function interruptView(): CalendarPageView {
  return makeView({
    timeDisabled: true,
    timeDisabledFlags: {
      userOnDraftClock: false,
      seasonReviewPending: false,
      pendingOwnerDecision: true,
    },
    pauseBanner: {
      reason: "owner_decision",
      message:
        "Simulation paused — a required owner decision must be resolved.",
      resolveHref: "/dashboard/save_cal/trades/od_1",
    },
    interrupt: {
      kind: "trade_offer",
      decisionId: "od_1",
      review: tradeReview,
    },
    resumeTo: "2026-10-01",
  });
}

describe("CalendarWorkspace in-sim interrupt", () => {
  it("opens the trade interrupt dialog from view.interrupt", () => {
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={interruptView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByLabelText("Close overlay")).toBeNull();
    expect(screen.getByText(/Boston Celtics → Toronto Hawks/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    unmount();
  });

  it("Stop simulation closes the modal, keeps the pause banner, and does not sim", () => {
    streamMocks.streamSimulateToDate.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={interruptView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop simulation" }));
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(
      /Simulation paused/i,
    );
    expect(
      screen.getByRole("button", { name: "Resolve Decision" }),
    ).toBeTruthy();
    expect(streamMocks.streamSimulateToDate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Resolve Decision" }));
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    unmount();
  });

  it("Accept/Decline double-click does not double-resume", async () => {
    streamMocks.streamSimulateToDate.mockClear();
    streamMocks.streamSimulateToDate.mockResolvedValue(undefined);
    actionMocks.resolveCalendarTradeInterruptAction.mockClear();
    let release: ((value: unknown) => void) | undefined;
    actionMocks.resolveCalendarTradeInterruptAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={interruptView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(
      actionMocks.resolveCalendarTradeInterruptAction,
    ).toHaveBeenCalledTimes(1);
    release?.({ ok: true, interrupt: null, resumeTo: "2026-10-01" });
    await waitFor(() => {
      expect(streamMocks.streamSimulateToDate).toHaveBeenCalledTimes(1);
    });
    expect(streamMocks.streamSimulateToDate).toHaveBeenCalledWith(
      "save_cal",
      "2026-10-01",
      expect.any(Function),
    );
    unmount();
  });

  it("Let AI decide closes the modal and resumes", async () => {
    streamMocks.streamSimulateToDate.mockClear();
    streamMocks.streamSimulateToDate.mockResolvedValue(undefined);
    actionMocks.resolveCalendarTradeInterruptAction.mockReset();
    actionMocks.resolveCalendarTradeInterruptAction.mockResolvedValue({
      ok: true,
      interrupt: null,
      resumeTo: "2026-10-01",
    });
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={interruptView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Let AI decide" }));
    await waitFor(() => {
      expect(streamMocks.streamSimulateToDate).toHaveBeenCalledTimes(1);
    });
    expect(
      actionMocks.resolveCalendarTradeInterruptAction,
    ).toHaveBeenCalledWith("save_cal", "od_1", "let_ai_decide", "2026-10-01");
    unmount();
  });

  it("keeps the modal open and shows an error when the action fails", async () => {
    streamMocks.streamSimulateToDate.mockClear();
    actionMocks.resolveCalendarTradeInterruptAction.mockReset();
    actionMocks.resolveCalendarTradeInterruptAction.mockResolvedValue({
      ok: false,
      error: "Trade validation failed.",
    });
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={interruptView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(
        /Trade validation failed/,
      );
    });
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
    expect(streamMocks.streamSimulateToDate).not.toHaveBeenCalled();
    unmount();
  });

  it("autoResume fires once and clears the URL param", async () => {
    streamMocks.streamSimulateToDate.mockClear();
    streamMocks.streamSimulateToDate.mockResolvedValue(undefined);
    replace.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
          autoResume
        />
      </SimulationActivityProvider>,
    );
    await waitFor(() => {
      expect(streamMocks.streamSimulateToDate).toHaveBeenCalledTimes(1);
    });
    expect(replace).toHaveBeenCalled();
    const href = String(replace.mock.calls[0]?.[0] ?? "");
    expect(href).not.toMatch(/autoResume=/);
    unmount();
  });

  it("does not open SimulationSummaryModal on an interrupt stop", async () => {
    streamMocks.streamSimulateToDate.mockImplementation(
      async (_saveId, _target, onEvent) => {
        onEvent({
          type: "done",
          ok: true,
          daysAdvanced: 2,
          highlightCount: 1,
          fromDate: "2026-09-13",
          toDate: "2026-09-15",
          currentDate: "2026-09-15",
          requestedTargetDate: "2026-10-01",
          stopReason: "pending_owner_decision",
        });
      },
    );
    replace.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next Game →/ }));
    fireEvent.click(screen.getByRole("button", { name: /Simulate to date/i }));
    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
    const href = String(replace.mock.calls.at(-1)?.[0] ?? "");
    expect(href).not.toMatch(/simSummary=1/);
    expect(screen.queryByText(/days advanced/i)).toBeNull();
    unmount();
  });

  it("opens SimulationSummaryModal after a completed resume with no interrupt", async () => {
    streamMocks.streamSimulateToDate.mockImplementation(
      async (_saveId, _target, onEvent) => {
        onEvent({
          type: "done",
          ok: true,
          daysAdvanced: 16,
          highlightCount: 3,
          fromDate: "2026-09-15",
          toDate: "2026-10-01",
          currentDate: "2026-10-01",
          requestedTargetDate: "2026-10-01",
        });
      },
    );
    replace.mockClear();
    const { unmount } = render(
      <SimulationActivityProvider>
        <CalendarWorkspace
          view={makeView()}
          saveId="save_cal"
          showSimSummary={false}
          daysAdvanced={0}
          highlightCount={0}
          resumeTo="2026-10-01"
        />
      </SimulationActivityProvider>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Continue to 2026-10-01/ }),
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
    const href = String(replace.mock.calls.at(-1)?.[0] ?? "");
    expect(href).toMatch(/simSummary=1/);
    unmount();
  });
});

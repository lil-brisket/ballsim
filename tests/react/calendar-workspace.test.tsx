import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { asTeamId } from "@/domain/ids";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  simulateToDateAction: vi.fn(),
}));

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const streamMocks = vi.hoisted(() => ({
  streamSimulateToDate: vi.fn(),
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
      expect(
        screen.getByRole("button", {
          name: /2026-09-18, current simulation date/,
        }),
      ).toBeTruthy();
      expect(screen.getByText(/W 110-102/)).toBeTruthy();
      expect(screen.getByText(/Day 5 \/ 5/)).toBeTruthy();
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

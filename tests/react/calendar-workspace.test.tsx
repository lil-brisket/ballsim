import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { asTeamId } from "@/domain/ids";

vi.mock("server-only", () => ({}));
vi.mock("@/application/actions", () => ({
  simulateToDateAction: vi.fn(),
}));

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/dashboard/save_cal/calendar",
}));

import type { CalendarPageView } from "@/application/game-service";
import { CalendarWorkspace } from "@/components/calendar/CalendarWorkspace";
import * as simulationActivity from "@/components/game/simulation-activity";
import { SimulationActivityProvider } from "@/components/game/simulation-activity";

function makeView(
  overrides: Partial<CalendarPageView> = {},
): CalendarPageView {
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

    expect(screen.getByText("Friday, September 18, 2026")).toBeTruthy();
    expect(screen.getAllByText("HOME").length).toBeGreaterThan(0);
    expect(screen.getByText("League context")).toBeTruthy();
    expect(screen.getByText("#3")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Simulate to date/i }),
    ).toBeTruthy();

    expect(screen.queryByText("Simulation shortcuts")).toBeNull();
    expect(screen.queryByText("Stop conditions")).toBeNull();
    expect(screen.queryByText("1 Day")).toBeNull();
    expect(screen.queryByLabelText("Calendar filters")).toBeNull();
    unmount();
  });

  it("uses Next Game as date navigation only", () => {
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
    fireEvent.click(
      screen.getByRole("button", { name: /Next Game →/i }),
    );
    expect(push).toHaveBeenCalled();
    const href = String(push.mock.calls[0]?.[0] ?? "");
    expect(href).toContain("date=2026-09-18");
    expect(href).not.toContain("simulate");
    unmount();
  });

  it("does not render simulate action for past dates", () => {
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
    expect(screen.queryByRole("button", { name: /Simulate to date/i })).toBeNull();
    unmount();
  });

  it("disables calendar navigation while simulation is pending", () => {
    push.mockClear();
    const spy = vi
      .spyOn(simulationActivity, "useSimulationActivity")
      .mockReturnValue({
        simulationPending: true,
        setSimulationPending: vi.fn(),
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
});

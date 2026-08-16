import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test",
}));

vi.mock("@/application/actions", () => ({
  advanceDayAction: vi.fn(),
  advanceWeekAction: vi.fn(),
  advanceUntilPhaseAction: vi.fn(),
  openSaveAction: vi.fn(),
  deleteSaveAction: vi.fn(),
}));

import { GameModeCard } from "@/components/game/GameModeCard";
import { AdvanceTimeControls } from "@/components/game/AdvanceTimeControls";
import {
  NextActionPanel,
  resolveNextActionPresentation,
} from "@/components/game/NextActionPanel";
import { SaveCard } from "@/components/game/SaveCard";
import { listGameModeDefinitions } from "@/application/game-mode-catalog";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import type { DashboardSnapshot } from "@/state/selectors";
import type { OwnerSavePreview } from "@/application/game-service";

function baseDashboard(
  overrides: Partial<DashboardSnapshot> = {},
): DashboardSnapshot {
  return {
    saveId: "save_test",
    schemaVersion: 25,
    currentDate: "2026-11-01",
    seasonYear: 2026,
    seasonPhase: "regular",
    offseasonStage: "none",
    leagueName: "Test League",
    mode: "owner",
    teamSelectionLocked: true,
    userOnDraftClock: false,
    controlledTeam: {
      id: "team_1",
      city: "Harbor",
      name: "Waves",
      abbreviation: "HAR",
    },
    teamCount: 12,
    playerCount: 100,
    payroll: 1,
    capSpace: 1,
    cash: 1,
    revenueTotal: 1,
    expensesTotal: 1,
    netIncome: 0,
    standingsRank: 1,
    controlledStanding: { wins: 0, losses: 0 },
    recentResults: [],
    upcomingGames: [],
    objectives: [],
    recentActivity: [],
    notifications: [],
    unreadNotificationCount: 0,
    playoffs: {
      status: "pending",
      fieldSize: 8,
      userQualified: false,
      championTeamId: null,
    },
    simulationFrequency: "daily",
    ...overrides,
  };
}

describe("game shell UI", () => {
  it("renders available and coming-soon mode cards", () => {
    const modes = listGameModeDefinitions();
    const { unmount } = render(
      <>
        {modes.map((mode) => (
          <GameModeCard key={mode.id} mode={mode} />
        ))}
      </>,
    );
    expect(screen.getByText("Owner Mode")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Owner Mode/i }).getAttribute("href"),
    ).toBe("/owner");
    expect(screen.queryByRole("link", { name: /Select Owner Mode/i })).toBeNull();
    expect(screen.getByText("Career Mode")).toBeTruthy();
    expect(screen.getByText("Dynasty Mode")).toBeTruthy();
    expect(screen.getAllByText("Coming Soon").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Career Mode/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Dynasty Mode/i })).toBeNull();
    expect(screen.queryByText("Continue")).toBeNull();
    unmount();
  });

  it("SaveCard shows mode, team, and season for a valid preview", () => {
    const preview: OwnerSavePreview = {
      ok: true,
      id: "save_1",
      name: "Harbor Franchise",
      updatedAt: new Date("2026-08-15T12:00:00.000Z"),
      createdAt: new Date("2026-08-01T12:00:00.000Z"),
      mode: "owner",
      controlledTeam: {
        id: "team_1",
        city: "Harbor",
        name: "Waves",
        abbreviation: "HAR",
      },
      seasonYear: 2026,
      currentDate: "2026-11-01",
      seasonPhase: "regular",
      teamSelectionLocked: true,
    };
    const { unmount } = render(
      <ul>
        <SaveCard preview={preview} />
      </ul>,
    );
    expect(screen.getByText("Harbor Franchise")).toBeTruthy();
    expect(screen.getByText("Harbor Waves")).toBeTruthy();
    expect(screen.getByText(/Season 2026/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    unmount();
  });

  it("next action prefers draft clock presentation only", () => {
    const action = resolveNextActionPresentation(
      baseDashboard({ userOnDraftClock: true }),
      "save_test",
    );
    expect(action.title).toMatch(/draft/i);
    expect(action.href).toBe("/dashboard/save_test/draft");
  });

  it("next action surfaces unread notifications without inventing phase rules", () => {
    const action = resolveNextActionPresentation(
      baseDashboard({
        unreadNotificationCount: 2,
        notifications: [
          {
            id: "n1",
            type: "info",
            severity: "info",
            message: "Hello",
            read: false,
          },
        ],
      }),
      "save_test",
    );
    expect(action.title).toMatch(/events/i);
    expect(action.href).toBe("/dashboard/save_test/notifications");
  });

  it("advance controls use existing day/week/phase actions", () => {
    const { unmount } = render(
      <AdvanceTimeControls
        saveId="save_test"
        returnPath="/dashboard/save_test"
        simulationFrequency="daily"
      />,
    );
    expect(screen.getByRole("button", { name: "Advance day" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Advance 7 days" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Until next phase" }),
    ).toBeTruthy();
    unmount();
  });

  it("owner nav config includes verified destinations only", () => {
    const hrefs = OWNER_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("");
    expect(hrefs).toContain("/team");
    expect(hrefs).toContain("/roster");
    expect(hrefs).toContain("/draft");
    expect(hrefs).toContain("/free-agency");
    expect(hrefs).toContain("/business");
    expect(hrefs).not.toContain("/trades");
  });

  it("NextActionPanel renders link when provided", () => {
    const { unmount } = render(
      <NextActionPanel
        action={{
          title: "Review draft board",
          description: "Pick a prospect",
          href: "/dashboard/save_test/draft",
          hrefLabel: "Open Draft",
        }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Open Draft" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/draft");
    unmount();
  });
});

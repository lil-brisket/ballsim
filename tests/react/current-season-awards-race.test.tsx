import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanup, render, screen, within } from "@testing-library/react";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { CurrentSeasonAwards } from "@/components/history/CurrentSeasonAwards";
import { RetiredJerseysPanel } from "@/components/history/LegacyPanels";
import type {
  AwardRaceContenderView,
  CurrentSeasonAwardGroup,
  CurrentSeasonAwardSlot,
} from "@/state/awards-hub-selectors";

afterEach(cleanup);

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  fireStaffAction: vi.fn(),
  renewStaffContractAction: vi.fn(),
  retireJerseyNumberAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/s1/awards",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function contender(rank: number): AwardRaceContenderView {
  return {
    rank,
    subjectId: `p${rank}`,
    name: `Player ${rank}`,
    href: `/dashboard/s1/players/p${rank}`,
    teamId: "t1",
    teamAbbreviation: "ABC",
    score: 100 - rank,
  };
}

function slot(
  key: string,
  displayName: string,
  race: CurrentSeasonAwardSlot["race"],
): CurrentSeasonAwardSlot {
  return {
    key,
    displayName,
    shortLabel: displayName,
    awardId: "mvp",
    tier: "major",
    cadence: "yearly",
    period: null,
    periodLabel: null,
    status: "pending",
    winner: null,
    race,
  };
}

function renderAwards(groups: CurrentSeasonAwardGroup[]) {
  return render(
    <EntityDrawerProvider saveId="s1">
      <CurrentSeasonAwards saveId="s1" seasonYear={2026} groups={groups} />
    </EntityDrawerProvider>,
  );
}

describe("CurrentSeasonAwards races", () => {
  it("shows the week label, up to five ranked contenders and one note", () => {
    const race = {
      throughDate: "2027-01-11",
      contenders: [1, 2, 3, 4, 5, 6].map(contender),
    };
    renderAwards([
      {
        tier: "major",
        label: "Major awards",
        slots: [slot("mvp", "MVP", race), slot("roy", "Rookie", race)],
      },
    ]);
    expect(screen.getAllByText("Week ending January 11")).toHaveLength(2);
    const lists = screen.getAllByRole("list");
    const raceList = lists.find((l) => l.tagName === "OL")!;
    expect(within(raceList).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("Player 6")).toBeNull();
    expect(screen.getAllByText("ABC").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rankings update every Monday/)).toHaveLength(1);
  });

  it("falls back to the first-week copy without a race or note", () => {
    renderAwards([
      {
        tier: "major",
        label: "Major awards",
        slots: [slot("mvp", "MVP", null)],
      },
    ]);
    expect(
      screen.getByText("Race takes shape after the first full week."),
    ).toBeTruthy();
    expect(screen.queryByText(/Rankings update every Monday/)).toBeNull();
  });
});

describe("RetiredJerseysPanel", () => {
  it("lists retired numbers and a retire form posting the return path", () => {
    const { container } = render(
      <EntityDrawerProvider saveId="s1">
        <RetiredJerseysPanel
          saveId="s1"
          returnPath="/dashboard/s1/team/history?tab=jerseys"
          jerseys={{
            retiredNumbers: [
              { number: 23, playerName: "Old Star", playerId: "o" },
            ],
            legends: [
              {
                playerId: "l1",
                playerName: "Legend One",
                number: 7,
                seasonsWithTeam: 5,
                summary: "Five seasons.",
                blockedReason: null,
              },
            ],
          }}
        />
      </EntityDrawerProvider>,
    );
    expect(screen.getByText("23")).toBeTruthy();
    expect(screen.getByText("Old Star")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retire No. 7" })).toBeTruthy();
    expect(
      container
        .querySelector<HTMLInputElement>("input[name=returnPath]")
        ?.getAttribute("value"),
    ).toBe("/dashboard/s1/team/history?tab=jerseys");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { HistoryHub } from "@/components/history/HistoryHub";
import { createEmptyAwardHistory } from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import {
  toHistoryHubView,
  type HistoryHubParams,
  type HistoryHubRoute,
} from "@/state/history-hub-selectors";
import {
  addPlayerToState,
  createAwardsTestState,
} from "../systems/awards/helpers";
import {
  awardResult,
  playerSeason,
  seasonRecord,
  teamIds,
  withAwards,
  withFranchiseHistory,
  withPlayerHistory,
} from "../state/history-fixtures";

afterEach(cleanup);

vi.mock("@/application/actions", () => ({
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
  fetchStaffDrawerViewAction: vi.fn(),
  fireStaffAction: vi.fn(),
  renewStaffContractAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_awards/awards",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function renderHub(
  state: GameState,
  route: HistoryHubRoute,
  params: HistoryHubParams,
) {
  return render(
    <EntityDrawerProvider saveId={state.meta.saveId}>
      <HistoryHub view={toHistoryHubView(state, route, params)} />
    </EntityDrawerProvider>,
  );
}

function emptyState(): GameState {
  const state = createAwardsTestState({ phase: "regular" });
  const empty = Object.fromEntries(teamIds(state).map((id) => [id, []]));
  const cleared = withFranchiseHistory(state, empty);
  return {
    ...cleared,
    business: {
      ...cleared.business,
      awards: createEmptyAwardHistory(),
      playerHistory: {},
    },
  };
}

function oneSeasonState(): GameState {
  let state = emptyState();
  const [a, b] = teamIds(state);
  state = addPlayerToState(state, "star", a!);
  state = withFranchiseHistory(state, {
    [a!]: [
      seasonRecord({
        year: 2025,
        playoffResult: "champion",
        wins: 60,
        losses: 22,
        city: "Alpha",
        name: "Aces",
      }),
    ],
    [b!]: [
      seasonRecord({
        year: 2025,
        playoffResult: "finals",
        city: "Beta",
        name: "Bees",
      }),
    ],
  });
  state = withPlayerHistory(state, {
    star: [playerSeason({ year: 2025, teamId: a! })],
  });
  return withAwards(state, [
    awardResult({
      awardId: "mvp",
      seasonYear: 2025,
      winnerId: "star",
      teamId: a,
    }),
  ]);
}

describe("HistoryHub", () => {
  it("renders the awards header with only the awards tabs", () => {
    renderHub(emptyState(), "awards", {});
    expect(screen.getByRole("heading", { name: "Awards" })).toBeTruthy();
    expect(screen.getByText("Award races, winners and history.")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Awards sections" });
    const current = within(nav).getByRole("link", { name: "Current Season" });
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(
      within(nav)
        .getByRole("link", { name: "Award History" })
        .getAttribute("href"),
    ).toBe("/dashboard/save_awards/awards?tab=awards");
    expect(
      within(nav).queryByRole("link", { name: "Team Records" }),
    ).toBeNull();
  });

  it("renders the team history header and tabs", () => {
    renderHub(emptyState(), "team", {});
    expect(screen.getByRole("heading", { name: "Team History" })).toBeTruthy();
    const nav = screen.getByRole("navigation", {
      name: "Team history sections",
    });
    expect(
      within(nav)
        .getByRole("link", { name: "Team Records" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      within(nav)
        .getByRole("link", { name: "Retired Jerseys" })
        .getAttribute("href"),
    ).toBe("/dashboard/save_awards/team/history?tab=jerseys");
    expect(
      within(nav)
        .getByRole("link", { name: "Player History" })
        .getAttribute("href"),
    ).toBe("/dashboard/save_awards/team/history?tab=players");
  });

  it("hides the tab navigation on the league history route", () => {
    renderHub(emptyState(), "history", {});
    expect(
      screen.getByRole("heading", { name: "League History" }),
    ).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders the retired jerseys tab section", () => {
    renderHub(emptyState(), "team", { tab: "jerseys" });
    expect(screen.getByText("Retired numbers")).toBeTruthy();
    expect(screen.getByText("Franchise legends")).toBeTruthy();
  });

  it("shows empty states on a save with no history", () => {
    const state = emptyState();
    const league = renderHub(state, "history", { tab: "league" });
    expect(screen.getByText("No completed seasons yet.")).toBeTruthy();
    league.unmount();
    const awards = renderHub(state, "awards", { tab: "awards" });
    expect(
      screen.getAllByText("No award history available yet.").length,
    ).toBeGreaterThan(0);
    awards.unmount();
    renderHub(state, "team", { tab: "players" });
    expect(
      screen.getByText("No player history available for this save."),
    ).toBeTruthy();
  });

  it("renders pending current-season awards before any race exists", () => {
    renderHub(emptyState(), "awards", { tab: "current" });
    expect(
      screen.getAllByText("Race takes shape after the first full week.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/Rankings update every Monday/)).toBeNull();
  });

  it("renders league champions with runner-up after one completed season", () => {
    renderHub(oneSeasonState(), "history", { tab: "league" });
    expect(screen.getByText("Runner-Up")).toBeTruthy();
    expect(screen.getByText("Alpha Aces")).toBeTruthy();
    expect(screen.getByText("Beta Bees")).toBeTruthy();
  });

  it("renders the award pivot and team detail", () => {
    const state = oneSeasonState();
    const awards = renderHub(state, "awards", { tab: "awards" });
    expect(screen.getByText("MVP")).toBeTruthy();
    expect(screen.getByText("star Player")).toBeTruthy();
    awards.unmount();
    const [a] = teamIds(state);
    renderHub(state, "team", { tab: "teams", team: a });
    expect(screen.getByText("Finals appearances")).toBeTruthy();
    expect(screen.getByText("Worst season")).toBeTruthy();
  });

  it("filters players by name and shows the selected player's history", () => {
    renderHub(oneSeasonState(), "team", { tab: "players", player: "star" });
    expect(screen.getByText("Seasons played")).toBeTruthy();
    expect(screen.getByText("View player profile").getAttribute("href")).toBe(
      "/dashboard/save_awards/players/star",
    );
    const search = screen.getByPlaceholderText("Search player...");
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(/No players match/)).toBeTruthy();
  });
});

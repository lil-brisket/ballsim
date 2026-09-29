import { describe, expect, it } from "vitest";
import { createEmptyAwardHistory } from "@/domain/entities/awards";
import type { GameState } from "@/state/game-state";
import {
  toAwardHistoryView,
  toAwardsHubView,
} from "@/state/awards-hub-selectors";
import {
  toTeamHistoryView,
  toTeamRecordsView,
} from "@/state/franchise-selectors";
import {
  HISTORY_HUB_TABS,
  resolveHistoryHubTab,
  toHistoryHubView,
} from "@/state/history-hub-selectors";
import { toLeagueHistoryView } from "@/state/league-history-selectors";
import {
  toPlayerHistoryIndex,
  toPlayerHistoryView,
} from "@/state/player-history-selectors";
import { createTestGameState } from "../factories/game-state";
import {
  seasonRecord,
  teamIds,
  withFranchiseHistory,
} from "./history-fixtures";

function legacyEmptyState(): GameState {
  const state = createTestGameState({ saveId: "legacy_empty" });
  const emptyFranchise = Object.fromEntries(
    teamIds(state).map((teamId) => [teamId, []]),
  );
  return {
    ...withFranchiseHistory(state, emptyFranchise),
    business: {
      ...withFranchiseHistory(state, emptyFranchise).business,
      awards: createEmptyAwardHistory(),
      playerHistory: {},
    },
  };
}

describe("history hub on a save with no history", () => {
  const state = legacyEmptyState();

  it("every selector returns a valid empty result", () => {
    expect(toAwardHistoryView(state).hasHistory).toBe(false);
    expect(toAwardsHubView(state).majorAwards).toEqual([]);
    expect(toLeagueHistoryView(state).seasons).toEqual([]);
    expect(toTeamRecordsView(state)).toEqual([]);
    expect(
      toTeamHistoryView(state, state.user.activeOwnerTeamId).hasHistory,
    ).toBe(false);
    expect(toPlayerHistoryIndex(state)).toEqual([]);
    expect(toPlayerHistoryView(state, "missing").hasHistory).toBe(false);
  });

  it("builds every hub tab on both routes without throwing", () => {
    for (const route of ["awards", "history"] as const) {
      for (const tab of HISTORY_HUB_TABS) {
        const view = toHistoryHubView(state, route, { tab });
        expect(view.tab).toBe(tab);
      }
    }
  });

  it("renders a save with exactly one completed season", () => {
    const [a, b] = teamIds(state);
    const one = withFranchiseHistory(state, {
      [a!]: [seasonRecord({ year: 2026, playoffResult: "champion" })],
      [b!]: [seasonRecord({ year: 2026, playoffResult: "finals" })],
    });
    expect(toLeagueHistoryView(one).seasons).toHaveLength(1);
    expect(toTeamRecordsView(one)).toHaveLength(2);
    expect(
      toHistoryHubView(one, "history", { tab: "league" }).leagueHistory
        ?.seasons,
    ).toHaveLength(1);
  });
});

describe("resolveHistoryHubTab (legacy deep links)", () => {
  const state = createTestGameState({ saveId: "deep_links" });
  const year = state.competition.season.year;

  it("defaults /awards to the current season", () => {
    expect(resolveHistoryHubTab(state, "awards", {})).toBe("current");
    expect(
      resolveHistoryHubTab(state, "awards", { season: String(year) }),
    ).toBe("current");
  });

  it("sends /awards?season=<past year> to the Awards tab", () => {
    expect(
      resolveHistoryHubTab(state, "awards", { season: String(year - 1) }),
    ).toBe("awards");
  });

  it("defaults /history to Team Records for the owner team", () => {
    expect(resolveHistoryHubTab(state, "history", {})).toBe("teams");
    const view = toHistoryHubView(state, "history", {});
    expect(view.selectedTeam?.teamId).toBe(state.user.activeOwnerTeamId);
    expect(view.ownerFranchise).not.toBeNull();
  });

  it("honours explicit tab, team, and player params", () => {
    expect(resolveHistoryHubTab(state, "history", { tab: "players" })).toBe(
      "players",
    );
    expect(resolveHistoryHubTab(state, "history", { tab: "bogus" })).toBe(
      "teams",
    );
    const [, other] = teamIds(state);
    const teamView = toHistoryHubView(state, "history", {
      tab: "teams",
      team: other,
    });
    expect(teamView.selectedTeam?.teamId).toBe(other);
    expect(teamView.ownerStory).toBeNull();
    const playerView = toHistoryHubView(state, "history", {
      tab: "players",
      player: "p_x",
    });
    expect(playerView.selectedPlayer?.hasHistory).toBe(false);
  });
});

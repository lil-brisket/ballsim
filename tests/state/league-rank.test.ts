import { describe, expect, it } from "vitest";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { toTeamDrawerView } from "@/state/entity-drawer-selectors";
import type { GameState } from "@/state/game-state";
import { toLeagueHubView } from "@/state/league-hub-selectors";
import { toDashboardSnapshot, toStandingsView } from "@/state/selectors";
import {
  leagueRankByTeamId,
  leagueRankForTeam,
} from "@/state/selectors/league-rank";
import { toStandingsPageView } from "@/state/standings-selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function bootedState(saveId: string): GameState {
  const state = createTestGameState({ saveId });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function withRecords(
  state: GameState,
  records: ReadonlyArray<[TeamId, number, number]>,
): GameState {
  const byTeamId = { ...state.competition.standings.byTeamId };
  for (const [teamId, wins, losses] of records) {
    byTeamId[teamId] = {
      ...createEmptyTeamStanding(teamId),
      wins,
      losses,
      winPercentage: wins / (wins + losses),
    };
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: { ...state.competition.standings, byTeamId },
    },
  };
}

/** Every screen's league rank for the active team. */
function ranksOnEveryScreen(state: GameState) {
  const teamId = state.user.activeOwnerTeamId;
  const page = toStandingsPageView(state, {
    view: "conference",
    stats: "standard",
  });
  return {
    selector: leagueRankForTeam(state, teamId),
    header: toDashboardSnapshot(state).standingsRank,
    leagueHub: toLeagueHubView(state).snapshot.userRank,
    standingsPage:
      page.leagueRows.find((row) => row.teamId === teamId)?.leagueRank ?? null,
    teamDrawer:
      toTeamDrawerView(state, teamId, state.meta.saveId)?.performance.rank ??
      null,
  };
}

describe("league rank", () => {
  it("ranks a 4–1 team by win percentage, not total wins, on every screen", () => {
    const base = bootedState("league_rank_pct");
    const userId = base.user.activeOwnerTeamId;
    const others = Object.keys(base.world.teams).filter(
      (id) => id !== userId,
    ) as TeamId[];
    // One unbeaten team, then six teams with more wins but a worse record.
    const state = withRecords(base, [
      [userId, 4, 1],
      [others[0]!, 5, 0],
      ...others.slice(1, 7).map((id): [TeamId, number, number] => [id, 5, 3]),
    ]);

    expect(ranksOnEveryScreen(state)).toEqual({
      selector: 2,
      header: 2,
      leagueHub: 2,
      standingsPage: 2,
      teamDrawer: 2,
    });
    const listRow = toStandingsView(state).find((row) => row.teamId === userId);
    expect(listRow?.rank).toBe(2);
  });

  it("shows no rank anywhere before the team's first game", () => {
    const state = bootedState("league_rank_preseason");
    expect(ranksOnEveryScreen(state)).toEqual({
      selector: null,
      header: null,
      leagueHub: null,
      // The standings table still orders every row, ties included.
      standingsPage: expect.any(Number),
      teamDrawer: null,
    });
  });

  it("gives every team a distinct rank from 1 to N", () => {
    const state = bootedState("league_rank_distinct");
    const ranks = [...leagueRankByTeamId(state).values()].sort((a, b) => a - b);
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    expect(ranks).toHaveLength(Object.keys(state.world.teams).length);
  });
});

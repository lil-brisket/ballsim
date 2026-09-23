import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { createDomainEvent } from "@/domain/events";
import { asGameId, asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { appendSeasonEventLog } from "@/state/game-state";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import {
  getTeamRecentHistory,
  TEAM_RECENT_HISTORY_LIMIT,
} from "@/state/team-recent-history-selectors";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function bootstrappedState(saveId: string) {
  const state = createTestGameState({ saveId });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function teamIds(state: ReturnType<typeof bootstrappedState>): TeamId[] {
  return Object.keys(state.world.teams) as TeamId[];
}

function addFinalGame(
  state: ReturnType<typeof bootstrappedState>,
  input: {
    id: string;
    date: string;
    homeTeamId: string;
    awayTeamId: string;
    home: number;
    away: number;
  },
) {
  const game = createGame({
    id: asGameId(input.id),
    seasonId: state.competition.season.id,
    competitionType: "regular_season",
    homeTeamId: asTeamId(input.homeTeamId),
    awayTeamId: asTeamId(input.awayTeamId),
    date: input.date,
    status: "final",
    score: { home: input.home, away: input.away },
    periodScores: [],
    events: [],
    playerStats: [],
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
  });
  return {
    ...state,
    competition: {
      ...state.competition,
      games: {
        ...state.competition.games,
        [game.id]: game,
      },
    },
  };
}

describe("getTeamRecentHistory", () => {
  it("returns empty array for a bootstrapped save with no history", () => {
    const state = bootstrappedState("hist_empty");
    const teamId = state.user.activeOwnerTeamId;
    const history = getTeamRecentHistory(state, teamId);
    expect(history).toEqual([]);
  });

  it("orders newest first and caps at TEAM_RECENT_HISTORY_LIMIT", () => {
    let state = bootstrappedState("hist_cap");
    const ids = teamIds(state);
    const teamA = ids[0]!;
    const teamB = ids[1]!;
    state = {
      ...state,
      user: { ...state.user, activeOwnerTeamId: teamA },
    };

    // 6 transaction candidates on distinct dates
    const events = Array.from({ length: 6 }, (_, i) =>
      createDomainEvent({
        type: "FreeAgentSigned",
        occurredOn: `2026-11-${String(10 + i).padStart(2, "0")}`,
        payload: {
          teamId: teamA,
          playerId: state.world.teams[teamA]!.roster[0],
        },
      }),
    );
    state = appendSeasonEventLog(state, events);

    // Also add one game for another team so it doesn't affect teamA count
    state = addFinalGame(state, {
      id: "g_other",
      date: "2026-11-20",
      homeTeamId: teamB,
      awayTeamId: ids[2]!,
      home: 100,
      away: 90,
    });

    const history = getTeamRecentHistory(state, teamA);
    expect(history).toHaveLength(TEAM_RECENT_HISTORY_LIMIT);
    for (let i = 1; i < history.length; i += 1) {
      expect(
        history[i - 1]!.occurredOn >= history[i]!.occurredOn,
      ).toBe(true);
    }
  });

  it("dedupes GameCompleted log rows against getRecentForm game results", () => {
    let state = bootstrappedState("hist_dedupe");
    const ids = teamIds(state);
    const teamA = ids[0]!;
    const teamB = ids[1]!;
    const gameId = "g_dedupe_1";
    const date = "2026-11-15";

    state = addFinalGame(state, {
      id: gameId,
      date,
      homeTeamId: teamA,
      awayTeamId: teamB,
      home: 108,
      away: 102,
    });
    state = appendSeasonEventLog(state, [
      createDomainEvent({
        type: "GameCompleted",
        occurredOn: date,
        payload: {
          gameId,
          homeTeamId: teamA,
          awayTeamId: teamB,
        },
      }),
    ]);

    const history = getTeamRecentHistory(state, teamA);
    const gameRows = history.filter((row) => row.kind === "game_result");
    expect(gameRows).toHaveLength(1);
    expect(gameRows[0]!.id).toBe(`game:${gameId}`);
    expect(history.every((row) => row.kind !== "other")).toBe(true);
    // No duplicate "Game completed" style entry from the log
    expect(
      history.filter((row) => row.title.toLowerCase().includes("game completed")),
    ).toHaveLength(0);
  });

  it("isolates history to the requested team across multi-team ownership", () => {
    let state = bootstrappedState("hist_multi");
    const ids = teamIds(state);
    const teamA = ids[0]!;
    const teamB = ids[1]!;
    const franchiseA = state.user.ownedFranchises[state.user.activeOwnerTeamId]!;

    state = {
      ...state,
      user: {
        ...state.user,
        ownedTeamIds: [teamA, teamB],
        activeOwnerTeamId: teamA,
        ownedFranchises: {
          [teamA]: franchiseA,
          [teamB]: createDefaultOwnedFranchiseState({
            seasonYear: state.competition.season.year,
            currentDate: state.world.calendar.currentDate,
          }),
        },
      },
    };

    state = appendSeasonEventLog(state, [
      createDomainEvent({
        type: "FreeAgentSigned",
        occurredOn: "2026-11-12",
        payload: {
          teamId: teamA,
          playerId: state.world.teams[teamA]!.roster[0],
        },
      }),
      createDomainEvent({
        type: "PlayerReleased",
        occurredOn: "2026-11-13",
        payload: {
          teamId: teamB,
          playerId: state.world.teams[teamB]!.roster[0],
        },
      }),
      createDomainEvent({
        type: "PlayerInjured",
        occurredOn: "2026-11-14",
        payload: {
          teamId: teamB,
          playerId: state.world.teams[teamB]!.roster[1],
        },
      }),
      createDomainEvent({
        type: "MidseasonAwardAnnounced",
        occurredOn: "2026-11-15",
        payload: {
          awardId: "mip",
          winnerSubjectId: state.world.teams[teamB]!.roster[0],
          winnerTeamId: teamB,
        },
      }),
    ]);

    state = addFinalGame(state, {
      id: "g_team_b_only",
      date: "2026-11-16",
      homeTeamId: teamB,
      awayTeamId: ids[2]!,
      home: 99,
      away: 88,
    });

    const historyA = getTeamRecentHistory(state, teamA);
    expect(historyA).toHaveLength(1);
    expect(historyA[0]!.kind).toBe("transaction");
    expect(historyA[0]!.title).toContain("Signed");

    const historyB = getTeamRecentHistory(state, teamB);
    expect(historyB.length).toBeGreaterThanOrEqual(3);
    expect(historyB.every((row) => !row.id.includes(String(teamA)))).toBe(true);
    // Team B must not see team A's signing as its only/sole event type mix incorrectly
    expect(
      historyB.some((row) => row.kind === "game_result"),
    ).toBe(true);
    expect(historyB.some((row) => row.kind === "injury")).toBe(true);
    expect(historyB.some((row) => row.kind === "award")).toBe(true);
  });

  it("includes both a trade and a game when both are within the top 5", () => {
    let state = bootstrappedState("hist_smoke");
    const ids = teamIds(state);
    const teamA = ids[0]!;
    const teamB = ids[1]!;

    state = addFinalGame(state, {
      id: "g_smoke",
      date: "2026-11-20",
      homeTeamId: teamA,
      awayTeamId: teamB,
      home: 110,
      away: 100,
    });
    state = appendSeasonEventLog(state, [
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-11-18",
        payload: {
          playerId: state.world.teams[teamA]!.roster[0],
          fromTeamId: teamA,
          toTeamId: teamB,
        },
      }),
    ]);

    const history = getTeamRecentHistory(state, teamA);
    expect(history.some((row) => row.kind === "game_result")).toBe(true);
    expect(history.some((row) => row.kind === "transaction")).toBe(true);
  });

  it("skips injuries without an explicit teamId on the payload", () => {
    let state = bootstrappedState("hist_inj_skip");
    const teamA = state.user.activeOwnerTeamId;
    state = appendSeasonEventLog(state, [
      createDomainEvent({
        type: "PlayerInjured",
        occurredOn: "2026-11-10",
        payload: {
          playerId: state.world.teams[teamA]!.roster[0],
          // no teamId
        },
      }),
    ]);
    expect(getTeamRecentHistory(state, teamA)).toEqual([]);
  });
});

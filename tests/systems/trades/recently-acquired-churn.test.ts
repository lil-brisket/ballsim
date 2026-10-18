import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createDomainEvent } from "@/domain/events/domain-event";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import { rotateByDate, runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { getTradeBlock } from "@/systems/trades";
import {
  proposalMovesRecentlyAcquiredCpuPlayer,
  wasRecentlyAcquired,
} from "@/systems/trades/asset-valuation/retention-priority";
import { generateCpuTradeCandidates } from "@/systems/trades/cpu-trade-generator";
import { RECENTLY_ACQUIRED_DAYS } from "@/systems/trades-config";
import { bootstrapWorld } from "@/systems/world-pipeline";

function leagueState(): GameState {
  const state = createInitialGameState({
    saveId: "churn",
    rngSeed: 41,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function cpuTeamIds(state: GameState): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[])
    .filter((teamId) => !isUserControlledTeam(state, teamId))
    .sort();
}

function withTradedOn(
  state: GameState,
  playerIds: readonly PlayerId[],
  occurredOn: string,
): GameState {
  const events = playerIds.map((playerId) =>
    createDomainEvent({
      type: "PlayerTraded",
      occurredOn,
      payload: { playerId },
    }),
  );
  return {
    ...state,
    competition: {
      ...state.competition,
      seasonEventLog: [...state.competition.seasonEventLog, ...events],
    },
  };
}

describe("recently acquired players and CPU trade churn", () => {
  it("treats a player as recently acquired for RECENTLY_ACQUIRED_DAYS", () => {
    const state = leagueState();
    const playerId = state.world.teams[cpuTeamIds(state)[0]!]!.roster[0]!;
    const today = state.world.calendar.currentDate;

    const fresh = withTradedOn(state, [playerId], addCalendarDays(today, -1));
    expect(wasRecentlyAcquired(fresh, playerId)).toBe(true);
    const old = withTradedOn(
      state,
      [playerId],
      addCalendarDays(today, -(RECENTLY_ACQUIRED_DAYS + 1)),
    );
    expect(wasRecentlyAcquired(old, playerId)).toBe(false);
  });

  it("blocks CPU sides from moving a recently acquired player, not the user side", () => {
    const state = leagueState();
    const cpuId = cpuTeamIds(state)[0]!;
    const userId = state.user.activeOwnerTeamId;
    const cpuPlayer = state.world.teams[cpuId]!.roster[0]!;
    const userPlayer = state.world.teams[userId]!.roster[0]!;
    const proposal = {
      sideA: { teamId: cpuId, playerIds: [cpuPlayer], draftPickIds: [] },
      sideB: { teamId: userId, playerIds: [userPlayer], draftPickIds: [] },
    };
    const yesterday = addCalendarDays(state.world.calendar.currentDate, -1);

    expect(
      proposalMovesRecentlyAcquiredCpuPlayer(
        withTradedOn(state, [cpuPlayer], yesterday),
        proposal,
      ),
    ).toBe(true);
    expect(
      proposalMovesRecentlyAcquiredCpuPlayer(
        withTradedOn(state, [userPlayer], yesterday),
        proposal,
      ),
    ).toBe(false);
  });

  it("never generates CPU trade candidates that move a just-traded player", () => {
    const base = leagueState();
    const yesterday = addCalendarDays(base.world.calendar.currentDate, -1);
    const cpuPlayers = cpuTeamIds(base).flatMap(
      (teamId) => base.world.teams[teamId]!.roster,
    );
    // Half the CPU league was "just traded".
    const traded = cpuPlayers.filter((_, index) => index % 2 === 0);
    const state = withTradedOn(base, traded, yesterday);
    const tradedSet = new Set<string>(traded);

    for (const teamId of cpuTeamIds(state)) {
      for (const candidate of generateCpuTradeCandidates(state, teamId)) {
        const moved = [
          ...candidate.proposal.sideA.playerIds,
          ...candidate.proposal.sideB.playerIds,
        ];
        expect(moved.some((playerId) => tradedSet.has(playerId))).toBe(false);
      }
    }
  });

  it("does not list a just-acquired player as trade-block surplus", () => {
    const base = leagueState();
    const yesterday = addCalendarDays(base.world.calendar.currentDate, -1);
    const cpuPlayers = cpuTeamIds(base).flatMap(
      (teamId) => base.world.teams[teamId]!.roster,
    );
    const state = withTradedOn(base, cpuPlayers, yesterday);
    const before = new Map(
      cpuTeamIds(state).map((teamId) => [
        teamId,
        new Set(
          getTradeBlock(state, teamId).assets.flatMap((asset) =>
            asset.kind === "player" ? [asset.playerId] : [],
          ),
        ),
      ]),
    );

    const after = runAiTeamDecisions(state, createSeededRng(3)).state;
    for (const teamId of cpuTeamIds(state)) {
      const listed = getTradeBlock(after, teamId).assets.flatMap((asset) =>
        asset.kind === "player" ? [asset.playerId] : [],
      );
      const newlyListed = listed.filter(
        (playerId) => !before.get(teamId)!.has(playerId),
      );
      expect(newlyListed).toEqual([]);
    }
  });
});

describe("rotateByDate", () => {
  it("starts on a different team each day and keeps every team", () => {
    const teams = ["a", "b", "c", "d"];
    const day = rotateByDate(teams, "2026-10-01");
    const next = rotateByDate(teams, "2026-10-02");
    expect(day[0]).not.toBe(next[0]);
    expect([...day].sort()).toEqual(teams);
    expect(rotateByDate(teams, "2026-10-05")).toEqual(day);
  });
});

import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { asGameId, asSeasonId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  processDailyFanSentimentAfterGames,
  updateFanSentimentForTeam,
} from "@/systems/fan-sentiment";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("fan sentiment", () => {
  it("updateFanSentimentForTeam smooths toward target", () => {
    let state = createInitialGameState({ saveId: "sent_test", rngSeed: 9 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            fanSentiment: 20,
          },
        },
      },
    };
    const lowSentiment = 20;
    const result = updateFanSentimentForTeam(state, teamId);
    const after = result.state.business.franchiseOps[teamId]!.fanSentiment;
    expect(after).toBeGreaterThan(lowSentiment);
    expect(after).toBeLessThan(100);
  });

  it("processDailyFanSentimentAfterGames bumps home winner", () => {
    let state = createInitialGameState({ saveId: "sent_game", rngSeed: 10 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const otherTeamId = (Object.keys(state.world.teams) as string[]).find(
      (id) => id !== teamId,
    )!;
    const date = state.world.calendar.currentDate;
    const gameId = asGameId("game_sent_1");
    const baseSentiment =
      state.business.franchiseOps[teamId]!.fanSentiment;
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: {
          ...state.competition.games,
          [gameId]: createGame({
            id: gameId,
            seasonId: asSeasonId(state.competition.season.id),
            date,
            homeTeamId: teamId,
            awayTeamId: asTeamId(otherTeamId),
            status: "final",
            score: { home: 112, away: 99 },
            periodScores: [],
            playerStats: [],
            events: [],
          }),
        },
      },
    };
    const result = processDailyFanSentimentAfterGames(state);
    expect(
      result.state.business.franchiseOps[teamId]!.fanSentiment,
    ).toBeGreaterThanOrEqual(baseSentiment);
  });
});

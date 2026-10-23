import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import type { Player } from "@/domain/entities/player";
import { createDomainEvent } from "@/domain/events";
import {
  asGameId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { simulateGameBoxScore } from "@/systems/game-simulation-box-score";
import {
  CHEMISTRY_NEUTRAL,
  chemistryPointsDelta,
  chemistryTurnoverMultiplier,
  teamChemistry,
} from "@/systems/team-chemistry";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createPlayer } from "../factories/player";

function league(): GameState {
  const base = createTestGameState({ saveId: "chemistry" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function withHistory(
  state: GameState,
  teamId: TeamId,
  lastTeam: (playerId: string) => TeamId,
): GameState {
  const year = state.competition.season.year;
  const playerHistory = { ...state.business.playerHistory };
  for (const playerId of state.world.teams[teamId]!.roster) {
    playerHistory[playerId] = {
      playerId,
      trackingStartedSeasonYear: year - 1,
      seasons: [
        {
          seasonYear: year - 1,
          contractSnapshot: {
            contractId: null,
            salary: null,
            teamId: lastTeam(playerId),
          },
        },
      ] as never,
    };
  }
  return { ...state, business: { ...state.business, playerHistory } };
}

describe("teamChemistry", () => {
  it("starts neutral-ish in a new league", () => {
    const state = league();
    for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
      const value = teamChemistry(state, teamId).value;
      expect(Math.abs(value - CHEMISTRY_NEUTRAL)).toBeLessThanOrEqual(12);
    }
  });

  it("rises with continuity", () => {
    const state = league();
    const [teamId, other] = Object.keys(state.world.teams).sort() as TeamId[];
    const together = withHistory(state, teamId!, () => teamId!);
    const strangers = withHistory(state, teamId!, () => other!);
    expect(teamChemistry(together, teamId!).value).toBeGreaterThan(
      teamChemistry(strangers, teamId!).value,
    );
  });

  it("drops after recent trades", () => {
    const state = league();
    const [teamId, other] = Object.keys(state.world.teams).sort() as TeamId[];
    const traded: GameState = {
      ...state,
      competition: {
        ...state.competition,
        seasonEventLog: [1, 2, 3].map((n) =>
          createDomainEvent({
            type: "PlayerTraded",
            occurredOn: state.world.calendar.currentDate,
            payload: {
              playerId: `p${n}`,
              fromTeamId: other,
              toTeamId: teamId,
            },
          }),
        ),
      },
    };
    expect(teamChemistry(traded, teamId!).recentTrades).toBe(3);
    expect(teamChemistry(traded, teamId!).value).toBeLessThan(
      teamChemistry(state, teamId!).value,
    );
  });
});

describe("chemistry effect stays small", () => {
  it("is neutral at neutral chemistry and bounded at the extremes", () => {
    expect(chemistryTurnoverMultiplier(CHEMISTRY_NEUTRAL)).toBe(1);
    expect(chemistryPointsDelta(CHEMISTRY_NEUTRAL)).toBe(0);
    expect(chemistryTurnoverMultiplier(100)).toBeCloseTo(0.94, 10);
    expect(chemistryTurnoverMultiplier(0)).toBeCloseTo(1.06, 10);
    expect(Math.abs(chemistryPointsDelta(0))).toBeLessThanOrEqual(1);
  });

  it("moves win% by only a few points between great and neutral chemistry", () => {
    const HOME = asTeamId("team_home");
    const AWAY = asTeamId("team_away");
    const positions = ["PG", "SG", "SF", "PF", "C"] as const;
    const roster = (teamId: TeamId, prefix: string): Player[] =>
      Array.from({ length: 10 }, (_, i) =>
        createPlayer({
          id: asPlayerId(`${prefix}_${i}`),
          teamId,
          position: positions[i % 5]!,
        }),
      );
    const home = roster(HOME, "h");
    const away = roster(AWAY, "a");
    const winRate = (homeChemistry: number) => {
      const rng = createSeededRng(7);
      let wins = 0;
      const games = 600;
      for (let i = 0; i < games; i += 1) {
        const game = createGame({
          competitionType: "regular_season",
          homeTeamSnapshot: null,
          awayTeamSnapshot: null,
          id: asGameId(`g_${i}`),
          seasonId: asSeasonId("season_1"),
          homeTeamId: HOME,
          awayTeamId: AWAY,
          date: "2026-10-15",
          status: "scheduled",
          score: { home: 0, away: 0 },
          periodScores: [],
          events: [],
          playerStats: [],
        });
        const result = simulateGameBoxScore(
          game,
          {
            homePlayers: home,
            awayPlayers: away,
            homeChemistry,
            awayChemistry: CHEMISTRY_NEUTRAL,
          },
          rng,
        );
        if (result.score.home > result.score.away) wins += 1;
      }
      return wins / games;
    };
    const gain = winRate(100) - winRate(CHEMISTRY_NEUTRAL);
    expect(gain).toBeGreaterThanOrEqual(0);
    expect(gain).toBeLessThan(0.06);
  });
});

import { describe, expect, it } from "vitest";
import { createGame } from "@/domain/entities/game";
import { createOwnerObjective } from "@/domain/entities/owner-objective";
import {
  asGameId,
  asOwnerObjectiveId,
  asSeasonId,
  asTeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  applyGameplayFinancialConsequences,
  hasAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import {
  GAMEPLAY_OBJECTIVE_REWARD,
  GAMEPLAY_WIN_REVENUE,
} from "@/systems/owner-objectives-config";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("gameplay financial consequences", () => {
  it("applies win revenue to cash and books once per game key", () => {
    let state = createInitialGameState({ saveId: "fin_win", rngSeed: 3 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const otherTeamId = (Object.keys(state.world.teams) as string[]).find(
      (id) => id !== teamId,
    )!;
    const date = state.world.calendar.currentDate;
    const year = state.competition.season.year;
    const gameId = asGameId("game_fin_1");
    const game = createGame({
      id: gameId,
      seasonId: asSeasonId(state.competition.season.id),
      date,
      homeTeamId: teamId,
      awayTeamId: asTeamId(otherTeamId),
      status: "final",
      score: { home: 110, away: 100 },
      periodScores: [],
      playerStats: [],
      events: [],
    });
    state = {
      ...state,
      competition: {
        ...state.competition,
        games: { ...state.competition.games, [gameId]: game },
      },
    };
    const before = state.business.finances[teamId]!.cash;
    const once = applyGameplayFinancialConsequences(state);
    expect(once.state.business.finances[teamId]!.cash).toBe(
      before + GAMEPLAY_WIN_REVENUE,
    );
    expect(
      hasAppliedGameplayConsequence(
        once.state,
        `game_result:${teamId}:${gameId}`,
      ),
    ).toBe(true);
    const twice = applyGameplayFinancialConsequences(once.state);
    expect(twice.state.business.finances[teamId]!.cash).toBe(
      once.state.business.finances[teamId]!.cash,
    );
    const books = twice.state.business.finances[teamId]!.booksByYear[String(year)];
    expect(books?.revenue.tickets).toBe(GAMEPLAY_WIN_REVENUE);
  });

  it("applies objective reward once via consequence keys", () => {
    let state = createInitialGameState({ saveId: "fin_obj", rngSeed: 4 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    state = {
      ...state,
      user: {
        ...state.user,
        objectives: [
          createOwnerObjective({
            id: asOwnerObjectiveId("obj_reward"),
            type: "make_playoffs",
            description: "Make playoffs",
            status: "completed",
            seasonYear: year,
            consequenceApplied: false,
          }),
        ],
      },
    };
    const before = state.business.finances[teamId]!.cash;
    const once = applyGameplayFinancialConsequences(state);
    expect(once.state.business.finances[teamId]!.cash).toBe(
      before + GAMEPLAY_OBJECTIVE_REWARD,
    );
    expect(once.state.user.objectives[0]!.consequenceApplied).toBe(true);
    const twice = applyGameplayFinancialConsequences(once.state);
    expect(twice.state.business.finances[teamId]!.cash).toBe(
      once.state.business.finances[teamId]!.cash,
    );
  });
});

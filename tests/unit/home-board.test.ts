import { describe, expect, it } from "vitest";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerHistory } from "@/domain/entities/player-history";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { toHomeBoardView } from "@/state/owner-dashboard/home-board";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function bootstrappedState(): GameState {
  const state = createTestGameState({ saveId: "save_home_board" });
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function rosterOveralls(state: GameState) {
  const team = state.world.teams[state.user.activeOwnerTeamId]!;
  return team.roster.map((id) => {
    const player = state.world.players[id]!;
    return {
      id,
      overall: calculatePlayerOverall(player.position, player.attributes),
    };
  });
}

/** Prior-season snapshot so the player's current overall reads as a change. */
function withPriorOverall(
  state: GameState,
  playerId: string,
  priorOverall: number,
): GameState {
  const history = {
    playerId,
    trackingStartedSeasonYear: state.competition.season.year - 1,
    seasons: [
      {
        seasonYear: state.competition.season.year - 1,
        overall: priorOverall,
      },
    ],
  } as unknown as PlayerHistory;
  return {
    ...state,
    business: {
      ...state.business,
      playerHistory: { ...state.business.playerHistory, [playerId]: history },
    },
  };
}

describe("toHomeBoardView", () => {
  it("picks the highest-overall player on the active team as top player", () => {
    const state = bootstrappedState();
    const rows = rosterOveralls(state);
    const max = Math.max(...rows.map((row) => row.overall));
    const expectedId = rows
      .filter((row) => row.overall === max)
      .map((row) => row.id)
      .sort()[0];

    const view = toHomeBoardView(state);

    expect(view.topPlayer?.overall).toBe(max);
    expect(view.topPlayer?.playerId).toBe(expectedId);
  });

  it("has no biggest riser without player history", () => {
    expect(toHomeBoardView(bootstrappedState()).biggestRiser).toBeNull();
  });

  it("reports the largest positive overall change as the biggest riser", () => {
    const state = bootstrappedState();
    const [a, b] = rosterOveralls(state);
    let next = withPriorOverall(state, a!.id, a!.overall - 2);
    next = withPriorOverall(next, b!.id, b!.overall - 5);

    const riser = toHomeBoardView(next).biggestRiser;

    expect(riser?.playerId).toBe(b!.id);
    expect(riser?.delta).toBe(5);
  });

  it("ignores players whose overall fell", () => {
    const state = bootstrappedState();
    const [a] = rosterOveralls(state);
    const next = withPriorOverall(state, a!.id, a!.overall + 3);

    expect(toHomeBoardView(next).biggestRiser).toBeNull();
  });

  it("includes the conference standing after bootstrap", () => {
    const view = toHomeBoardView(bootstrappedState());

    expect(view.standing).not.toBeNull();
    expect(view.standing!.conferenceRank).toBeGreaterThanOrEqual(1);
    expect(view.standing!.conferenceName.length).toBeGreaterThan(0);
    expect(view.standing!.gamesBack).toBeGreaterThanOrEqual(0);
  });

  it("is exposed on the owner dashboard view", () => {
    const state = bootstrappedState();

    expect(toOwnerDashboardView(state).home).toEqual(toHomeBoardView(state));
  });
});

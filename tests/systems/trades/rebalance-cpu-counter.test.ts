import { describe, expect, it } from "vitest";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";
import { rebalanceCpuCounterProposal } from "@/systems/trades";
import { createTradeFixture, playerOnTeam, teamIds } from "./fixture";

function boostOverall(
  state: ReturnType<typeof createTradeFixture>,
  playerId: ReturnType<typeof playerOnTeam>,
  rating: number,
) {
  const player = state.world.players[playerId]!;
  const attributes = { ...player.attributes };
  for (const key of PLAYER_ATTRIBUTE_KEYS) {
    attributes[key] = rating;
  }
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          attributes,
          potential: { ...player.potential, overall: Math.min(99, rating + 2) },
        },
      },
    },
  };
}

describe("rebalanceCpuCounterProposal", () => {
  it("adds CPU picks when the user counter is short of the original package", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const cpuPlayer = playerOnTeam(state, teamA, 0);
    const userOriginal = playerOnTeam(state, teamB, 0);
    const userWorse = playerOnTeam(state, teamB, 9);
    state = boostOverall(state, cpuPlayer, 82);
    state = boostOverall(state, userOriginal, 80);
    state = boostOverall(state, userWorse, 62);

    const rebalanced = rebalanceCpuCounterProposal(
      state,
      teamA,
      teamB,
      { playerIds: [cpuPlayer], draftPickIds: [] },
      { playerIds: [userWorse], draftPickIds: [] },
    );
    expect(rebalanced).not.toBeNull();
    expect(rebalanced!.sideA.teamId).toBe(teamA);
    expect(rebalanced!.sideB.playerIds).toEqual([userWorse]);
    expect(
      rebalanced!.sideA.playerIds.length + rebalanced!.sideA.draftPickIds.length,
    ).toBeGreaterThan(1);
  });
});

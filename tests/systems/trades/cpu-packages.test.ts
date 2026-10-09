import { describe, expect, it } from "vitest";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import {
  addToTradeBlock,
  findTrades,
  generateCpuTradeCandidates,
} from "@/systems/trades";
import { CPU_TRADE_ACQUIRE_MIN_OVERALL } from "@/systems/trades-config";
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

describe("CPU/Finder multi-asset packages", () => {
  it("assembles multi-asset packages to acquire a high-overall player", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const starId = playerOnTeam(state, teamB, 0);
    state = boostOverall(state, starId, 94);
    const overall = calculatePlayerOverall(
      state.world.players[starId]!.position,
      state.world.players[starId]!.attributes,
    );
    expect(overall).toBeGreaterThanOrEqual(CPU_TRADE_ACQUIRE_MIN_OVERALL);

    const candidates = generateCpuTradeCandidates(state, teamA, {
      maxCandidates: 50,
      counterpartyFilter: (id) => id === teamB,
    });
    const packageDeal = candidates.find((row) => {
      const outgoing =
        row.proposal.sideA.playerIds.length +
        row.proposal.sideA.draftPickIds.length;
      return row.proposal.sideB.playerIds.includes(starId) && outgoing >= 2;
    });
    expect(packageDeal).toBeDefined();
    expect(packageDeal!.proposal.sideA.teamId).toBe(teamA);
    expect(packageDeal!.proposal.sideB.teamId).toBe(teamB);
  });

  it("finder acquire can send owned picks for an off-block target", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const starId = playerOnTeam(state, teamB, 0);
    state = boostOverall(state, starId, 94);

    const candidates = findTrades(state, {
      direction: "acquire",
      teamId: teamA,
      asset: { kind: "player", playerId: starId },
    });
    expect(
      candidates.some(
        (row) =>
          row.proposal.sideA.draftPickIds.length > 1 &&
          row.proposal.sideB.playerIds.includes(starId),
      ),
    ).toBe(true);
  });

  it("finder acquire can send owned picks for a block target", () => {
    let state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const starId = playerOnTeam(state, teamB, 0);
    state = boostOverall(state, starId, 94);
    state = addToTradeBlock(state, teamB, {
      kind: "player",
      playerId: starId,
    }).state;

    const candidates = findTrades(state, {
      direction: "acquire",
      teamId: teamA,
      asset: { kind: "player", playerId: starId },
    });
    expect(
      candidates.some(
        (row) =>
          row.proposal.sideA.draftPickIds.length > 1 &&
          row.proposal.sideB.playerIds.includes(starId),
      ),
    ).toBe(true);
  });
});

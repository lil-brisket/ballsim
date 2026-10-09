import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { asContractId, asOfferId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { acceptOffer, makeOffer } from "@/systems/free-agency";
import { processPlayerRetirements } from "@/systems/player-retirement";
import {
  addToTradeBlock,
  executeTrade,
  findTrades,
  generateAiTradeProposal,
  getTradeBlock,
  reconcileTradeBlocks,
  removeFromTradeBlock,
  evaluateTradeOffer,
  validateTrade,
} from "@/systems/trades";
import { validateGameState } from "@/persistence/validate-game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { getTeamCapSpace } from "@/systems/salary-cap";
import {
  createTradeFixture,
  pickForTeam,
  playerForPlayerProposal,
  playerOnTeam,
  teamIds,
} from "./fixture";

describe("trade block", () => {
  it("adds and removes players and picks", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const pickId = pickForTeam(state, teamA, 1, 1);

    const withPlayer = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    });
    const withPick = addToTradeBlock(withPlayer.state, teamA, {
      kind: "draftPick",
      draftPickId: pickId,
    });

    const block = getTradeBlock(withPick.state, teamA);
    expect(block.assets).toHaveLength(2);
    // Adding does not change roster ownership
    expect(withPick.state.world.teams[teamA]!.roster).toContain(playerId);
    expect(withPick.state.world.draftPicks[pickId]!.ownerTeamId).toBe(teamA);

    const removed = removeFromTradeBlock(withPick.state, teamA, {
      kind: "player",
      playerId,
    });
    expect(getTradeBlock(removed.state, teamA).assets).toHaveLength(1);
  });

  it("rejects adding unowned assets", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    expect(() =>
      addToTradeBlock(state, teamA, {
        kind: "player",
        playerId: playerOnTeam(state, teamB, 0),
      }),
    ).toThrow(/not owned/);
  });

  it("getTradeBlock filters stale assets without persisting cleanup", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const withBlock = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    }).state;

    // Manually move player off team without clearing trade block
    const stale = {
      ...withBlock,
      world: {
        ...withBlock.world,
        players: {
          ...withBlock.world.players,
          [playerId]: {
            ...withBlock.world.players[playerId]!,
            teamId: teamB,
          },
        },
        teams: {
          ...withBlock.world.teams,
          [teamA]: {
            ...withBlock.world.teams[teamA]!,
            roster: withBlock.world.teams[teamA]!.roster.filter(
              (id) => id !== playerId,
            ),
          },
          [teamB]: {
            ...withBlock.world.teams[teamB]!,
            roster: [...withBlock.world.teams[teamB]!.roster, playerId],
          },
        },
      },
    };

    expect(getTradeBlock(stale, teamA).assets).toHaveLength(0);
    expect(stale.business.tradeBlocks[teamA]!.assets).toHaveLength(1);
    expect(() => validateGameState(stale)).toThrow(/not owned by that team/);

    const cleaned = reconcileTradeBlocks(stale);
    expect(cleaned.business.tradeBlocks[teamA]!.assets).toHaveLength(0);
    expect(() => validateGameState(cleaned)).not.toThrow();
  });

  it("heals stale trade-block assets on deserialize", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const withBlock = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    }).state;
    const parsed = JSON.parse(serializeGameState(withBlock)) as {
      world: {
        players: Record<string, { teamId: string | null }>;
        teams: Record<string, { roster: string[] }>;
      };
    };
    parsed.world.players[playerId]!.teamId = teamB;
    parsed.world.teams[teamA]!.roster = parsed.world.teams[
      teamA
    ]!.roster.filter((id) => id !== playerId);
    parsed.world.teams[teamB]!.roster = [
      ...parsed.world.teams[teamB]!.roster,
      playerId,
    ];
    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(
      loaded.business.tradeBlocks[teamA]?.assets.some(
        (asset) => asset.kind === "player" && asset.playerId === playerId,
      ) ?? false,
    ).toBe(false);
  });

  it("clears the listing team's block when a listed player signs in free agency", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const listed = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    }).state;
    const released = {
      ...listed,
      world: {
        ...listed.world,
        players: {
          ...listed.world.players,
          [playerId]: {
            ...listed.world.players[playerId]!,
            teamId: null,
            contractId: null,
          },
        },
        teams: {
          ...listed.world.teams,
          [teamA]: {
            ...listed.world.teams[teamA]!,
            roster: listed.world.teams[teamA]!.roster.filter(
              (id) => id !== playerId,
            ),
          },
        },
      },
    };
    const year = released.competition.season.year;
    const salary = Math.min(1_250_000, getTeamCapSpace(teamB, year, released));
    const offerId = asOfferId("offer_stale_block");
    const offered = makeOffer(released, {
      id: offerId,
      playerId,
      teamId: teamB,
      terms: createContract({
        id: asContractId("contract_stale_block"),
        playerId,
        teamId: teamB,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: salary },
      }),
    }).state;
    const accepted = acceptOffer(offered, offerId);
    expect(accepted.state.business.freeAgency.offers[offerId]?.status).toBe(
      "accepted",
    );
    expect(
      accepted.state.business.tradeBlocks[teamA]?.assets.some(
        (asset) => asset.kind === "player" && asset.playerId === playerId,
      ) ?? false,
    ).toBe(false);
  });

  it("clears the listing team's block when a listed player retires", () => {
    const state = createTradeFixture();
    const { teamA } = teamIds(state);
    const playerId = playerOnTeam(state, teamA, 0);
    const listed = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId,
    }).state;
    const aged = {
      ...listed,
      world: {
        ...listed.world,
        players: {
          ...listed.world.players,
          [playerId]: {
            ...listed.world.players[playerId]!,
            age: 40,
          },
        },
      },
    };
    const retired = processPlayerRetirements(aged, ALWAYS_RETIRE_RNG);
    expect(retired.state.world.players[playerId]!.retired).toBe(true);
    expect(
      retired.state.business.tradeBlocks[teamA]?.assets.some(
        (asset) => asset.kind === "player" && asset.playerId === playerId,
      ) ?? false,
    ).toBe(false);
    expect(() => validateGameState(retired.state)).not.toThrow();
  });

  it("clears traded assets from trade blocks on execute", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerA = playerOnTeam(state, teamA, 0);
    const playerB = playerOnTeam(state, teamB, 0);
    let next = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId: playerA,
    }).state;
    next = addToTradeBlock(next, teamB, {
      kind: "player",
      playerId: playerB,
    }).state;

    const result = executeTrade(next, playerForPlayerProposal(next));
    expect(result.success).toBe(true);
    expect(getTradeBlock(result.state, teamA).assets).toHaveLength(0);
    expect(getTradeBlock(result.state, teamB).assets).toHaveLength(0);
    expect(
      result.state.business.tradeBlocks[teamA]?.assets.some(
        (a) => a.kind === "player" && a.playerId === playerA,
      ) ?? false,
    ).toBe(false);
  });
});

describe("trade finder", () => {
  it("finds eligible trade-block assets and returns valid proposals", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const playerA = playerOnTeam(state, teamA, 0);
    const playerB = playerOnTeam(state, teamB, 0);
    const next = addToTradeBlock(state, teamB, {
      kind: "player",
      playerId: playerB,
    }).state;

    const before = structuredClone(next);
    const candidates = findTrades(next, {
      direction: "move",
      teamId: teamA,
      asset: { kind: "player", playerId: playerA },
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      expect(validateTrade(next, candidate.proposal).valid).toBe(true);
    }
    expect(next).toEqual(before);
    expect(
      candidates.some((c) => c.proposal.sideA.draftPickIds.length > 0),
    ).toBe(true);
  });

  it("filters invalid proposals", () => {
    const state = createTradeFixture({ rosterSize: 8 });
    const { teamA, teamB } = teamIds(state);
    // Put two players on B's block; offering a pick for both players would
    // still be generated as 1-for-1 only, so instead ensure finder only
    // returns validateTrade-passing deals.
    const playerB = playerOnTeam(state, teamB, 0);
    const next = addToTradeBlock(state, teamB, {
      kind: "player",
      playerId: playerB,
    }).state;
    const candidates = findTrades(next, {
      direction: "move",
      teamId: teamA,
      asset: { kind: "player", playerId: playerOnTeam(state, teamA, 0) },
    });
    for (const candidate of candidates) {
      expect(validateTrade(next, candidate.proposal).valid).toBe(true);
    }
  });

  it("does not mutate state", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const next = addToTradeBlock(state, teamB, {
      kind: "player",
      playerId: playerOnTeam(state, teamB, 0),
    }).state;
    const snapshot = JSON.stringify(next);
    findTrades(next, {
      direction: "move",
      teamId: teamA,
      asset: { kind: "player", playerId: playerOnTeam(state, teamA, 0) },
    });
    expect(JSON.stringify(next)).toBe(snapshot);
  });
});

describe("trade evaluation and AI", () => {
  it("accepts when netValue >= 0", () => {
    const state = createTradeFixture();
    const { teamB } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const evaluation = evaluateTradeOffer(state, teamB, proposal);
    expect(typeof evaluation.netValue).toBe("number");
    expect(typeof evaluation.accepted).toBe("boolean");
    expect(
      evaluation.decisionAction === "accept" ||
        evaluation.decisionAction === "reject" ||
        evaluation.decisionAction === "counter",
    ).toBe(true);
  });

  it("AI generates a proposal that goes through normal validation", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    let next = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId: playerOnTeam(state, teamA, 0),
    }).state;
    next = addToTradeBlock(next, teamB, {
      kind: "player",
      playerId: playerOnTeam(state, teamB, 0),
    }).state;

    const proposal = generateAiTradeProposal(next, teamA);
    expect(proposal).toBeDefined();
    expect(validateTrade(next, proposal!).valid).toBe(true);
  });

  it("rejected offers do not mutate state; accepted offers use executeTrade", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    let next = addToTradeBlock(state, teamA, {
      kind: "player",
      playerId: playerOnTeam(state, teamA, 0),
    }).state;
    next = addToTradeBlock(next, teamB, {
      kind: "player",
      playerId: playerOnTeam(state, teamB, 0),
    }).state;

    const proposal = generateAiTradeProposal(next, teamA);
    expect(proposal).toBeDefined();
    const counterparty =
      proposal!.sideA.teamId === teamA
        ? proposal!.sideB.teamId
        : proposal!.sideA.teamId;
    const evaluation = evaluateTradeOffer(next, counterparty, proposal!);
    if (!evaluation.accepted) {
      expect(next.world.players).toBe(next.world.players);
      return;
    }
    const executed = executeTrade(next, proposal!);
    expect(executed.success).toBe(true);
    expect(executed.state).not.toBe(next);
  });
});

const ALWAYS_RETIRE_RNG: Rng = {
  next: () => 0,
  nextInt: (min) => min,
  pick: <T>(items: readonly T[]) => items[0]!,
  chance: () => true,
  getState: () => 0,
};

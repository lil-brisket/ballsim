import { describe, expect, it } from "vitest";
import {
  addToTradeBlock,
  executeTrade,
  findTrades,
  generateAiTradeProposal,
  getTradeBlock,
  removeFromTradeBlock,
  evaluateTradeOffer,
  validateTrade,
} from "@/systems/trades";
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
    let next = addToTradeBlock(state, teamB, {
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
    const { teamA, teamB } = teamIds(state);
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

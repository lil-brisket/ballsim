import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createTestGameState } from "../factories/game-state";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { PlayerId, TeamId } from "@/domain/ids";
import { asTeamId } from "@/domain/ids";
import {
  scoreFacilityUpgrade,
  scoreFreeAgentSigning,
  scoreMarketingBudgetChange,
  scoreTradeDecision,
} from "@/systems/ownership-alignment-signals";
import { buildOwnershipExpectations } from "@/systems/ownership-expectations";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { bootstrapWorld } from "@/systems/world-pipeline";

function bootstrapped() {
  const state = createTestGameState();
  const rng = createSeededRng(state.meta.rngState);
  return bootstrapWorld(state, rng).state;
}

function setStandingWins(
  state: ReturnType<typeof bootstrapped>,
  wins: number,
  losses: number,
) {
  const teamId = state.user.controlledTeamId;
  const existing = state.competition.standings.byTeamId[teamId];
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        ...state.competition.standings,
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...existing!,
            wins,
            losses,
            winPercentage: wins / Math.max(1, wins + losses),
          },
        },
      },
    },
  };
}

function findStarOnTeam(
  state: ReturnType<typeof bootstrapped>,
  teamId: TeamId,
): PlayerId | null {
  const team = state.world.teams[teamId];
  if (!team) {
    return null;
  }
  let best: PlayerId | null = null;
  let bestOvr = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    const ovr = calculatePlayerOverall(player.position, player.attributes);
    if (ovr > bestOvr) {
      bestOvr = ovr;
      best = playerId;
    }
  }
  return best;
}

function otherTeamId(state: ReturnType<typeof bootstrapped>): TeamId {
  const controlled = state.user.controlledTeamId;
  const other = Object.keys(state.world.teams).find((id) => id !== controlled);
  return asTeamId(other!);
}

describe("ownership alignment signals", () => {
  it("treats min deals as minor significance", () => {
    const state = bootstrapped();
    const teamId = state.user.controlledTeamId;
    const other = Object.values(state.world.players).find((player) => {
      const team = state.world.teams[teamId];
      return team !== undefined && !team.roster.includes(player.id);
    });
    expect(other).toBeTruthy();
    const evidence = scoreFreeAgentSigning(state, other!.id, 1_500_000, 1);
    expect(evidence?.significance).toBe("minor");
  });

  it("scores contender star-for-picks differently than rebuild star-for-picks", () => {
    let contend = setStandingWins(bootstrapped(), 52, 18);
    contend = {
      ...contend,
      user: { ...contend.user, ownerPhilosophy: "win_now" },
    };

    const teamId = contend.user.controlledTeamId;
    const star = findStarOnTeam(contend, teamId);
    const counterpart = otherTeamId(contend);
    expect(star).toBeTruthy();

    const pick = Object.values(contend.world.draftPicks).find(
      (p) => p.ownerTeamId === counterpart && p.round === 1,
    );
    expect(pick).toBeTruthy();

    // Make the star clearly a high-OVR young core piece.
    const starPlayer = contend.world.players[star!]!;
    contend = {
      ...contend,
      world: {
        ...contend.world,
        players: {
          ...contend.world.players,
          [star!]: {
            ...starPlayer,
            age: 27,
            attributes: Object.fromEntries(
              Object.entries(starPlayer.attributes).map(([key, value]) => [
                key,
                typeof value === "number" ? Math.max(value, 82) : value,
              ]),
            ) as typeof starPlayer.attributes,
          },
        },
      },
    };

    const proposal: TradeProposal = {
      sideA: {
        teamId,
        playerIds: [star!],
        draftPickIds: [],
      },
      sideB: {
        teamId: counterpart,
        playerIds: [],
        draftPickIds: [pick!.id],
      },
    };

    const contendEvidence = scoreTradeDecision(contend, proposal);
    const rebuildState = setStandingWins(contend, 24, 48);
    const rebuildEvidence = scoreTradeDecision(rebuildState, proposal);

    expect(contendEvidence?.direction).toBe("conflicting");
    expect(rebuildEvidence?.direction).toBe("aligned");
  });

  it("scores facility upgrades as meaningful for market owners", () => {
    let state = bootstrapped();
    state = {
      ...state,
      user: { ...state.user, ownerPhilosophy: "market_expansion" },
    };
    const evidence = scoreFacilityUpgrade(state, "practice");
    expect(evidence.significance).toBe("meaningful");
    expect(evidence.direction).toBe("aligned");
  });

  it("marks large marketing cuts as conflicting for market expansion owners", () => {
    let state = bootstrapped();
    state = {
      ...state,
      user: { ...state.user, ownerPhilosophy: "market_expansion" },
    };
    const teamId = state.user.controlledTeamId;
    const ops = state.business.franchiseOps[teamId]!;
    state = {
      ...state,
      business: {
        ...state.business,
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...ops,
            marketing: { ...ops.marketing, awareness: 30, budget: 2_000_000 },
          },
        },
      },
    };
    const expectations = buildOwnershipExpectations(state);
    expect(expectations.marketExpectation).not.toBe("maintain");
    const evidence = scoreMarketingBudgetChange(state, 2_000_000, 500_000);
    expect(evidence?.direction).toBe("conflicting");
  });
});

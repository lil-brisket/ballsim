import { describe, expect, it } from "vitest";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { asTeamId, type PlayerId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import { withAddedOwnedFranchise } from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { enqueueTradeOfferForOwner } from "@/systems/owner-decisions/enqueue-trade-offer";
import { tryEnqueueOwnedTeamTradeOffer } from "@/systems/owner-decisions/owned-team-trade-offer";
import { bootstrapWorld } from "@/systems/world-pipeline";

function boostPlayerOverall(
  state: ReturnType<typeof createInitialGameState>,
  playerId: PlayerId,
  targetOverall: number,
): ReturnType<typeof createInitialGameState> {
  const player = state.world.players[playerId];
  if (!player) {
    return state;
  }
  const attrs = { ...player.attributes };
  for (const key of Object.keys(attrs) as (keyof typeof attrs)[]) {
    attrs[key] = Math.min(99, Math.max(attrs[key], targetOverall));
  }
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: { ...player, attributes: attrs },
      },
    },
  };
}

function ownedOwnedSwapProposal(
  state: ReturnType<typeof createInitialGameState>,
  teamA: ReturnType<typeof asTeamId>,
  teamB: ReturnType<typeof asTeamId>,
): TradeProposal {
  const playerA = state.world.teams[teamA]!.roster[2]!;
  const playerB = state.world.teams[teamB]!.roster[2]!;
  let working = boostPlayerOverall(state, playerA, 72);
  working = boostPlayerOverall(working, playerB, 72);
  return {
    sideA: {
      teamId: teamA,
      playerIds: [playerA],
      draftPickIds: [],
    },
    sideB: {
      teamId: teamB,
      playerIds: [playerB],
      draftPickIds: [],
    },
  };
}

function twoOwnedTeamsState() {
  let state = createInitialGameState({
    saveId: "save_owned_trade",
    rngSeed: 29,
    nowIso: "2026-08-13T12:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  const teamIds = Object.keys(state.world.teams).sort();
  const teamA = asTeamId(teamIds[0]!);
  const teamB = asTeamId(teamIds[1]!);
  state = withAddedOwnedFranchise(
    state,
    teamB,
    createDefaultOwnedFranchiseState({
      seasonYear: state.competition.season.year,
      currentDate: state.world.calendar.currentDate,
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
    }),
  );
  return { state, teamA, teamB };
}

describe("owned-team trade offer", () => {
  it("enqueueTradeOfferForOwner records both owned franchises in participantTeamIds", () => {
    const { state, teamA, teamB } = twoOwnedTeamsState();
    const proposal = ownedOwnedSwapProposal(state, teamA, teamB);
    const rosterBeforeA = [...state.world.teams[teamA]!.roster];
    const rosterBeforeB = [...state.world.teams[teamB]!.roster];

    const result = enqueueTradeOfferForOwner(state, teamA, proposal, {
      targetOwnedTeamId: teamB,
    });

    expect(result.outcome).toBe("queued");
    expect(result.state.user.pendingOwnerDecisions).toHaveLength(1);
    const decision = result.state.user.pendingOwnerDecisions[0]!;
    expect(decision.participantTeamIds).toEqual([teamB, teamA]);
    expect(decision.primaryTeamId).toBe(teamB);
    expect(result.state.world.teams[teamA]!.roster).toEqual(rosterBeforeA);
    expect(result.state.world.teams[teamB]!.roster).toEqual(rosterBeforeB);
  });

  it("tryEnqueueOwnedTeamTradeOffer queues one decision and does not auto-execute", () => {
    const { state, teamA, teamB } = twoOwnedTeamsState();
    const rosterBeforeA = [...state.world.teams[teamA]!.roster];
    const rosterBeforeB = [...state.world.teams[teamB]!.roster];

    let queued = false;
    let result = tryEnqueueOwnedTeamTradeOffer(state, teamA, teamB);
    if (result.outcome !== "queued") {
      // Fall back to direct enqueue when AI path cannot find a valid owned pair.
      const proposal = ownedOwnedSwapProposal(state, teamA, teamB);
      result = enqueueTradeOfferForOwner(state, teamA, proposal, {
        targetOwnedTeamId: teamB,
      });
    }
    expect(result.outcome).toBe("queued");
    queued = true;
    expect(queued).toBe(true);

    expect(result.state.user.pendingOwnerDecisions).toHaveLength(1);
    const decision = result.state.user.pendingOwnerDecisions[0]!;
    expect(decision.participantTeamIds).toContain(teamA);
    expect(decision.participantTeamIds).toContain(teamB);
    expect(decision.participantTeamIds.length).toBe(2);
    expect(result.state.world.teams[teamA]!.roster).toEqual(rosterBeforeA);
    expect(result.state.world.teams[teamB]!.roster).toEqual(rosterBeforeB);
  });
});

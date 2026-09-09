/**
 * Phase 5 state invariants — GameState first, then derived views.
 */

import { describe, expect, it } from "vitest";
import { executeTrade } from "@/systems/trades";
import {
  createTradeFixture,
  playerForPlayerProposal,
  teamIds,
} from "../systems/trades/fixture";
import {
  acceptOffer,
  makeOffer,
  isFreeAgent,
} from "@/systems/free-agency";
import { emptyInterestFactors } from "@/domain/free-agency/player-interest";
import type { EvaluatePlayerInterest } from "@/domain/free-agency/player-interest";
import {
  asContractId,
  asOfferId,
  asPlayerId,
  asTeamId,
} from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createPlayer } from "../factories/player";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";
import { toFinancesView, toContractsView } from "@/state/selectors";

const alwaysInterested: EvaluatePlayerInterest = (playerId, teamId) => ({
  playerId,
  teamId,
  score: 1,
  interested: true,
  factors: emptyInterestFactors(),
});

describe("phase5 trade invariants", () => {
  it("two-team trade updates both teamIds and roster memberships", () => {
    const state = createTradeFixture();
    const { teamA, teamB } = teamIds(state);
    const proposal = playerForPlayerProposal(state);
    const fromA = proposal.sideA.playerIds[0]!;
    const fromB = proposal.sideB.playerIds[0]!;

    expect(state.world.players[fromA]!.teamId).toBe(teamA);
    expect(state.world.players[fromB]!.teamId).toBe(teamB);

    const executed = executeTrade(state, proposal);
    const next = executed.state;

    expect(next.world.players[fromA]!.teamId).toBe(teamB);
    expect(next.world.players[fromB]!.teamId).toBe(teamA);
    expect(next.world.teams[teamA]!.roster).toContain(fromB);
    expect(next.world.teams[teamA]!.roster).not.toContain(fromA);
    expect(next.world.teams[teamB]!.roster).toContain(fromA);
    expect(next.world.teams[teamB]!.roster).not.toContain(fromB);
  });
});

describe("phase5 free-agency signing invariants", () => {
  it("acceptOffer assigns player, creates contract, updates payroll; date unchanged", () => {
    let state = createInitialGameState({
      saveId: "save_fa_inv",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const teamId = state.user.activeOwnerTeamId as ReturnType<typeof asTeamId>;
    const playerId = asPlayerId("player_fa_inv");
    const player = createPlayer({
      id: playerId,
      teamId: null,
      contractId: null,
    });
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: player,
        },
      },
    };

    expect(isFreeAgent(state, playerId)).toBe(true);
    const year = state.competition.season.year;
    const dateBefore = state.world.calendar.currentDate;
    const payrollBefore = toFinancesView(state).playerPayroll;
    const offerId = asOfferId("offer_fa_inv");

    state = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: {
        id: asContractId("contract_fa_inv"),
        playerId,
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [year]: 2_000_000 },
      },
    }).state;

    state = acceptOffer(state, offerId, {
      evaluateInterest: alwaysInterested,
    }).state;

    expect(state.world.calendar.currentDate).toBe(dateBefore);
    expect(state.world.players[playerId]!.teamId).toBe(teamId);
    expect(state.world.teams[teamId]!.roster).toContain(playerId);
    expect(
      toContractsView(state).some((c) => c.playerId === playerId),
    ).toBe(true);
    expect(toFinancesView(state).playerPayroll).toBeGreaterThan(payrollBefore);
  });
});

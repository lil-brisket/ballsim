import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { asContractId, asOfferId, asPlayerId } from "@/domain/ids";
import { validateGameState } from "@/persistence/validate-game-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  acceptOffer,
  makeOffer,
  releaseExpiredContracts,
} from "@/systems/free-agency";
import { releasePlayerContractOnRetirement } from "@/systems/player-retirement";
import { createPlayer } from "../factories/player";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

/**
 * Explicit multi-season accept → expire → re-sign cycle that exposed the FA freeze.
 */
describe("free-agency multi-season expire/re-sign cycles", () => {
  it("survives 3 consecutive 1-year contract expiration cycles for the same player", () => {
    let state = createInitialGameState({
      saveId: "save_fa_cycles",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const playerId = asPlayerId("player_cycle_fa");
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: createPlayer({
            id: playerId,
            teamId: null,
            contractId: null,
          }),
        },
      },
    };

    const teamId = state.user.activeOwnerTeamId;
    let year = state.competition.season.year;

    for (let cycle = 0; cycle < 3; cycle += 1) {
      const offerId = asOfferId(`offer_cycle_${cycle}`);
      const contractId = asContractId(`contract_cycle_${cycle}`);
      const offered = makeOffer(state, {
        id: offerId,
        playerId,
        teamId,
        terms: createContract({
          id: contractId,
          playerId,
          teamId,
          startYear: year,
          endYear: year,
          salaryByYear: { [String(year)]: 2_000_000 },
        }),
      }).state;
      const signed = acceptOffer(offered, offerId).state;
      expect(signed.world.players[playerId]!.contractId).toBe(contractId);
      expect(signed.business.freeAgency.offers[offerId]!.status).toBe(
        "accepted",
      );
      expect(() => validateGameState(signed)).not.toThrow();

      // Advance season year + offseason expiration
      year += 1;
      const nextSeason: GameState = {
        ...signed,
        competition: {
          ...signed.competition,
          season: {
            ...signed.competition.season,
            year,
            phase: "offseason",
            offseasonStage: "contract_expiration",
            offseasonStageEnteredDate: signed.world.calendar.currentDate,
            freeAgencyExtendedUntil: null,
          },
        },
      };
      const released = releaseExpiredContracts(nextSeason).state;
      expect(released.world.players[playerId]!.contractId).toBeNull();
      expect(released.business.freeAgency.offers[offerId]!.status).toBe(
        "accepted",
      );
      expect(released.business.freeAgency.offers[offerId]!.contractId).toBe(
        contractId,
      );
      expect(() => validateGameState(released)).not.toThrow();
      state = released;
    }

    // Historical accepted offers from all cycles remain without freezing validation
    const acceptedCount = Object.values(
      state.business.freeAgency.offers,
    ).filter((o) => o.status === "accepted").length;
    expect(acceptedCount).toBe(3);
  });

  it("keeps an accepted offer valid after retirement deletes its contract", () => {
    let state = createInitialGameState({
      saveId: "save_fa_retire",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const playerId = asPlayerId("player_retire_fa");
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: createPlayer({
            id: playerId,
            teamId: null,
            contractId: null,
          }),
        },
      },
    };
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_retire");
    const contractId = asContractId("contract_retire");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: createContract({
        id: contractId,
        playerId,
        teamId,
        startYear: year,
        endYear: year + 2,
        salaryByYear: {
          [String(year)]: 2_000_000,
          [String(year + 1)]: 2_000_000,
          [String(year + 2)]: 2_000_000,
        },
      }),
    }).state;
    const signed = acceptOffer(offered, offerId).state;
    const retired = releasePlayerContractOnRetirement(signed, playerId);
    const team = retired.world.teams[teamId]!;
    const afterRetire: GameState = {
      ...retired,
      world: {
        ...retired.world,
        teams: {
          ...retired.world.teams,
          [teamId]: {
            ...team,
            roster: team.roster.filter((id) => id !== playerId),
          },
        },
      },
    };

    expect(afterRetire.business.contracts[contractId]).toBeUndefined();
    expect(afterRetire.business.freeAgency.offers[offerId]!.status).toBe(
      "accepted",
    );
    expect(() => validateGameState(afterRetire)).not.toThrow();
  });

  it("keeps an accepted offer valid after the signing team trades the player", () => {
    let state = createInitialGameState({
      saveId: "save_fa_trade",
      rngSeed: TEST_RNG_SEED,
      nowIso: TEST_NOW_ISO,
      settings: CBL_GAME_SETTINGS,
    });
    const playerId = asPlayerId("player_trade_fa");
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: createPlayer({
            id: playerId,
            teamId: null,
            contractId: null,
          }),
        },
      },
    };
    const teamId = state.user.activeOwnerTeamId;
    const otherTeamId = Object.keys(state.world.teams).find(
      (id) => id !== teamId,
    ) as typeof teamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_trade");
    const contractId = asContractId("contract_trade");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: createContract({
        id: contractId,
        playerId,
        teamId,
        startYear: year,
        endYear: year,
        salaryByYear: { [String(year)]: 2_000_000 },
      }),
    }).state;
    const signed = acceptOffer(offered, offerId).state;
    // What trade execution does: the same contract follows the player.
    const from = signed.world.teams[teamId]!;
    const to = signed.world.teams[otherTeamId]!;
    const traded: GameState = {
      ...signed,
      business: {
        ...signed.business,
        contracts: {
          ...signed.business.contracts,
          [contractId]: {
            ...signed.business.contracts[contractId]!,
            teamId: otherTeamId,
          },
        },
      },
      world: {
        ...signed.world,
        players: {
          ...signed.world.players,
          [playerId]: {
            ...signed.world.players[playerId]!,
            teamId: otherTeamId,
          },
        },
        teams: {
          ...signed.world.teams,
          [teamId]: {
            ...from,
            roster: from.roster.filter((id) => id !== playerId),
          },
          [otherTeamId]: { ...to, roster: [...to.roster, playerId] },
        },
      },
    };

    expect(() => validateGameState(traded)).not.toThrow();

    // The player must still be where the contract says.
    const inconsistent: GameState = {
      ...traded,
      world: {
        ...traded.world,
        players: {
          ...traded.world.players,
          [playerId]: { ...traded.world.players[playerId]!, teamId },
        },
      },
    };
    expect(() => validateGameState(inconsistent)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import {
  asContractId,
  asOfferId,
  asPlayerId,
} from "@/domain/ids";
import { validateGameState } from "@/persistence/validate-game-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  acceptOffer,
  makeOffer,
  releaseExpiredContracts,
} from "@/systems/free-agency";
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

    const teamId = state.user.controlledTeamId;
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
      expect(signed.business.freeAgency.offers[offerId]!.status).toBe("accepted");
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
            offseasonStageEnteredDate:
              signed.world.calendar.currentDate,
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
    const acceptedCount = Object.values(state.business.freeAgency.offers).filter(
      (o) => o.status === "accepted",
    ).length;
    expect(acceptedCount).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { isOpenOffer } from "@/domain/entities/free-agency-offer";
import type { EvaluatePlayerInterest } from "@/domain/free-agency/player-interest";
import { emptyInterestFactors } from "@/domain/free-agency/player-interest";
import {
  asContractId,
  asOfferId,
  asPlayerId,
  asTeamId,
} from "@/domain/ids";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  GAME_STATE_SCHEMA_VERSION,
  type GameState,
} from "@/state/game-state";
import {
  acceptOffer,
  defaultEvaluatePlayerInterest,
  getFreeAgent,
  getPlayerInterest,
  isFreeAgent,
  listFreeAgents,
  makeOffer,
  negotiateOffer,
  rejectOffer,
  releaseExpiredContracts,
  releasePlayerToFreeAgency,
  withdrawOffer,
} from "@/systems/free-agency";
import { FREE_AGENCY_INTEREST_CONFIG } from "@/systems/free-agency-config";
import { getTeamCapSpace } from "@/systems/salary-cap";
import { createPlayer } from "../factories/player";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../helpers/determinism";

function baseState(): GameState {
  return createInitialGameState({
    saveId: "save_fa",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
}

function withFreeAgent(
  state: GameState,
  playerId: string = "player_fa",
): { state: GameState; playerId: ReturnType<typeof asPlayerId> } {
  const id = asPlayerId(playerId);
  const player = createPlayer({
    id,
    teamId: null,
    contractId: null,
  });
  return {
    playerId: id,
    state: {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [id]: player,
        },
      },
    },
  };
}

function contractTerms(input: {
  contractId: string;
  playerId: ReturnType<typeof asPlayerId>;
  teamId: ReturnType<typeof asTeamId>;
  startYear: number;
  endYear?: number;
  salary: number;
}) {
  const endYear = input.endYear ?? input.startYear;
  const salaryByYear: Record<string, number> = {};
  for (let year = input.startYear; year <= endYear; year += 1) {
    salaryByYear[String(year)] = input.salary;
  }
  return createContract({
    id: asContractId(input.contractId),
    playerId: input.playerId,
    teamId: input.teamId,
    startYear: input.startYear,
    endYear,
    salaryByYear,
  });
}

const uninterestedEvaluator: EvaluatePlayerInterest = (
  playerId,
  teamId,
) => ({
  playerId,
  teamId,
  score: 0,
  interested: false,
  factors: emptyInterestFactors(),
});

describe("free-agency pool", () => {
  it("lists free agents without duplicating player entities", () => {
    const base = baseState();
    const { state, playerId } = withFreeAgent(base);
    const pool = listFreeAgents(state);
    expect(pool.playerIds).toEqual([playerId]);
    expect(getFreeAgent(state, playerId)?.id).toBe(playerId);
    expect(isFreeAgent(state, playerId)).toBe(true);
  });

  it("does not list players with active contracts", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const playerId = asPlayerId("player_active");
    const contract = contractTerms({
      contractId: "contract_active",
      playerId,
      teamId,
      startYear: year,
      salary: 1_000_000,
    });
    const next: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          [playerId]: createPlayer({
            id: playerId,
            teamId,
            contractId: contract.id,
          }),
        },
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            roster: [playerId],
          },
        },
      },
      business: {
        ...state.business,
        contracts: { [contract.id]: contract },
      },
    };
    expect(isFreeAgent(next, playerId)).toBe(false);
    expect(listFreeAgents(next).playerIds).not.toContain(playerId);
  });

  it("releasePlayerToFreeAgency cleans membership for inactive contracts", () => {
    resetDomainEventSequenceForTests();
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const playerId = asPlayerId("player_expired");
    const contract = contractTerms({
      contractId: "contract_expired",
      playerId,
      teamId,
      startYear: year - 2,
      endYear: year - 1,
      salary: 2_000_000,
    });
    const seeded: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          [playerId]: createPlayer({
            id: playerId,
            teamId,
            contractId: contract.id,
          }),
        },
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            roster: [playerId],
          },
        },
      },
      business: {
        ...state.business,
        contracts: { [contract.id]: contract },
      },
    };

    expect(isFreeAgent(seeded, playerId)).toBe(true);
    const result = releasePlayerToFreeAgency(seeded, playerId);
    expect(result.state.world.players[playerId]?.teamId).toBeNull();
    expect(result.state.world.players[playerId]?.contractId).toBeNull();
    expect(result.state.world.teams[teamId]?.roster).not.toContain(playerId);
    expect(listFreeAgents(result.state).playerIds).toContain(playerId);
    expect(result.events.some((event) => event.type === "PlayerReleased")).toBe(
      true,
    );
  });

  it("throws when releasing a player with an active contract", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const playerId = asPlayerId("player_active_release");
    const contract = contractTerms({
      contractId: "contract_active_release",
      playerId,
      teamId,
      startYear: year,
      salary: 1_000_000,
    });
    const seeded: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          [playerId]: createPlayer({
            id: playerId,
            teamId,
            contractId: contract.id,
          }),
        },
      },
      business: {
        ...state.business,
        contracts: { [contract.id]: contract },
      },
    };
    expect(() => releasePlayerToFreeAgency(seeded, playerId)).toThrow(
      /active contract/,
    );
  });

  it("releaseExpiredContracts uses status helpers and clears membership", () => {
    const state = baseState();
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const playerId = asPlayerId("player_batch_expire");
    const contract = contractTerms({
      contractId: "contract_batch_expire",
      playerId,
      teamId,
      startYear: year - 3,
      endYear: year - 1,
      salary: 1_500_000,
    });
    const seeded: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          [playerId]: createPlayer({
            id: playerId,
            teamId,
            contractId: contract.id,
          }),
        },
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            roster: [playerId],
          },
        },
      },
      business: {
        ...state.business,
        contracts: { [contract.id]: contract },
      },
    };
    const result = releaseExpiredContracts(seeded);
    expect(result.state.world.players[playerId]?.teamId).toBeNull();
    expect(result.state.world.players[playerId]?.contractId).toBeNull();
    expect(listFreeAgents(result.state).playerIds).toContain(playerId);
  });
});

describe("free-agency interest", () => {
  it("evaluates interest deterministically with the default evaluator", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const first = getPlayerInterest(state, playerId, teamId);
    const second = getPlayerInterest(state, playerId, teamId);
    expect(first).toEqual(second);
    expect(first.score).toBe(FREE_AGENCY_INTEREST_CONFIG.baselineScore);
    expect(first.interested).toBe(true);
    expect(first.factors).toEqual(emptyInterestFactors());
    expect(defaultEvaluatePlayerInterest(playerId, teamId, state)).toEqual(
      first,
    );
  });

  it("supports an injected evaluator for extension", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const interest = getPlayerInterest(
      state,
      playerId,
      teamId,
      uninterestedEvaluator,
    );
    expect(interest.interested).toBe(false);
  });
});

describe("free-agency offers", () => {
  it("creates a valid pending offer after validating terms", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const terms = contractTerms({
      contractId: "contract_offer_1",
      playerId,
      teamId,
      startYear: year,
      salary: 5_000_000,
    });
    const offerId = asOfferId("offer_1");
    const result = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms,
    });
    const offer = result.state.business.freeAgency.offers[offerId]!;
    expect(offer.status).toBe("pending");
    expect(offer.createdOn).toBe(state.world.calendar.currentDate);
    expect(offer.updatedOn).toBe(offer.createdOn);
    expect(isOpenOffer(offer.status)).toBe(true);
  });

  it("rejects impossible contract terms when making an offer", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    expect(() =>
      makeOffer(state, {
        id: asOfferId("offer_bad_terms"),
        playerId,
        teamId,
        terms: {
          id: asContractId("contract_bad"),
          playerId,
          teamId,
          startYear: 2028,
          endYear: 2026,
          salaryByYear: {},
        },
      }),
    ).toThrow(/startYear must be <= endYear/);
  });

  it("rejects offers for missing players, non-free-agents, and duplicate open offers", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const terms = contractTerms({
      contractId: "contract_dup",
      playerId,
      teamId,
      startYear: year,
      salary: 1_000_000,
    });

    expect(() =>
      makeOffer(state, {
        id: asOfferId("offer_missing_player"),
        playerId: asPlayerId("missing"),
        teamId,
        terms: { ...terms, playerId: asPlayerId("missing") },
      }),
    ).toThrow(/does not exist/);

    const activePlayerId = asPlayerId("player_not_fa");
    const activeContract = contractTerms({
      contractId: "contract_not_fa",
      playerId: activePlayerId,
      teamId,
      startYear: year,
      salary: 1_000_000,
    });
    const withActive: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [activePlayerId]: createPlayer({
            id: activePlayerId,
            teamId,
            contractId: activeContract.id,
          }),
        },
      },
      business: {
        ...state.business,
        contracts: { [activeContract.id]: activeContract },
      },
    };
    expect(() =>
      makeOffer(withActive, {
        id: asOfferId("offer_not_fa"),
        playerId: activePlayerId,
        teamId,
        terms: {
          ...activeContract,
          id: asContractId("contract_offer_not_fa"),
        },
      }),
    ).toThrow(/not a free agent/);

    const first = makeOffer(state, {
      id: asOfferId("offer_dup_a"),
      playerId,
      teamId,
      terms,
    });
    expect(() =>
      makeOffer(first.state, {
        id: asOfferId("offer_dup_b"),
        playerId,
        teamId,
        terms: {
          ...terms,
          id: asContractId("contract_dup_b"),
        },
      }),
    ).toThrow(/already has an open/);
  });
});

describe("free-agency negotiation and reject", () => {
  it("moves pending offers into negotiation", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_negotiate");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_negotiate",
        playerId,
        teamId,
        startYear: year,
        salary: 2_000_000,
      }),
    }).state;
    const negotiated = negotiateOffer(offered, offerId);
    expect(negotiated.state.business.freeAgency.offers[offerId]?.status).toBe(
      "negotiating",
    );
  });

  it("rejects via negotiate/accept when uninterested without throwing", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_uninterested");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_uninterested",
        playerId,
        teamId,
        startYear: year,
        salary: 2_000_000,
      }),
    }).state;

    const negotiated = negotiateOffer(offered, offerId, {
      evaluateInterest: uninterestedEvaluator,
    });
    expect(negotiated.state.business.freeAgency.offers[offerId]?.status).toBe(
      "rejected",
    );
    expect(isFreeAgent(negotiated.state, playerId)).toBe(true);

    const offeredAgain = makeOffer(state, {
      id: asOfferId("offer_uninterested_accept"),
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_uninterested_accept",
        playerId,
        teamId,
        startYear: year,
        salary: 2_000_000,
      }),
    }).state;
    const accepted = acceptOffer(
      offeredAgain,
      asOfferId("offer_uninterested_accept"),
      { evaluateInterest: uninterestedEvaluator },
    );
    expect(
      accepted.state.business.freeAgency.offers["offer_uninterested_accept"]
        ?.status,
    ).toBe("rejected");
    expect(Object.keys(accepted.state.business.contracts)).toHaveLength(0);
  });

  it("rejectOffer leaves pool and roster unchanged", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_reject");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_reject",
        playerId,
        teamId,
        startYear: year,
        salary: 1_000_000,
      }),
    }).state;
    const rejected = rejectOffer(offered, offerId);
    expect(rejected.state.business.freeAgency.offers[offerId]?.status).toBe(
      "rejected",
    );
    expect(isFreeAgent(rejected.state, playerId)).toBe(true);
    expect(rejected.state.world.players[playerId]?.teamId).toBeNull();
    expect(rejected.state.world.teams[teamId]?.roster).not.toContain(playerId);
    expect(Object.keys(rejected.state.business.contracts)).toHaveLength(0);
  });

  it("throws on stale accept/reject of terminal offers", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_stale");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_stale",
        playerId,
        teamId,
        startYear: year,
        salary: 1_000_000,
      }),
    }).state;
    const rejected = rejectOffer(offered, offerId).state;
    expect(() => rejectOffer(rejected, offerId)).toThrow(/already resolved/);
    const acceptStale = acceptOffer(rejected, offerId);
    expect(acceptStale.state.business.freeAgency.offers[offerId]!.status).toBe(
      "rejected",
    );
    expect(() => withdrawOffer(rejected, offerId)).toThrow(/already resolved/);
  });
});

describe("free-agency accept", () => {
  it("creates a contract, updates membership, and withdraws competing open offers only", () => {
    resetDomainEventSequenceForTests();
    const { state, playerId } = withFreeAgent(baseState());
    const teamIds = Object.keys(state.world.teams);
    const teamA = asTeamId(teamIds[0]!);
    const teamB = asTeamId(teamIds[1]!);
    const year = state.competition.season.year;

    const offerA = asOfferId("offer_a");
    const offerB = asOfferId("offer_b");
    const offerC = asOfferId("offer_c_rejected_history");

    let current = makeOffer(state, {
      id: offerA,
      playerId,
      teamId: teamA,
      terms: contractTerms({
        contractId: "contract_a",
        playerId,
        teamId: teamA,
        startYear: year,
        salary: 3_000_000,
      }),
    }).state;
    current = makeOffer(current, {
      id: offerB,
      playerId,
      teamId: teamB,
      terms: contractTerms({
        contractId: "contract_b",
        playerId,
        teamId: teamB,
        startYear: year,
        salary: 4_000_000,
      }),
    }).state;
    current = makeOffer(current, {
      id: offerC,
      playerId,
      teamId: asTeamId(teamIds[2]!),
      terms: contractTerms({
        contractId: "contract_c",
        playerId,
        teamId: asTeamId(teamIds[2]!),
        startYear: year,
        salary: 2_000_000,
      }),
    }).state;
    current = rejectOffer(current, offerC).state;

    const accepted = acceptOffer(current, offerA);
    const next = accepted.state;
    const offer = next.business.freeAgency.offers[offerA]!;
    const contract = next.business.contracts["contract_a"]!;
    const player = next.world.players[playerId]!;

    expect(offer.status).toBe("accepted");
    expect(offer.contractId).toBe(contract.id);
    expect(player.contractId).toBe(contract.id);
    expect(player.teamId).toBe(teamA);
    expect(next.world.teams[teamA]?.roster).toContain(playerId);
    expect(isFreeAgent(next, playerId)).toBe(false);
    expect(listFreeAgents(next).playerIds).not.toContain(playerId);
    expect(next.business.freeAgency.offers[offerB]?.status).toBe("withdrawn");
    expect(next.business.freeAgency.offers[offerC]?.status).toBe("rejected");
    expect(accepted.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["ContractSigned", "FreeAgentSigned"]),
    );

    for (const team of Object.values(next.world.teams)) {
      if (team.id !== teamA) {
        expect(team.roster).not.toContain(playerId);
      }
    }
  });

  it("allows first-year salary equal to cap space for contract startYear", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const startYear = state.competition.season.year + 1;
    const capSpace = getTeamCapSpace(teamId, startYear, state);
    const offerId = asOfferId("offer_exact_cap");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_exact_cap",
        playerId,
        teamId,
        startYear,
        salary: capSpace,
      }),
    }).state;
    const accepted = acceptOffer(offered, offerId);
    expect(
      accepted.state.business.freeAgency.offers[offerId]?.status,
    ).toBe("accepted");
  });

  it("invalidates offer when first-year salary exceeds cap space for startYear", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const startYear = state.competition.season.year;
    const capSpace = getTeamCapSpace(teamId, startYear, state);
    const offerId = asOfferId("offer_over_cap");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_over_cap",
        playerId,
        teamId,
        startYear,
        salary: capSpace + 1,
      }),
    }).state;
    const result = acceptOffer(offered, offerId);
    expect(result.state.business.freeAgency.offers[offerId]!.status).toBe(
      "withdrawn",
    );
    expect(
      result.events.some((e) => e.type === "FreeAgencyOfferInvalidated"),
    ).toBe(true);
    expect(result.state.world.players[playerId]!.contractId).toBeNull();
  });
});

describe("free-agency persistence", () => {
  it("migrates schemaVersion 16 saves to empty freeAgency offers", () => {
    const modern = createInitialGameState({
    saveId: "save_v16_fa",
      rngSeed: 41,
      nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });
    const { freeAgency: _freeAgency, ...businessV16 } = modern.business;
    const stateV16 = {
      ...modern,
      meta: {
        ...modern.meta,
        schemaVersion: 16,
      },
      business: businessV16,
    };
    const migrated = deserializeGameState(JSON.stringify(stateV16));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.business.freeAgency.offers).toEqual({});
  });

  it("round-trips an accepted signing through serialize/deserialize/validate", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_persist");
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_persist",
        playerId,
        teamId,
        startYear: year,
        salary: 6_000_000,
      }),
    }).state;
    const signed = acceptOffer(offered, offerId).state;
    const restored = deserializeGameState(serializeGameState(signed));
    expect(() => validateGameState(restored)).not.toThrow();

    const offer = restored.business.freeAgency.offers[offerId]!;
    const player = restored.world.players[playerId]!;
    const contract = restored.business.contracts["contract_persist"]!;
    expect(offer.status).toBe("accepted");
    expect(offer.contractId).toBe(player.contractId);
    expect(player.contractId).toBe(contract.id);
    expect(player.teamId).toBe(teamId);
    expect(restored.world.teams[teamId]?.roster).toContain(playerId);
  });
});

describe("free-agency invariants", () => {
  it("never leaves a player as free agent with an active contract after accept", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_invariant");
    const signed = acceptOffer(
      makeOffer(state, {
        id: offerId,
        playerId,
        teamId,
        terms: contractTerms({
          contractId: "contract_invariant",
          playerId,
          teamId,
          startYear: year,
          salary: 1_000_000,
        }),
      }).state,
      offerId,
    ).state;
    const player = signed.world.players[playerId]!;
    expect(player.contractId).not.toBeNull();
    expect(isFreeAgent(signed, playerId)).toBe(false);
  });

  it("never places a signed player on multiple active rosters", () => {
    const state = baseState();
    const teamIds = Object.keys(state.world.teams);
    const teamA = asTeamId(teamIds[0]!);
    const teamB = asTeamId(teamIds[1]!);
    const playerId = asPlayerId("player_multi_roster");
    const seeded: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          [playerId]: createPlayer({
            id: playerId,
            teamId: null,
            contractId: null,
          }),
        },
        teams: {
          ...state.world.teams,
          [teamA]: {
            ...state.world.teams[teamA]!,
            roster: [playerId],
          },
          [teamB]: {
            ...state.world.teams[teamB]!,
            roster: [playerId],
          },
        },
      },
    };
    expect(() => validateGameState(seeded)).toThrow(/multiple team rosters/);

    const year = state.competition.season.year;
    const cleaned = acceptOffer(
      makeOffer(
        {
          ...seeded,
          world: {
            ...seeded.world,
            teams: {
              ...state.world.teams,
              [teamA]: { ...state.world.teams[teamA]!, roster: [] },
              [teamB]: { ...state.world.teams[teamB]!, roster: [] },
            },
          },
        },
        {
          id: asOfferId("offer_multi"),
          playerId,
          teamId: teamA,
          terms: contractTerms({
            contractId: "contract_multi",
            playerId,
            teamId: teamA,
            startYear: year,
            salary: 1_000_000,
          }),
        },
      ).state,
      asOfferId("offer_multi"),
    ).state;

    for (const team of Object.values(cleaned.world.teams)) {
      const count = team.roster.filter((id) => id === playerId).length;
      expect(count).toBe(team.id === teamA ? 1 : 0);
    }
  });
});

describe("isOpenOffer", () => {
  it("treats only pending and negotiating as open", () => {
    expect(isOpenOffer("pending")).toBe(true);
    expect(isOpenOffer("negotiating")).toBe(true);
    expect(isOpenOffer("accepted")).toBe(false);
    expect(isOpenOffer("rejected")).toBe(false);
    expect(isOpenOffer("withdrawn")).toBe(false);
  });
});

describe("stale accepted offer after contract expiration", () => {
  it("does not fail validateGameState after accept then releaseExpiredContracts", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_expire_cycle");
    const signed = acceptOffer(
      makeOffer(state, {
        id: offerId,
        playerId,
        teamId,
        terms: contractTerms({
          contractId: "contract_expire_cycle",
          playerId,
          teamId,
          startYear: year,
          salary: 2_000_000,
        }),
      }).state,
      offerId,
    ).state;

    expect(signed.world.players[playerId]!.contractId).toBe(
      "contract_expire_cycle",
    );
    expect(signed.business.freeAgency.offers[offerId]!.status).toBe("accepted");

    const offseason: GameState = {
      ...signed,
      competition: {
        ...signed.competition,
        season: {
          ...signed.competition.season,
          phase: "offseason",
          offseasonStage: "contract_expiration",
        },
      },
    };
    const released = releaseExpiredContracts(offseason).state;
    expect(released.world.players[playerId]!.contractId).toBeNull();
    expect(released.business.freeAgency.offers[offerId]!.status).toBe(
      "accepted",
    );
    expect(released.business.freeAgency.offers[offerId]!.contractId).toBe(
      "contract_expire_cycle",
    );
    expect(() => validateGameState(released)).not.toThrow();
  });

  it("invalidates stale open offers without crashing when player is no longer a free agent", () => {
    const { state, playerId } = withFreeAgent(baseState());
    const teamId = state.user.controlledTeamId;
    const year = state.competition.season.year;
    const offerId = asOfferId("offer_stale_open");

    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms: contractTerms({
        contractId: "contract_stale_open",
        playerId,
        teamId,
        startYear: year,
        salary: 1_000_000,
      }),
    }).state;

    const otherContractId = asContractId("contract_elsewhere");
    const otherTeamId = asTeamId(
      Object.keys(state.world.teams).find((id) => id !== teamId)!,
    );
    const raced: GameState = {
      ...offered,
      business: {
        ...offered.business,
        contracts: {
          ...offered.business.contracts,
          [otherContractId]: createContract({
            id: otherContractId,
            playerId,
            teamId: otherTeamId,
            startYear: year,
            endYear: year,
            salaryByYear: { [String(year)]: 1_500_000 },
          }),
        },
      },
      world: {
        ...offered.world,
        players: {
          ...offered.world.players,
          [playerId]: {
            ...offered.world.players[playerId]!,
            teamId: otherTeamId,
            contractId: otherContractId,
          },
        },
        teams: {
          ...offered.world.teams,
          [otherTeamId]: {
            ...offered.world.teams[otherTeamId]!,
            roster: [
              ...offered.world.teams[otherTeamId]!.roster,
              playerId,
            ],
          },
        },
      },
    };

    const staleResult = acceptOffer(raced, offerId);
    expect(staleResult.state.business.freeAgency.offers[offerId]!.status).toBe(
      "withdrawn",
    );
    expect(
      staleResult.events.some((e) => e.type === "FreeAgencyOfferInvalidated"),
    ).toBe(true);
    expect(staleResult.state.world.players[playerId]!.contractId).toBe(
      otherContractId,
    );
    expect(() => validateGameState(staleResult.state)).not.toThrow();
  });
});

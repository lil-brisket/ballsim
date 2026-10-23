import { describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  announceFinalContractYears,
  EXTENSION_REFUSAL_COOLDOWN_DAYS,
  evaluateExtensionOffer,
  getExtensionBlockReason,
  offerContractExtension,
  playerExtensionAsk,
} from "@/systems/contract-extensions";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getContractSigningYear } from "@/systems/salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";

/** Preseason league; the owner's first contracted player expires this season. */
function setup(seed = 31): {
  state: GameState;
  teamId: TeamId;
  playerId: PlayerId;
} {
  const initial = createInitialGameState({
    saveId: `ext_${seed}`,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  let state = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const teamId = state.user.activeOwnerTeamId;
  const playerId = state.world.teams[teamId]!.roster.find(
    (id) => state.world.players[id]?.contractId != null,
  )!;
  const player = state.world.players[playerId]!;
  const contract = state.business.contracts[player.contractId!]!;
  const year = getContractSigningYear(state);
  state = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        // Young enough to accept a one-year extension.
        [playerId]: { ...player, age: 25 },
      },
    },
    business: {
      ...state.business,
      contracts: {
        ...state.business.contracts,
        [contract.id]: {
          id: contract.id,
          playerId: contract.playerId,
          teamId: contract.teamId,
          startYear: year,
          endYear: year,
          salaryByYear: { [String(year)]: 2_000_000 },
        },
      },
    },
  };
  return { state, teamId, playerId };
}

describe("evaluateExtensionOffer", () => {
  it("accepts his ask, counters near it, refuses a lowball", () => {
    const { state, teamId, playerId } = setup();
    const ask = playerExtensionAsk(state, playerId, teamId);
    expect(
      evaluateExtensionOffer(state, playerId, teamId, {
        years: 2,
        salary: ask.salary,
      }).kind,
    ).toBe("accept");
    const counter = evaluateExtensionOffer(state, playerId, teamId, {
      years: 2,
      salary: Math.round(ask.salary * 0.9),
    });
    expect(counter).toEqual({ kind: "counter", salary: ask.salary, years: 2 });
    expect(
      evaluateExtensionOffer(state, playerId, teamId, {
        years: 2,
        salary: Math.round(ask.salary * 0.6),
      }).kind,
    ).toBe("refuse");
  });

  it("wants at least two seasons from age 30", () => {
    const { state, teamId, playerId } = setup();
    const older: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...state.world.players[playerId]!, age: 31 },
        },
      },
    };
    const ask = playerExtensionAsk(older, playerId, teamId);
    expect(ask.minYears).toBe(2);
    expect(
      evaluateExtensionOffer(older, playerId, teamId, {
        years: 1,
        salary: ask.salary,
      }),
    ).toEqual({ kind: "counter", salary: ask.salary, years: 2 });
  });

  it("answers the same whether an owner or the CPU runs the team", () => {
    const { state, teamId, playerId } = setup();
    const terms = { years: 3, salary: 9_000_000 };
    const asCpu: GameState = {
      ...state,
      user: { ...state.user, ownedTeamIds: [] },
    };
    expect(evaluateExtensionOffer(asCpu, playerId, teamId, terms)).toEqual(
      evaluateExtensionOffer(state, playerId, teamId, terms),
    );
  });
});

describe("offerContractExtension", () => {
  it("extends the contract on accept and clears the talks", () => {
    const { state, teamId, playerId } = setup();
    const ask = playerExtensionAsk(state, playerId, teamId);
    const year = getContractSigningYear(state);
    const { result, response } = offerContractExtension(state, {
      playerId,
      teamId,
      terms: { years: 3, salary: ask.salary },
    });
    expect(response.kind).toBe("accept");
    const contract =
      result.state.business.contracts[
        result.state.world.players[playerId]!.contractId!
      ]!;
    expect(contract.endYear).toBe(year + 3);
    expect(contract.salaryByYear[String(year + 1)]).toBe(ask.salary);
    expect(contract.salaryByYear[String(year)]).toBe(2_000_000);
    expect(result.state.business.extensionTalks[playerId]).toBeUndefined();
    const signed = result.events.find((e) => e.type === "ContractSigned");
    expect(signed?.payload.reason).toBe("extension");
    expect(() => validateGameState(result.state)).not.toThrow();
  });

  it("starts a cooldown after a refusal and tests the market after two", () => {
    const { state, teamId, playerId } = setup();
    const lowball = { years: 2, salary: 1_500_000 };
    const first = offerContractExtension(state, {
      playerId,
      teamId,
      terms: lowball,
    });
    expect(first.response.kind).toBe("refuse");
    expect(first.result.events.map((e) => e.type)).toContain(
      "ContractExtensionRefused",
    );
    expect(
      getExtensionBlockReason(first.result.state, { playerId, teamId }),
    ).toMatch(/turned down/);

    const later: GameState = {
      ...first.result.state,
      world: {
        ...first.result.state.world,
        calendar: {
          ...first.result.state.world.calendar,
          currentDate: addCalendarDays(
            state.world.calendar.currentDate,
            EXTENSION_REFUSAL_COOLDOWN_DAYS,
          ),
        },
      },
    };
    expect(getExtensionBlockReason(later, { playerId, teamId })).toBeNull();
    const second = offerContractExtension(later, {
      playerId,
      teamId,
      terms: lowball,
    });
    expect(second.result.state.business.extensionTalks[playerId]).toMatchObject(
      { refusals: 2, testingMarket: true },
    );
    expect(
      getExtensionBlockReason(second.result.state, { playerId, teamId }),
    ).toMatch(/test free agency/);
  });

  it("is blocked with more than two seasons left", () => {
    const { state, teamId, playerId } = setup();
    const contractId = state.world.players[playerId]!.contractId!;
    const year = getContractSigningYear(state);
    const long: GameState = {
      ...state,
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [contractId]: {
            ...state.business.contracts[contractId]!,
            endYear: year + 2,
            salaryByYear: {
              [String(year)]: 2_000_000,
              [String(year + 1)]: 2_000_000,
              [String(year + 2)]: 2_000_000,
            },
          },
        },
      },
    };
    expect(getExtensionBlockReason(long, { playerId, teamId })).toMatch(
      /2 seasons or fewer/,
    );
  });

  it("cannot take the team over the cap", () => {
    const { state, teamId, playerId } = setup();
    const cap = getLeagueSalaryCap(state);
    const year = getContractSigningYear(state);
    // A teammate already takes 90% of next season's cap.
    const mateId = state.world.teams[teamId]!.roster.find(
      (id) => id !== playerId && state.world.players[id]?.contractId != null,
    )!;
    const mateContractId = state.world.players[mateId]!.contractId!;
    const squeezed: GameState = {
      ...state,
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [mateContractId]: {
            ...state.business.contracts[mateContractId]!,
            startYear: year,
            endYear: year + 1,
            salaryByYear: {
              [String(year)]: 1_000_000,
              [String(year + 1)]: Math.round(cap * 0.9),
            },
            teamOption: undefined,
            playerOption: undefined,
          },
        },
      },
    };
    expect(
      getExtensionBlockReason(squeezed, {
        playerId,
        teamId,
        terms: { years: 1, salary: Math.round(cap * 0.2) },
      }),
    ).toMatch(/over the cap in/);
  });
});

describe("announceFinalContractYears", () => {
  it("notifies the owner about key players in the last season of a deal", () => {
    const { state, teamId, playerId } = setup();
    // setup() makes the player's deal end this season; make him the best.
    const player = state.world.players[playerId]!;
    const attributes = Object.fromEntries(
      Object.keys(player.attributes).map((key) => [key, 95]),
    ) as typeof player.attributes;
    const starred: GameState = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [playerId]: { ...player, attributes },
        },
      },
    };
    const events = announceFinalContractYears(starred);
    expect(
      events.some(
        (e) =>
          e.type === "ContractFinalYear" &&
          e.payload.playerId === playerId &&
          e.payload.teamId === teamId,
      ),
    ).toBe(true);
    // CPU teams get no owner notices.
    expect(events.every((e) => e.payload.teamId === teamId)).toBe(true);
  });
});

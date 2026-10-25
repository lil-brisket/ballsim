import { describe, expect, it } from "vitest";
import {
  PLAYER_RETIREMENT_HIGH_AGE,
  PLAYER_RETIREMENT_MIN_AGE,
} from "@/systems/league-rules/invariants";
import {
  playerRetirementProbability,
  processPlayerRetirements,
} from "@/systems/player-retirement";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { releasePlayerToFreeAgency } from "@/systems/free-agency";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { playerSeason } from "../state/history-fixtures";

describe("playerRetirementProbability", () => {
  it("is zero before the minimum retirement age", () => {
    expect(playerRetirementProbability(PLAYER_RETIREMENT_MIN_AGE - 1, 50)).toBe(
      0,
    );
    expect(playerRetirementProbability(PLAYER_RETIREMENT_MIN_AGE - 1, 90)).toBe(
      0,
    );
  });

  it("makes 80+ overall linger and sub-60 leave sooner", () => {
    const age = PLAYER_RETIREMENT_MIN_AGE + 4;
    const star = playerRetirementProbability(age, 88);
    const replacement = playerRetirementProbability(age, 55);
    const average = playerRetirementProbability(age, 70);
    expect(star).toBeLessThan(average);
    expect(replacement).toBeGreaterThan(average);
  });

  it("rises sharply at the high-age band", () => {
    const before = playerRetirementProbability(
      PLAYER_RETIREMENT_HIGH_AGE - 1,
      70,
    );
    const atHigh = playerRetirementProbability(PLAYER_RETIREMENT_HIGH_AGE, 70);
    expect(atHigh).toBeGreaterThan(before);
    expect(atHigh).toBeLessThanOrEqual(0.85);
  });
});

describe("processPlayerRetirements: unsigned free agents", () => {
  function leagueWithUnsigned(count: number): {
    state: GameState;
    unsignedIds: PlayerId[];
  } {
    const initial = createInitialGameState({
      saveId: "unsigned_retirement",
      rngSeed: 61,
      settings: CBL_GAME_SETTINGS,
    });
    let state = bootstrapWorld(
      initial,
      createSeededRng(initial.meta.rngState),
    ).state;
    const unsignedIds: PlayerId[] = [];
    for (const team of Object.values(state.world.teams)) {
      for (const playerId of team.roster.slice(0, 2)) {
        if (unsignedIds.length >= count) break;
        const player = state.world.players[playerId]!;
        const contract = state.business.contracts[player.contractId!]!;
        state = {
          ...state,
          world: {
            ...state.world,
            players: {
              ...state.world.players,
              [playerId]: { ...player, age: 24 },
            },
          },
          business: {
            ...state.business,
            contracts: {
              ...state.business.contracts,
              [contract.id]: {
                ...contract,
                endYear: state.competition.season.year - 1,
                salaryByYear: {},
              },
            },
          },
        };
        state = releasePlayerToFreeAgency(state, playerId).state;
        unsignedIds.push(playerId);
      }
    }
    return { state, unsignedIds };
  }

  it("retires some young free agents who sat out the season, no signed ones", () => {
    const { state, unsignedIds } = leagueWithUnsigned(20);
    const result = processPlayerRetirements(state, createSeededRng(5)).state;
    const retired = unsignedIds.filter(
      (id) => result.world.players[id]!.retired === true,
    );
    expect(retired.length).toBeGreaterThan(0);
    expect(retired.length).toBeLessThan(unsignedIds.length);
    const signedYoungRetired = Object.values(result.world.players).filter(
      (player) =>
        player.retired === true &&
        state.world.players[player.id]!.teamId !== null &&
        state.world.players[player.id]!.age < PLAYER_RETIREMENT_MIN_AGE,
    );
    expect(signedYoungRetired).toHaveLength(0);
  });

  it("leaves a free agent alone who played part of the season", () => {
    const { state, unsignedIds } = leagueWithUnsigned(20);
    const seasonId = state.competition.season.id;
    const withRecords: GameState = {
      ...state,
      business: {
        ...state.business,
        playerHistory: Object.fromEntries(
          unsignedIds.map((id) => [
            id,
            {
              playerId: id,
              trackingStartedSeasonYear: state.competition.season.year,
              seasons: [
                {
                  ...playerSeason({
                    year: state.competition.season.year,
                    teamId: null,
                  }),
                  seasonId,
                },
              ],
            },
          ]),
        ),
      },
    };
    const result = processPlayerRetirements(
      withRecords,
      createSeededRng(5),
    ).state;
    expect(
      unsignedIds.filter((id) => result.world.players[id]!.retired === true),
    ).toHaveLength(0);
  });
});

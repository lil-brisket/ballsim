import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PlayerSeasonRecord } from "@/domain/entities/player-history";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { asContractId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  mergeSaveHistory,
  splitColdHistory,
  splitForStorage,
  withSaveHistory,
} from "@/persistence/save-history";
import { validateGameState } from "@/persistence/validate-game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getPlayerIdentity } from "@/state/player-identity";
import { careerSummary } from "@/systems/legacy";
import { createRetiredPlayerRecord } from "@/systems/player-retirement";
import { fillShortRosters } from "@/systems/roster-generation";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(): GameState {
  const state = createInitialGameState({
    saveId: "retired_archive",
    rngSeed: 31,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function line(points: number) {
  return {
    games: 70,
    minutes: 2000,
    points,
    rebounds: 300,
    assists: 200,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
  };
}

/**
 * Retire a rostered player the way processPlayerRetirements does, with
 * three seasons of history ending `retiredSeasonYear` and an older,
 * finished contract left behind as history.
 */
function retire(
  state: GameState,
  playerId: PlayerId,
  retiredSeasonYear: number,
): GameState {
  const player = state.world.players[playerId]!;
  const teamId = player.teamId as TeamId;
  const team = state.world.teams[teamId]!;
  const seasons = [2, 1, 0].map((back) => ({
    seasonYear: retiredSeasonYear - back,
    attributes: player.attributes,
    contractSnapshot: { contractId: null, salary: null, teamId },
    competition: {
      regular: line(1400),
      playoffs: line(0),
      development: line(0),
      combined: line(1400),
    },
  })) as unknown as PlayerSeasonRecord[];
  const { [player.contractId!]: _active, ...contracts } =
    state.business.contracts;
  const oldContractId = asContractId(`contract_old_${playerId}`);
  const withHistory: GameState = {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          retired: true,
          teamId: null,
          contractId: null,
        },
      },
      teams: {
        ...state.world.teams,
        [teamId]: {
          ...team,
          roster: team.roster.filter((id) => id !== playerId),
        },
      },
    },
    business: {
      ...state.business,
      contracts: {
        ...contracts,
        [oldContractId]: {
          id: oldContractId,
          playerId,
          teamId,
          startYear: retiredSeasonYear - 2,
          endYear: retiredSeasonYear - 1,
          salaryByYear: {
            [retiredSeasonYear - 2]: 1_000_000,
            [retiredSeasonYear - 1]: 1_000_000,
          },
        } as GameState["business"]["contracts"][string],
      },
      playerHistory: {
        ...state.business.playerHistory,
        [playerId]: {
          playerId,
          seasons,
          trackingStartedSeasonYear: seasons[0]!.seasonYear,
        },
      },
    },
  };
  return {
    ...withHistory,
    world: {
      ...withHistory.world,
      retiredPlayers: {
        ...withHistory.world.retiredPlayers,
        [playerId]: createRetiredPlayerRecord(
          withHistory,
          player,
          retiredSeasonYear,
        ),
      },
    },
  };
}

function setup(retiredSeasonsAgo = 2) {
  const base = league();
  const teamId = base.user.activeOwnerTeamId;
  const playerId = base.world.teams[teamId]!.roster[0]!;
  const year = base.competition.season.year;
  return {
    state: retire(base, playerId, year - retiredSeasonsAgo),
    playerId,
    teamId,
  };
}

describe("retired player archive", () => {
  it("moves a long-retired player and his history into his own chunk", () => {
    const { state, playerId } = setup();
    const { hot, chunks } = splitColdHistory(state);

    expect(hot.world.players[playerId]).toBeUndefined();
    expect(hot.business.playerHistory[playerId]).toBeUndefined();
    expect(hot.world.retiredPlayers[playerId]).toBeDefined();
    const chunk = chunks.find((c) => c.chunkId === `player:${playerId}`);
    expect(chunk?.history.players?.[playerId]).toEqual(
      state.world.players[playerId],
    );
    expect(chunk?.history.playerHistory?.[playerId]).toEqual(
      state.business.playerHistory[playerId],
    );
    // His finished contract stays as history and still validates.
    expect(() => validateGameState(hot)).not.toThrow();
    expect(getPlayerIdentity(hot, playerId)).toMatchObject({
      displayName: `${state.world.players[playerId]!.firstName} ${state.world.players[playerId]!.lastName}`,
      retired: true,
    });
  });

  it("puts him back for deep-history views", () => {
    const { state, playerId } = setup();
    const { hot, chunks } = splitColdHistory(state);
    const full = withSaveHistory(
      hot,
      mergeSaveHistory(chunks.map((c) => c.history)),
    );
    expect(full.world.players[playerId]).toEqual(state.world.players[playerId]);
    expect(full.business.playerHistory[playerId]).toEqual(
      state.business.playerHistory[playerId],
    );
  });

  it("scores his career the same from the archive record", () => {
    const { state, playerId } = setup();
    const { hot } = splitColdHistory(state);
    expect(careerSummary(hot, playerId)).toEqual(
      careerSummary(state, playerId),
    );
  });

  it("keeps recent retirees, referenced ones, and everyone on request", () => {
    const recent = setup(1);
    expect(
      splitColdHistory(recent.state).hot.world.players[recent.playerId],
    ).toBeDefined();

    const owed = setup();
    const withDeadMoney: GameState = {
      ...owed.state,
      business: {
        ...owed.state.business,
        deadMoney: {
          [owed.teamId]: [
            {
              playerId: owed.playerId,
              teamId: owed.teamId,
              seasonYear: owed.state.competition.season.year,
              amount: 500_000,
              reason: "waived",
              prepaid: false,
              createdOn: owed.state.world.calendar.currentDate,
            } as GameState["business"]["deadMoney"][string][number],
          ],
        },
      },
    };
    expect(
      splitColdHistory(withDeadMoney).hot.world.players[owed.playerId],
    ).toBeDefined();

    const kept = setup();
    expect(
      splitColdHistory(kept.state, { archivePlayers: false }).hot.world.players[
        kept.playerId
      ],
    ).toBeDefined();
  });

  it("keeps him in the snapshot if the archived snapshot fails validation", () => {
    const { state, playerId } = setup();
    const prepare = (hot: GameState) => {
      if (hot.world.players[playerId] === undefined) {
        throw new Error("still referenced");
      }
      return "{}";
    };
    const { chunks } = splitForStorage(state, prepare);
    expect(chunks.some((c) => c.chunkId === `player:${playerId}`)).toBe(false);
  });

  it("round-trips through a store", async () => {
    const { state, playerId } = setup();
    const store = createMemorySaveGameStore();
    await store.create({ id: "retired_archive", name: "Archive", state });

    const loaded = (await store.load("retired_archive"))!;
    expect(loaded.state.world.players[playerId]).toBeUndefined();
    const history = await store.loadHistory("retired_archive");
    expect(history.players?.[playerId]).toEqual(state.world.players[playerId]);
  });

  it("never reuses an archived player's id for a roster fill", () => {
    const base = league();
    const teamId = Object.keys(base.world.teams)
      .sort()
      .find((id) => id !== base.user.activeOwnerTeamId) as TeamId;
    const team = base.world.teams[teamId]!;
    // One short, and no free agents to sign: the fill generates a player
    // in the next slot, whose id an archived player already holds.
    const roster = team.roster.slice(0, 14);
    const takenId = `player_${teamId}_fill_${roster.length}` as PlayerId;
    const short: GameState = {
      ...base,
      world: {
        ...base.world,
        players: Object.fromEntries(
          Object.entries(base.world.players).filter(
            ([, player]) => player.teamId !== null,
          ),
        ),
        teams: {
          ...base.world.teams,
          [teamId]: { ...team, roster },
        },
        retiredPlayers: {
          [takenId]: {
            id: takenId,
            firstName: "Old",
            lastName: "Timer",
            position: "PG",
            jerseyNumber: 1,
            retiredSeasonYear: base.competition.season.year - 5,
            career: {
              seasons: 0,
              lastSeasonYear: null,
              totals: line(0),
              teamSeasons: [],
            },
          },
        },
      },
    };
    const filled = fillShortRosters(short, createSeededRng(7)).state;
    const filledRoster = filled.world.teams[teamId]!.roster;
    expect(filledRoster).not.toContain(takenId);
    expect(filledRoster).toContain(
      `player_${teamId}_fill_${roster.length + 1}`,
    );
  });
});

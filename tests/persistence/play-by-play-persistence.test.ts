import { describe, expect, it } from "vitest";
import { createGame, type Game } from "@/domain/entities/game";
import { PLAY_CODE } from "@/domain/entities/play-by-play";
import { asGameId, asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION, type GameState } from "@/state/game-state";
import { simulateGamesForDate } from "@/systems/game-simulation";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

const GAME_ID = "game_pbp_owner";
const FUTURE_ID = "game_pbp_future";

function scheduled(
  state: GameState,
  id: string,
  date: string,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
): Game {
  return createGame({
    id: asGameId(id),
    seasonId: state.competition.season.id,
    date,
    homeTeamId,
    awayTeamId,
    competitionType: "regular_season",
    status: "scheduled",
    score: { home: 0, away: 0 },
    periodScores: [],
    events: [],
    playerStats: [],
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
  });
}

/** A valid state holding one recorded owner game and one unplayed game. */
function recordedState(): GameState {
  let state = createTestGameState({ saveId: "pbp_persist" });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  const teamIds = Object.keys(state.world.teams).map((id) => asTeamId(id));
  const today = state.world.calendar.currentDate;
  const owner = scheduled(state, GAME_ID, today, teamIds[0]!, teamIds[1]!);
  const future = scheduled(
    state,
    FUTURE_ID,
    "2099-01-01",
    teamIds[0]!,
    teamIds[2]!,
  );
  state = {
    ...state,
    competition: {
      ...state.competition,
      games: { [owner.id]: owner, [future.id]: future },
      schedule: {
        ...state.competition.schedule,
        gameIds: [owner.id, future.id],
        gameIdsByDate: { [today]: [owner.id], "2099-01-01": [future.id] },
      },
    },
  };
  return simulateGamesForDate(state, createTestRng(41), today, undefined, {
    ownerTeamId: teamIds[0]!,
  }).state;
}

function mutated(edit: (state: GameState) => void): GameState {
  const state = structuredClone(recordedState());
  edit(state);
  return state;
}

describe("competition.playByPlay persistence", () => {
  it("accepts a recorded owner game", () => {
    const state = recordedState();
    expect(Object.keys(state.competition.playByPlay)).toEqual([GAME_ID]);
    expect(() => validateGameState(state)).not.toThrow();
  });

  it("round-trips through save/load unchanged", () => {
    const state = recordedState();
    const loaded = deserializeGameState(serializeGameState(state));
    expect(loaded.competition.playByPlay).toEqual(state.competition.playByPlay);
    expect(loaded.competition.games[GAME_ID]!.events).toEqual([]);
  });

  it("keeps a recorded game far smaller than the old thin events", () => {
    const log = recordedState().competition.playByPlay[GAME_ID]!;
    // Old Game.events averaged ~37 KB per possession game.
    expect(JSON.stringify(log).length).toBeLessThan(12_000);
  });

  it.each([
    [
      "an orphan entry",
      (s: GameState) => {
        s.competition.playByPlay.game_missing =
          s.competition.playByPlay[GAME_ID]!;
      },
      /missing from competition\.games/,
    ],
    [
      "a game that is not final",
      (s: GameState) => {
        s.competition.playByPlay[FUTURE_ID] =
          s.competition.playByPlay[GAME_ID]!;
      },
      /not final/,
    ],
    [
      "a replay that disagrees with the final score",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        const i = log.code.indexOf(PLAY_CODE.twoMade);
        log.code[i] = PLAY_CODE.twoMissed;
        log.player2[i] = -1;
      },
      /replays to/,
    ],
    [
      "a side that does not match the player's team",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        log.side[0] = log.side[0] === 0 ? 1 : 0;
      },
      /side does not match/,
    ],
    [
      "a foul without the fouled player",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        const i = log.code.findIndex(
          (code) =>
            code === PLAY_CODE.personalFoul ||
            code === PLAY_CODE.shootingFoul ||
            code === PLAY_CODE.offensiveFoul,
        );
        log.player2[i] = -1;
      },
      /player2 is required/,
    ],
    [
      "player2 on a code that never has one",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        const i = log.code.indexOf(PLAY_CODE.defensiveRebound);
        log.player2[i] = log.player[i] === 0 ? 1 : 0;
      },
      /player2 must be -1/,
    ],
    [
      "a clock outside the period length",
      (s: GameState) => {
        s.competition.playByPlay[GAME_ID]!.clock[0] = 721;
      },
      /clock must be an integer/,
    ],
    [
      "a period the game never reached",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        const game = s.competition.games[GAME_ID]!;
        log.period[log.period.length - 1] = game.periodScores.length + 1;
      },
      /exceeds the game's/,
    ],
    [
      "columns of different lengths",
      (s: GameState) => {
        s.competition.playByPlay[GAME_ID]!.poss.push(999);
      },
      /length must equal code length/,
    ],
    [
      "a player index out of range",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        log.player[0] = log.players.length;
      },
      /player must index players/,
    ],
    [
      "a player who did not take part",
      (s: GameState) => {
        const log = s.competition.playByPlay[GAME_ID]!;
        const game = s.competition.games[GAME_ID]!;
        const inGame = new Set<string>(
          game.playerStats.map((row) => row.playerId),
        );
        const outsider = Object.keys(s.world.players).find(
          (id) => !inGame.has(id),
        )!;
        log.players[log.players.length - 1] = outsider as never;
      },
      /has no box-score row/,
    ],
  ])("rejects %s", (_label, edit, message) => {
    expect(() => validateGameState(mutated(edit))).toThrow(message);
  });
});

describe("v65 → v66 migration (competition.playByPlay)", () => {
  function legacyV65Json(): { json: string; state: GameState } {
    const state = recordedState();
    const parsed = JSON.parse(serializeGameState(state)) as {
      meta: Record<string, unknown>;
      competition: Record<string, unknown> & {
        games: Record<string, { events: unknown[] }>;
      };
    };
    parsed.meta.schemaVersion = 65;
    delete parsed.competition.playByPlay;
    // Legacy saves carry thin events; migration must leave them alone.
    parsed.competition.games[GAME_ID]!.events = [
      { sequence: 0, type: "shot_made", playerId: null, teamId: null },
    ];
    return { json: JSON.stringify(parsed), state };
  }

  it("adds an empty playByPlay map and validates", () => {
    const { json } = legacyV65Json();
    const loaded = deserializeGameState(json);
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(loaded.competition.playByPlay).toEqual({});
    expect(loaded.competition.games[GAME_ID]!.events).toHaveLength(1);
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("is deterministic and round-trips", () => {
    const { json } = legacyV65Json();
    const first = deserializeGameState(json);
    const second = deserializeGameState(json);
    expect(second).toEqual(first);
    expect(deserializeGameState(serializeGameState(first))).toEqual(first);
  });
});

import { describe, expect, it } from "vitest";
import { createGame, type Game } from "@/domain/entities/game";
import {
  assertPlayByPlayLog,
  PLAY_CODE,
  type PlayByPlayLog,
} from "@/domain/entities/play-by-play";
import { asGameId, asTeamId, type TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  simulateGamesForDate,
  simulateScheduledGame,
} from "@/systems/game-simulation";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { initializeNewSeason } from "@/systems/simulation/offseason-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { createTestRng } from "../helpers/determinism";

const LIMITS = {
  periodCount: 99,
  regulationPeriodCount: GAME_SIMULATION_CONFIG.regulationPeriodCount,
  regulationPeriodSeconds: GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
  overtimePeriodSeconds: GAME_SIMULATION_CONFIG.overtimePeriodSeconds,
};

function scheduled(
  state: GameState,
  id: string,
  homeTeamId: TeamId,
  awayTeamId: TeamId,
): Game {
  return createGame({
    id: asGameId(id),
    seasonId: state.competition.season.id,
    date: state.world.calendar.currentDate,
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

function bootstrapped(saveId: string): { state: GameState; teamIds: TeamId[] } {
  let state = createTestGameState({ saveId });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  return {
    state,
    teamIds: Object.keys(state.world.teams).map((id) => asTeamId(id)),
  };
}

function withGames(state: GameState, games: Game[]): GameState {
  const byId: Record<string, Game> = {};
  for (const game of games) {
    byId[game.id] = game;
  }
  const date = state.world.calendar.currentDate;
  return {
    ...state,
    competition: {
      ...state.competition,
      games: byId,
      schedule: {
        ...state.competition.schedule,
        gameIds: games.map((game) => game.id),
        gameIdsByDate: { [date]: games.map((game) => game.id) },
      },
    },
  };
}

type Line = {
  points: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
};

/** Rebuilds per-player box lines purely from the log and the code table. */
function replayLines(log: PlayByPlayLog): Map<string, Line> {
  const lines = new Map<string, Line>();
  const line = (index: number): Line => {
    const id = log.players[index]!;
    let row = lines.get(id);
    if (!row) {
      row = {
        points: 0,
        fgm: 0,
        fga: 0,
        tpm: 0,
        tpa: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        dreb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        pf: 0,
      };
      lines.set(id, row);
    }
    return row;
  };
  for (let i = 0; i < log.code.length; i += 1) {
    const p = line(log.player[i]!);
    const second = log.player2[i]!;
    switch (log.code[i]) {
      case PLAY_CODE.twoMade:
        p.points += 2;
        p.fgm += 1;
        p.fga += 1;
        if (second >= 0) line(second).ast += 1;
        break;
      case PLAY_CODE.threeMade:
        p.points += 3;
        p.fgm += 1;
        p.fga += 1;
        p.tpm += 1;
        p.tpa += 1;
        if (second >= 0) line(second).ast += 1;
        break;
      case PLAY_CODE.twoMissed:
        p.fga += 1;
        if (second >= 0) line(second).blk += 1;
        break;
      case PLAY_CODE.threeMissed:
        p.fga += 1;
        p.tpa += 1;
        if (second >= 0) line(second).blk += 1;
        break;
      case PLAY_CODE.freeThrowMade:
        p.points += 1;
        p.ftm += 1;
        p.fta += 1;
        break;
      case PLAY_CODE.freeThrowMissed:
        p.fta += 1;
        break;
      case PLAY_CODE.offensiveRebound:
        p.oreb += 1;
        break;
      case PLAY_CODE.defensiveRebound:
        p.dreb += 1;
        break;
      case PLAY_CODE.turnover:
        p.tov += 1;
        if (second >= 0) line(second).stl += 1;
        break;
      case PLAY_CODE.shootingFoul:
      case PLAY_CODE.personalFoul:
      case PLAY_CODE.offensiveFoul:
        p.pf += 1;
        break;
      default:
        break;
    }
  }
  return lines;
}

function ownerGame(seed: number) {
  const { state: base, teamIds } = bootstrapped(`pbp_owner_${seed}`);
  const game = scheduled(base, `game_pbp_${seed}`, teamIds[0]!, teamIds[1]!);
  const state = withGames(base, [game]);
  return { state, game, ownerTeamId: teamIds[0]! };
}

describe("play-by-play recording", () => {
  it("does not change the simulation result or RNG stream", () => {
    const { state, game, ownerTeamId } = ownerGame(1);
    const rngA = createTestRng(21);
    const rngB = createTestRng(21);
    const recorded = simulateScheduledGame(state, game, rngA, { ownerTeamId });
    const plain = simulateScheduledGame(state, game, rngB);

    expect(recorded.playByPlay).not.toBeNull();
    expect(plain.playByPlay).toBeNull();
    expect(recorded.finalGame).toEqual(plain.finalGame);
    expect(rngA.getState()).toBe(rngB.getState());
  });

  it("replays exactly to the final score, period scores and every box line", () => {
    for (const seed of [2, 3, 4]) {
      const { state, game, ownerTeamId } = ownerGame(seed);
      const { finalGame, playByPlay } = simulateScheduledGame(
        state,
        game,
        createTestRng(seed * 7),
        { ownerTeamId },
      );
      const log = playByPlay!;

      const score = [0, 0];
      const periods = finalGame.periodScores.map(() => [0, 0]);
      const pointsFor = (code: number) =>
        code === PLAY_CODE.twoMade
          ? 2
          : code === PLAY_CODE.threeMade
            ? 3
            : code === PLAY_CODE.freeThrowMade
              ? 1
              : 0;
      for (let i = 0; i < log.code.length; i += 1) {
        const pts = pointsFor(log.code[i]!);
        score[log.side[i]!]! += pts;
        periods[log.period[i]! - 1]![log.side[i]!]! += pts;
      }
      expect(score).toEqual([finalGame.score.home, finalGame.score.away]);
      expect(periods).toEqual(
        finalGame.periodScores.map((period) => [period.home, period.away]),
      );

      const lines = replayLines(log);
      for (const row of finalGame.playerStats) {
        const replayed = lines.get(row.playerId);
        expect({
          id: row.playerId,
          points: replayed?.points ?? 0,
          fgm: replayed?.fgm ?? 0,
          fga: replayed?.fga ?? 0,
          tpm: replayed?.tpm ?? 0,
          tpa: replayed?.tpa ?? 0,
          ftm: replayed?.ftm ?? 0,
          fta: replayed?.fta ?? 0,
          oreb: replayed?.oreb ?? 0,
          dreb: replayed?.dreb ?? 0,
          ast: replayed?.ast ?? 0,
          stl: replayed?.stl ?? 0,
          blk: replayed?.blk ?? 0,
          tov: replayed?.tov ?? 0,
          pf: replayed?.pf ?? 0,
        }).toEqual({
          id: row.playerId,
          points: row.points,
          fgm: row.fieldGoalsMade,
          fga: row.fieldGoalsAttempted,
          tpm: row.threePointersMade,
          tpa: row.threePointersAttempted,
          ftm: row.freeThrowsMade,
          fta: row.freeThrowsAttempted,
          oreb: row.offensiveRebounds,
          dreb: row.defensiveRebounds,
          ast: row.assists,
          stl: row.steals,
          blk: row.blocks,
          tov: row.turnovers,
          pf: row.fouls,
        });
      }
    }
  });

  it("links assists to made shots and sides to the acting player's team", () => {
    const { state, game, ownerTeamId } = ownerGame(5);
    const { finalGame, playByPlay } = simulateScheduledGame(
      state,
      game,
      createTestRng(55),
      { ownerTeamId },
    );
    const log = playByPlay!;
    const teamOf = new Map(
      finalGame.playerStats.map((row) => [row.playerId, row.teamId]),
    );
    let assisted = 0;
    for (let i = 0; i < log.code.length; i += 1) {
      const actor = log.players[log.player[i]!]!;
      const expectedTeam =
        log.side[i] === 0 ? finalGame.homeTeamId : finalGame.awayTeamId;
      expect(teamOf.get(actor)).toBe(expectedTeam);
      const code = log.code[i]!;
      if (
        (code === PLAY_CODE.twoMade || code === PLAY_CODE.threeMade) &&
        log.player2[i]! >= 0
      ) {
        assisted += 1;
        // Assister is a teammate of the shooter.
        expect(teamOf.get(log.players[log.player2[i]!]!)).toBe(expectedTeam);
      }
    }
    const totalAssists = finalGame.playerStats.reduce(
      (sum, row) => sum + row.assists,
      0,
    );
    expect(assisted).toBe(totalAssists);
    expect(assisted).toBeGreaterThan(0);
  });

  it("orders periods, clocks and substitutions consistently", () => {
    const { state, game, ownerTeamId } = ownerGame(6);
    const { finalGame, playByPlay } = simulateScheduledGame(
      state,
      game,
      createTestRng(66),
      { ownerTeamId },
    );
    const log = playByPlay!;
    expect(() =>
      assertPlayByPlayLog(log, "log", {
        ...LIMITS,
        periodCount: finalGame.periodScores.length,
      }),
    ).not.toThrow();

    // Clock never runs backwards within a period.
    for (let i = 1; i < log.code.length; i += 1) {
      if (log.period[i] === log.period[i - 1]) {
        expect(log.clock[i]!).toBeLessThanOrEqual(log.clock[i - 1]!);
      }
    }

    // Possessions share one start clock.
    const clockByPoss = new Map<string, number>();
    for (let i = 0; i < log.code.length; i += 1) {
      if (log.code[i] === PLAY_CODE.substitution) continue;
      const key = `${log.period[i]}:${log.poss[i]}`;
      const seen = clockByPoss.get(key);
      if (seen === undefined) clockByPoss.set(key, log.clock[i]!);
      else expect(log.clock[i]).toBe(seen);
    }

    // Rotation runs on a bootstrapped state, so substitutions are recorded,
    // with the player coming in in player2 on the same side.
    const subs = log.code
      .map((code, i) => ({ code, i }))
      .filter(({ code }) => code === PLAY_CODE.substitution);
    expect(subs.length).toBeGreaterThan(0);
    const teamOf = new Map(
      finalGame.playerStats.map((row) => [row.playerId, row.teamId]),
    );
    for (const { i } of subs) {
      const out = log.players[log.player[i]!]!;
      const into = log.players[log.player2[i]!]!;
      expect(teamOf.get(out)).toBe(teamOf.get(into));
    }
    // Trace also holds one starting_lineup entry per team (no in/out ids).
    const traceSubs = finalGame.rotationMeta!.trace.filter(
      (entry) => entry.playerOutId != null && entry.playerInId != null,
    );
    expect(subs.length).toBe(traceSubs.length);
    expect(subs.map(({ i }) => [log.period[i], log.clock[i]])).toEqual(
      traceSubs.map((entry) => [entry.periodNumber, entry.secondsRemaining]),
    );
  });

  it("reconstructs foul-outs from foul plays", () => {
    const { state, game, ownerTeamId } = ownerGame(7);
    const { finalGame, playByPlay } = simulateScheduledGame(
      state,
      game,
      createTestRng(77),
      { ownerTeamId },
    );
    const lines = replayLines(playByPlay!);
    const fouledOutFromLog = [...lines.entries()]
      .filter(([, line]) => line.pf >= 6)
      .map(([id]) => id)
      .sort();
    const fouledOutFromBox = finalGame.playerStats
      .filter((row) => row.fouls >= 6)
      .map((row) => row.playerId)
      .sort();
    expect(fouledOutFromLog).toEqual(fouledOutFromBox);
  });

  it("stores logs only for owner games and none for CPU box-score games", () => {
    const { state: base, teamIds } = bootstrapped("pbp_date");
    const owner = teamIds[0]!;
    const ownerMatch = scheduled(base, "game_owner", owner, teamIds[1]!);
    const cpuMatch = scheduled(base, "game_cpu", teamIds[2]!, teamIds[3]!);
    const state = withGames(base, [ownerMatch, cpuMatch]);

    const result = simulateGamesForDate(
      state,
      createTestRng(31),
      state.world.calendar.currentDate,
      undefined,
      { fidelity: "box_score", ownerTeamId: owner },
    );
    expect(Object.keys(result.state.competition.playByPlay)).toEqual([
      "game_owner",
    ]);
    for (const game of Object.values(result.state.competition.games)) {
      expect(game.status).toBe("final");
      expect(game.events).toEqual([]);
    }
  });

  it("records nothing when no owner team is given", () => {
    const { state: base, teamIds } = bootstrapped("pbp_none");
    const match = scheduled(base, "game_x", teamIds[0]!, teamIds[1]!);
    const state = withGames(base, [match]);
    const result = simulateGamesForDate(
      state,
      createTestRng(32),
      state.world.calendar.currentDate,
    );
    expect(result.state.competition.playByPlay).toEqual({});
  });

  it("clears every log when a new season starts", () => {
    const { state: base, teamIds } = bootstrapped("pbp_rollover");
    const match = scheduled(base, "game_r", teamIds[0]!, teamIds[1]!);
    const played = simulateGamesForDate(
      withGames(base, [match]),
      createTestRng(33),
      base.world.calendar.currentDate,
      undefined,
      { ownerTeamId: teamIds[0]! },
    ).state;
    expect(Object.keys(played.competition.playByPlay)).toHaveLength(1);

    const next = initializeNewSeason(played, createTestRng(34)).state;
    expect(next.competition.playByPlay).toEqual({});
    expect(next.competition.games).toEqual({});
  });
});

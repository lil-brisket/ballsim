import { describe, expect, it } from "vitest";
import type { PlayerSeasonRecord } from "@/domain/entities/player-history";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { validateGameState } from "@/persistence/validate-game-state";
import type { GameState } from "@/state/game-state";
import { toRecordBookView } from "@/state/legacy-selectors";
import {
  teamJerseyNumbers,
  reconcileJerseyNumbers,
} from "@/systems/jersey-numbers";
import {
  careerSummary,
  getRetireNumberBlockReason,
  HALL_OF_FAME_SCORE,
  HALL_OF_FAME_WAIT_SEASONS,
  processHallOfFameInductions,
  retireJerseyNumber,
} from "@/systems/legacy";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

function league(): GameState {
  const base = createTestGameState({ saveId: "legacy" });
  return bootstrapWorld(base, createSeededRng(base.meta.rngState)).state;
}

function line(points: number, games = 70) {
  return {
    games,
    minutes: games * 34,
    points,
    rebounds: games * 6,
    assists: games * 4,
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

/** Retire a player after `seasons` seasons with `teamId` scoring `ppg`. */
function retiredGreat(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
  seasons: number,
  ppg: number,
  lastSeasonYear: number,
): GameState {
  const records = Array.from({ length: seasons }, (_, i) => ({
    seasonYear: lastSeasonYear - seasons + 1 + i,
    attributes: state.world.players[playerId]!.attributes,
    contractSnapshot: { contractId: null, salary: null, teamId },
    competition: {
      regular: line(ppg * 70),
      playoffs: line(0, 0),
      development: line(0, 0),
      combined: line(ppg * 70),
    },
  })) as unknown as PlayerSeasonRecord[];
  const player = state.world.players[playerId]!;
  const team = state.world.teams[teamId]!;
  return {
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
      playerHistory: {
        ...state.business.playerHistory,
        [playerId]: {
          playerId,
          trackingStartedSeasonYear: records[0]!.seasonYear,
          seasons: records,
        },
      },
    },
  };
}

describe("Hall of Fame", () => {
  it("inducts a great after the waiting period, once", () => {
    let state = league();
    const teamId = state.user.activeOwnerTeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    const year = state.competition.season.year;
    state = retiredGreat(
      state,
      playerId,
      teamId,
      12,
      24,
      year - HALL_OF_FAME_WAIT_SEASONS,
    );
    expect(careerSummary(state, playerId).score).toBeGreaterThanOrEqual(
      HALL_OF_FAME_SCORE,
    );
    const first = processHallOfFameInductions(state);
    expect(
      first.state.business.hallOfFame.inductees.map((i) => i.playerId),
    ).toContain(playerId);
    expect(first.events.some((e) => e.type === "HallOfFameInducted")).toBe(
      true,
    );
    const again = processHallOfFameInductions(first.state);
    expect(again.state).toBe(first.state);
    expect(() => validateGameState(first.state)).not.toThrow();
  });

  it("waits until enough seasons have passed and needs a big career", () => {
    const base = league();
    const teamId = base.user.activeOwnerTeamId;
    const playerId = base.world.teams[teamId]!.roster[0]!;
    const year = base.competition.season.year;
    const tooSoon = retiredGreat(base, playerId, teamId, 12, 24, year - 1);
    expect(
      processHallOfFameInductions(tooSoon).state.business.hallOfFame.inductees,
    ).toEqual([]);
    const journeyman = retiredGreat(base, playerId, teamId, 8, 6, year - 5);
    expect(
      processHallOfFameInductions(journeyman).state.business.hallOfFame
        .inductees,
    ).toEqual([]);
  });
});

describe("retired numbers", () => {
  it("are never issued again by that franchise", () => {
    let state = league();
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]!.roster;
    const legendId = roster[0]!;
    const number = state.world.players[legendId]!.jerseyNumber;
    state = retiredGreat(
      state,
      legendId,
      teamId,
      5,
      15,
      state.competition.season.year - 1,
    );
    expect(getRetireNumberBlockReason(state, legendId, teamId)).toBeNull();
    state = retireJerseyNumber(state, legendId, teamId).state;
    expect(state.world.retiredNumbers[teamId]!.map((r) => r.number)).toEqual([
      number,
    ]);
    // A current player who wants that number cannot have it.
    const wanter = roster[1]!;
    state = {
      ...state,
      world: {
        ...state.world,
        players: {
          ...state.world.players,
          [wanter]: {
            ...state.world.players[wanter]!,
            jerseyNumber: number,
            jerseyTeamId: undefined,
          },
        },
      },
    };
    const numbers = teamJerseyNumbers(state.world, teamId);
    expect([...numbers.values()]).not.toContain(number);
    const reconciled = reconcileJerseyNumbers(state);
    expect(reconciled.world.players[wanter]!.jerseyNumber).not.toBe(number);
    expect(getRetireNumberBlockReason(reconciled, legendId, teamId)).toMatch(
      /already retired/,
    );
    expect(() => validateGameState(reconciled)).not.toThrow();
  });

  it("need a retired player with three seasons on the team", () => {
    const state = league();
    const teamId = state.user.activeOwnerTeamId;
    const active = state.world.teams[teamId]!.roster[0]!;
    expect(getRetireNumberBlockReason(state, active, teamId)).toMatch(/career/);
    const shortStint = retiredGreat(
      state,
      active,
      teamId,
      2,
      20,
      state.competition.season.year - 1,
    );
    expect(getRetireNumberBlockReason(shortStint, active, teamId)).toMatch(
      /3 seasons/,
    );
  });
});

describe("record book", () => {
  it("lists the best archived single game", () => {
    const state = league();
    const teamId = state.user.activeOwnerTeamId;
    const playerId = state.world.teams[teamId]!.roster[0]!;
    const archived = {
      id: "game_record",
      seasonId: state.competition.season.id,
      competitionType: "regular_season",
      homeTeamId: teamId,
      awayTeamId: Object.keys(state.world.teams).find((id) => id !== teamId),
      date: "2026-11-01",
      status: "final",
      score: { home: 120, away: 100 },
      periodScores: [],
      events: [],
      playerStats: [
        {
          playerId,
          teamId,
          firstName: "Big",
          lastName: "Night",
          minutes: 40,
          points: 61,
          rebounds: 10,
          offensiveRebounds: 2,
          defensiveRebounds: 8,
          assists: 5,
          steals: 1,
          blocks: 1,
          turnovers: 2,
          fouls: 2,
        },
      ],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    };
    const withGame = {
      ...state,
      business: {
        ...state.business,
        gameArchive: { game_record: archived },
      },
    } as unknown as GameState;
    const view = toRecordBookView(withGame);
    const points = view.league.find((t) => t.stat === "points")!;
    expect(points.single[0]).toMatchObject({ playerId, value: 61 });
    const franchise = view.franchise.find((t) => t.stat === "points")!;
    expect(franchise.single[0]?.value).toBe(61);
  });
});

import { describe, expect, it } from "vitest";
import type {
  PlayoffSeries,
  PlayoffTournament,
} from "@/domain/entities/playoffs";
import {
  asPlayoffSeriesId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import { createTestGameState } from "../factories/game-state";
import {
  appendAllFranchiseSeasonRecords,
  appendFranchiseSeasonRecord,
  derivePlayoffResults,
  eliminationSnapshotForRound,
} from "@/systems/franchise-history";
import type { GameState } from "@/state/game-state";

function team(n: number): TeamId {
  return asTeamId(`team_${n}`);
}

function series(input: {
  id: string;
  round: number;
  higher: TeamId;
  lower: TeamId;
  winner: TeamId;
}): PlayoffSeries {
  return {
    id: asPlayoffSeriesId(input.id),
    round: input.round,
    slot: 0,
    higherSeed: null,
    lowerSeed: null,
    higherSeedTeamId: input.higher,
    lowerSeedTeamId: input.lower,
    wins: {
      [input.winner]: 4,
      [input.higher === input.winner ? input.lower : input.higher]: 0,
    },
    gameIds: [],
    status: "complete",
    winnerTeamId: input.winner,
  };
}

function withTournament(
  state: GameState,
  tournament: PlayoffTournament,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      playoffs: tournament,
    },
  };
}

describe("eliminationSnapshotForRound", () => {
  it("maps 8-team rounds to history snapshots", () => {
    // 8 teams: rounds 0..2, final round 2.
    expect(eliminationSnapshotForRound(0, 2)).toBe("first_round");
    expect(eliminationSnapshotForRound(1, 2)).toBe("conference_finals");
    expect(eliminationSnapshotForRound(2, 2)).toBe("finals");
  });

  it("maps 16-team rounds to history snapshots", () => {
    // 16 teams: rounds 0..3, final round 3.
    expect(eliminationSnapshotForRound(0, 3)).toBe("first_round");
    expect(eliminationSnapshotForRound(1, 3)).toBe("second_round");
    expect(eliminationSnapshotForRound(2, 3)).toBe("conference_finals");
    expect(eliminationSnapshotForRound(3, 3)).toBe("finals");
  });

  it("counts back from the final for 12-team brackets", () => {
    // 12 teams: rounds 0..3.
    expect(eliminationSnapshotForRound(0, 3)).toBe("first_round");
    expect(eliminationSnapshotForRound(1, 3)).toBe("second_round");
    expect(eliminationSnapshotForRound(2, 3)).toBe("conference_finals");
  });

  it("maps two-conference brackets (the Finals is the only cross round)", () => {
    // k=8: rounds 0..3 (round 3 = Finals).
    expect(eliminationSnapshotForRound(0, 3, 1)).toBe("first_round");
    expect(eliminationSnapshotForRound(1, 3, 1)).toBe("second_round");
    expect(eliminationSnapshotForRound(2, 3, 1)).toBe("conference_finals");
    expect(eliminationSnapshotForRound(3, 3, 1)).toBe("finals");
    // k=2: round 0 is already the conference finals.
    expect(eliminationSnapshotForRound(0, 1, 1)).toBe("conference_finals");
    // k=4: round 0 is the first round, round 1 the conference finals.
    expect(eliminationSnapshotForRound(0, 2, 1)).toBe("first_round");
    expect(eliminationSnapshotForRound(1, 2, 1)).toBe("conference_finals");
  });

  it("maps four-conference brackets (a semifinal loss is conference_finals)", () => {
    // k=4: rounds 0..3 (round 2 = Semifinals, round 3 = Finals).
    expect(eliminationSnapshotForRound(0, 3, 2)).toBe("first_round");
    expect(eliminationSnapshotForRound(1, 3, 2)).toBe("conference_finals");
    expect(eliminationSnapshotForRound(2, 3, 2)).toBe("conference_finals");
    expect(eliminationSnapshotForRound(3, 3, 2)).toBe("finals");
    // k=8: rounds 0..4.
    expect(eliminationSnapshotForRound(1, 4, 2)).toBe("second_round");
  });
});

describe("derivePlayoffResults", () => {
  it("defaults qualifiers to first_round when no series completed", () => {
    const state = withTournament(createTestGameState({ saveId: "po_empty" }), {
      status: "in_progress",
      fieldSize: 8,
      qualifiedTeams: Array.from({ length: 8 }, (_, i) => ({
        teamId: team(i + 1),
        seed: i + 1,
      })),
      series: [],
    });
    const results = derivePlayoffResults(state);
    expect(results["team_1"]).toBe("first_round");
    expect(results["team_8"]).toBe("first_round");
    expect(results["team_99"]).toBeUndefined();
  });

  it("records 8-team elimination depth from completed series", () => {
    const state = withTournament(createTestGameState({ saveId: "po_8" }), {
      status: "complete",
      fieldSize: 8,
      qualifiedTeams: Array.from({ length: 8 }, (_, i) => ({
        teamId: team(i + 1),
        seed: i + 1,
      })),
      series: [
        series({
          id: "r0a",
          round: 0,
          higher: team(1),
          lower: team(8),
          winner: team(1),
        }),
        series({
          id: "r0b",
          round: 0,
          higher: team(4),
          lower: team(5),
          winner: team(4),
        }),
        series({
          id: "r0c",
          round: 0,
          higher: team(2),
          lower: team(7),
          winner: team(2),
        }),
        series({
          id: "r0d",
          round: 0,
          higher: team(3),
          lower: team(6),
          winner: team(3),
        }),
        series({
          id: "r1a",
          round: 1,
          higher: team(1),
          lower: team(4),
          winner: team(1),
        }),
        series({
          id: "r1b",
          round: 1,
          higher: team(2),
          lower: team(3),
          winner: team(2),
        }),
        series({
          id: "r2",
          round: 2,
          higher: team(1),
          lower: team(2),
          winner: team(1),
        }),
      ],
      championTeamId: team(1),
    });

    const results = derivePlayoffResults(state);
    expect(results["team_1"]).toBe("champion");
    expect(results["team_2"]).toBe("finals");
    expect(results["team_4"]).toBe("conference_finals");
    expect(results["team_3"]).toBe("conference_finals");
    expect(results["team_8"]).toBe("first_round");
    expect(results["team_5"]).toBe("first_round");
  });

  it("maps 16-team quarterfinal losses to second_round", () => {
    const state = withTournament(createTestGameState({ saveId: "po_16" }), {
      status: "complete",
      fieldSize: 16,
      qualifiedTeams: Array.from({ length: 16 }, (_, i) => ({
        teamId: team(i + 1),
        seed: i + 1,
      })),
      series: [
        series({
          id: "r0",
          round: 0,
          higher: team(1),
          lower: team(16),
          winner: team(1),
        }),
        series({
          id: "r1",
          round: 1,
          higher: team(1),
          lower: team(8),
          winner: team(1),
        }),
      ],
      championTeamId: team(1),
    });

    const results = derivePlayoffResults(state);
    expect(results["team_16"]).toBe("first_round");
    expect(results["team_8"]).toBe("second_round");
    expect(results["team_1"]).toBe("champion");
  });
});

describe("appendFranchiseSeasonRecord", () => {
  it("captures finalized fields including attendance from attendanceByYear", () => {
    let state = createTestGameState({ saveId: "fh_append" });
    const teamId = state.user.activeOwnerTeamId;
    const year = state.competition.season.year;
    state = {
      ...state,
      competition: {
        ...state.competition,
        standings: {
          byTeamId: {
            ...state.competition.standings.byTeamId,
            [teamId]: {
              ...state.competition.standings.byTeamId[teamId]!,
              wins: 48,
              losses: 34,
            },
          },
        },
        playoffs: {
          ...state.competition.playoffs,
          status: "complete",
          championTeamId: teamId,
          qualifiedTeams: [{ teamId, seed: 1 }],
        },
      },
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId]!,
            attendanceByYear: { [String(year)]: 900_000 },
          },
        },
        franchiseOps: {
          ...state.business.franchiseOps,
          [teamId]: {
            ...state.business.franchiseOps[teamId]!,
            fanSentiment: 72,
          },
        },
      },
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            reputation: 68,
          },
        },
      },
    };

    const once = appendAllFranchiseSeasonRecords(state);
    const seasons = once.state.business.franchiseHistory[teamId]!.seasons;
    expect(seasons).toHaveLength(1);
    const record = seasons[0]!;
    expect(record.wins).toBe(48);
    expect(record.losses).toBe(34);
    expect(record.playoffResult).toBe("champion");
    expect(record.championship).toBe(true);
    expect(record.attendance).toBe(900_000);
    expect(record.fanSentiment).toBe(72);
    expect(record.reputation).toBe(68);
    expect(record.franchiseValue).toBeGreaterThan(0);
    expect(typeof record.revenue).toBe("number");

    const twice = appendAllFranchiseSeasonRecords(once.state);
    expect(twice.state.business.franchiseHistory[teamId]!.seasons).toHaveLength(
      1,
    );

    const nextYear = year + 1;
    let advanced = {
      ...twice.state,
      competition: {
        ...twice.state.competition,
        season: {
          ...twice.state.competition.season,
          id: asSeasonId(`season_${nextYear}`),
          year: nextYear,
        },
        standings: {
          byTeamId: {
            ...twice.state.competition.standings.byTeamId,
            [teamId]: {
              ...twice.state.competition.standings.byTeamId[teamId]!,
              wins: 30,
              losses: 52,
            },
          },
        },
        playoffs: {
          ...twice.state.competition.playoffs,
          status: "complete" as const,
          championTeamId: null,
          qualifiedTeams: [],
        },
      },
      business: {
        ...twice.state.business,
        finances: {
          ...twice.state.business.finances,
          [teamId]: {
            ...twice.state.business.finances[teamId]!,
            attendanceByYear: {
              ...twice.state.business.finances[teamId]!.attendanceByYear,
              [String(nextYear)]: 1_100_000,
            },
          },
        },
      },
    } as unknown as GameState;
    advanced = appendAllFranchiseSeasonRecords(advanced).state;
    const all = advanced.business.franchiseHistory[teamId]!.seasons;
    expect(all).toHaveLength(2);
    expect(all[0]!.attendance).toBe(900_000);
    expect(all[0]!.wins).toBe(48);
    expect(all[1]!.attendance).toBe(1_100_000);
    expect(all[1]!.wins).toBe(30);
  });

  it("stores null attendance when accumulator key is missing", () => {
    const state = createTestGameState({ saveId: "fh_null_att" });
    const teamId = state.user.activeOwnerTeamId;
    const result = appendFranchiseSeasonRecord(state, { teamId });
    expect(
      result.state.business.franchiseHistory[teamId]!.seasons[0]!.attendance,
    ).toBeNull();
  });
});

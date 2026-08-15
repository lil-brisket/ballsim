import type { GameId, PlayoffSeriesId, TeamId } from "@/domain/ids";

export type PlayoffTournamentStatus =
  | "not_started"
  | "in_progress"
  | "complete";

export type PlayoffSeriesStatus = "pending" | "active" | "complete";

export type PlayoffSeed = {
  teamId: TeamId;
  seed: number;
};

/**
 * One best-of-N series in a single-elimination bracket.
 * `round` is 0-based (opening round = 0; final = log2(fieldSize) - 1).
 * `higherSeed` / `lowerSeed` are original regular-season seeds once both
 * participants are known; they do not by themselves assign home court.
 */
export type PlayoffSeries = {
  id: PlayoffSeriesId;
  round: number;
  slot: number;
  higherSeed: number | null;
  lowerSeed: number | null;
  higherSeedTeamId: TeamId | null;
  lowerSeedTeamId: TeamId | null;
  /**
   * Feeders that fill this series. Length 1 (bye + feeder) or 2 (two winners).
   * Opening-round series omit this.
   */
  feederSeriesIds?: PlayoffSeriesId[];
  /**
   * Bye participant already known for this series (no fake opening series).
   * Combined with a single feeder when that feeder completes.
   */
  byeParticipant?: {
    seed: number;
    teamId: TeamId;
  };
  wins: Record<string, number>;
  gameIds: GameId[];
  status: PlayoffSeriesStatus;
  winnerTeamId?: TeamId;
};

export type PlayoffTournament = {
  status: PlayoffTournamentStatus;
  /** Number of teams in the bracket (0 when not started / no playoffs). */
  fieldSize: number;
  qualifiedTeams: PlayoffSeed[];
  series: PlayoffSeries[];
  championTeamId?: TeamId;
};

/** Empty tournament for new saves and schema migrations. */
export function createEmptyPlayoffTournament(): PlayoffTournament {
  return {
    status: "not_started",
    fieldSize: 0,
    qualifiedTeams: [],
    series: [],
  };
}

/**
 * Display label for a round index given field size.
 * Simulation uses numeric rounds only; this is metadata for tests/UI.
 */
export function playoffRoundLabel(round: number, fieldSize: number): string {
  if (
    !Number.isInteger(round) ||
    round < 0 ||
    !Number.isInteger(fieldSize) ||
    fieldSize < 2 ||
    (fieldSize & (fieldSize - 1)) !== 0
  ) {
    throw new Error(
      `playoffRoundLabel requires round >= 0 and power-of-2 fieldSize; got round=${round}, fieldSize=${fieldSize}.`,
    );
  }
  const teamsInRound = fieldSize / 2 ** round;
  if (!Number.isInteger(teamsInRound) || teamsInRound < 2) {
    throw new Error(
      `playoffRoundLabel: round ${round} is past the final for fieldSize ${fieldSize}.`,
    );
  }
  if (teamsInRound === 2) {
    return "final";
  }
  if (teamsInRound === 4) {
    return "semifinal";
  }
  if (teamsInRound === 8) {
    return "quarterfinal";
  }
  return `round_of_${teamsInRound}`;
}

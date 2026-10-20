/**
 * Conference-bracket helpers derived from saved playoff data.
 *
 * Saved tournaments carry no format flag, so conference structure is inferred
 * from which teams can reach each series (participants, bye participant and
 * feeders, recursively). Old league-wide brackets mix conferences before the
 * Finals and are reported as non-conference brackets.
 */

import type {
  PlayoffSeries,
  PlayoffTournament,
} from "@/domain/entities/playoffs";
import type { ConferenceId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type PlayoffBracketAnalysis = {
  /** True when every pre-final conference round stays inside one conference. */
  isConferenceBracket: boolean;
  /** Distinct conferences among qualifiers (0 when unknown). */
  conferenceCount: number;
  /** Highest round index in the tournament (-1 when it has no series). */
  finalRound: number;
  /** Cross-conference rounds at the end: 1 (two conferences) or 2 (four). */
  crossConferenceRounds: number;
  /** Single reachable conference per series id; null when cross-conference. */
  conferenceBySeriesId: Map<string, ConferenceId | null>;
};

function conferenceOfTeam(
  state: GameState,
  teamId: TeamId,
): ConferenceId | undefined {
  return state.world.teams[teamId]?.conferenceId;
}

export function analyzePlayoffBracket(
  tournament: PlayoffTournament,
  state: GameState,
): PlayoffBracketAnalysis {
  const seriesById = new Map<string, PlayoffSeries>(
    tournament.series.map((s) => [s.id, s]),
  );
  const reachMemo = new Map<string, Set<ConferenceId>>();
  const reach = (series: PlayoffSeries, visiting: Set<string>) => {
    const cached = reachMemo.get(series.id);
    if (cached) return cached;
    const confs = new Set<ConferenceId>();
    if (visiting.has(series.id)) return confs;
    visiting.add(series.id);
    const teamIds = [
      series.higherSeedTeamId,
      series.lowerSeedTeamId,
      series.byeParticipant?.teamId ?? null,
    ];
    for (const teamId of teamIds) {
      if (!teamId) continue;
      const conf = conferenceOfTeam(state, teamId);
      if (conf) confs.add(conf);
    }
    for (const feederId of series.feederSeriesIds ?? []) {
      const feeder = seriesById.get(feederId);
      if (!feeder) continue;
      for (const conf of reach(feeder, visiting)) confs.add(conf);
    }
    visiting.delete(series.id);
    reachMemo.set(series.id, confs);
    return confs;
  };

  const conferenceBySeriesId = new Map<string, ConferenceId | null>();
  for (const series of tournament.series) {
    const confs = reach(series, new Set());
    conferenceBySeriesId.set(
      series.id,
      confs.size === 1 ? ([...confs][0] ?? null) : null,
    );
  }

  const qualifierConferences = new Set<ConferenceId>();
  for (const entry of tournament.qualifiedTeams) {
    const conf = conferenceOfTeam(state, entry.teamId);
    if (conf) qualifierConferences.add(conf);
  }
  const conferenceCount = qualifierConferences.size;
  const finalRound = tournament.series.reduce(
    (max, s) => Math.max(max, s.round),
    -1,
  );
  const crossConferenceRounds =
    conferenceCount === 2 ? 1 : conferenceCount === 4 ? 2 : 0;

  let isConferenceBracket =
    crossConferenceRounds > 0 && finalRound + 1 >= crossConferenceRounds;
  if (isConferenceBracket) {
    const lastConferenceRound = finalRound - crossConferenceRounds;
    for (const series of tournament.series) {
      if (
        series.round <= lastConferenceRound &&
        conferenceBySeriesId.get(series.id) == null
      ) {
        isConferenceBracket = false;
        break;
      }
    }
  }

  return {
    isConferenceBracket,
    conferenceCount,
    finalRound,
    crossConferenceRounds,
    conferenceBySeriesId,
  };
}

/** True for NBA-style conference brackets; false for league-wide (old) ones. */
export function isConferenceBracket(
  tournament: PlayoffTournament,
  state: GameState,
): boolean {
  return analyzePlayoffBracket(tournament, state).isConferenceBracket;
}

/**
 * The single conference whose teams can reach this series, or null for
 * cross-conference (Semifinals / Finals) and unknown series.
 */
export function seriesConferenceId(
  series: PlayoffSeries,
  tournament: PlayoffTournament,
  state: GameState,
): ConferenceId | null {
  return (
    analyzePlayoffBracket(tournament, state).conferenceBySeriesId.get(
      series.id,
    ) ?? null
  );
}

/**
 * Seed within each qualifier's conference (1 = best record in the
 * conference). League-wide brackets return the overall seed unchanged.
 */
export function conferenceSeedByTeam(state: GameState): Map<TeamId, number> {
  const tournament = state.competition.playoffs;
  const result = new Map<TeamId, number>();
  if (!isConferenceBracket(tournament, state)) {
    for (const entry of tournament.qualifiedTeams) {
      result.set(entry.teamId, entry.seed);
    }
    return result;
  }
  for (const entry of tournament.qualifiedTeams) {
    const conf = conferenceOfTeam(state, entry.teamId);
    const better = tournament.qualifiedTeams.filter(
      (other) =>
        other.seed < entry.seed &&
        conferenceOfTeam(state, other.teamId) === conf,
    ).length;
    result.set(entry.teamId, 1 + better);
  }
  return result;
}

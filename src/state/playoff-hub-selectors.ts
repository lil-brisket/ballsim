/**
 * Playoff Hub presentation — read-only bracket from competition.playoffs.
 * Canonical user playoff status owned here.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import type { Game } from "@/domain/entities/game";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import {
  playoffRoundLabel,
  type PlayoffSeries,
} from "@/domain/entities/playoffs";
import {
  analyzePlayoffBracket,
  conferenceSeedByTeam,
  type PlayoffBracketAnalysis,
} from "@/state/playoff-conference-view";

export type UserPlayoffStatus =
  "not_in_playoffs" | "in_playoffs" | "eliminated" | "advanced" | "champion";

export type PlayoffSeriesBye = {
  seed: number;
  teamId: string;
  teamName: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
};

export type PlayoffSeriesGameView = {
  gameId: string;
  /** 1-based position in the series. */
  number: number;
  date: string;
  homeAbbreviation: string;
  awayAbbreviation: string;
  homeScore: number | null;
  awayScore: number | null;
  final: boolean;
};

export type PlayoffSeriesView = {
  id: string;
  round: number;
  roundLabel: string;
  slot: number;
  status: string;
  /** Conference seed in conference brackets; overall seed otherwise. */
  higherSeed: number | null;
  lowerSeed: number | null;
  /** Original overall regular-season seed. */
  higherOverallSeed: number | null;
  lowerOverallSeed: number | null;
  /** Conference the series belongs to; null for cross-conference rounds. */
  conferenceId: string | null;
  conferenceName: string | null;
  higherSeedTeamId: string | null;
  lowerSeedTeamId: string | null;
  higherSeedTeamName: string | null;
  lowerSeedTeamName: string | null;
  higherWins: number;
  lowerWins: number;
  winnerTeamId: string | null;
  gameIds: string[];
  /** Series that feed this one; empty for opening-round series. */
  feederSeriesIds: string[];
  /** Team that skipped the opening round into this series, if any. */
  bye: PlayoffSeriesBye | null;
  higherSeedAbbreviation: string | null;
  lowerSeedAbbreviation: string | null;
  higherSeedBranding: TeamBrandingView | null;
  lowerSeedBranding: TeamBrandingView | null;
  /** The series' games in order; unknown games keep a row (null scores). */
  games: PlayoffSeriesGameView[];
  /** True when the active owner's team plays (or has the bye) in this series. */
  involvesUser: boolean;
};

export type PlayoffRoundView = {
  round: number;
  label: string;
  series: PlayoffSeriesView[];
};

/** One conference's sub-bracket (conference brackets only). */
export type PlayoffConferenceSectionView = {
  conferenceId: string;
  conferenceName: string;
  rounds: PlayoffRoundView[];
};

export type PlayoffHubView = {
  available: boolean;
  saveId: string;
  seasonYear: number;
  tournamentStatus: string;
  fieldSize: number;
  currentRoundLabel: string | null;
  userTeamId: string;
  userTeamName: string;
  userStatus: UserPlayoffStatus;
  championTeamId: string | null;
  championTeamName: string | null;
  /** Every round in order (conference and cross-conference). */
  rounds: PlayoffRoundView[];
  /** True when the bracket is split into conference sub-brackets. */
  isConferenceBracket: boolean;
  /** Conference sub-brackets, in qualification order (empty if league-wide). */
  conferenceSections: PlayoffConferenceSectionView[];
  /** Cross-conference rounds (Semifinals, Finals); empty if league-wide. */
  crossConferenceRounds: PlayoffRoundView[];
};

function teamName(state: GameState, teamId: string | null): string | null {
  if (!teamId) return null;
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

export function resolveUserPlayoffStatus(
  state: GameState,
  teamId: string,
): UserPlayoffStatus {
  const playoffs = state.competition.playoffs;
  if (playoffs.championTeamId === teamId) {
    return "champion";
  }
  const qualified = playoffs.qualifiedTeams.some((q) => q.teamId === teamId);
  if (!qualified) {
    return "not_in_playoffs";
  }
  if (playoffs.status === "not_started") {
    return "in_playoffs";
  }

  const teamSeries = playoffs.series.filter(
    (s) => s.higherSeedTeamId === teamId || s.lowerSeedTeamId === teamId,
  );
  const lostComplete = teamSeries.some(
    (s) =>
      s.status === "complete" &&
      s.winnerTeamId != null &&
      s.winnerTeamId !== teamId,
  );
  if (lostComplete) {
    return "eliminated";
  }

  const wonComplete = teamSeries.some(
    (s) => s.status === "complete" && s.winnerTeamId === teamId,
  );
  const stillActive = teamSeries.some((s) => s.status === "active");
  if (wonComplete && !stillActive && playoffs.status === "in_progress") {
    return "advanced";
  }
  return "in_playoffs";
}

/** Label for a conference-bracket round, counting back from the final. */
export function conferenceBracketRoundLabel(
  round: number,
  conferenceSpecific: boolean,
  bracket: Pick<PlayoffBracketAnalysis, "finalRound" | "crossConferenceRounds">,
): string {
  const fromFinal = bracket.finalRound - round;
  if (!conferenceSpecific) {
    return fromFinal === 0 ? "Finals" : "Semifinals";
  }
  const fromConferenceFinal = fromFinal - bracket.crossConferenceRounds;
  if (fromConferenceFinal <= 0) {
    return "Conference Finals";
  }
  if (fromConferenceFinal === 1 && round > 0) {
    return "Conference Semifinals";
  }
  return "First Round";
}

function teamAbbreviation(
  state: GameState,
  teamId: string | null,
): string | null {
  if (!teamId) return null;
  return state.world.teams[teamId]?.abbreviation ?? teamId;
}

function teamBranding(
  state: GameState,
  teamId: string | null,
): TeamBrandingView | null {
  if (!teamId) return null;
  return toBrandingView(state.world.teams[teamId]?.branding);
}

function toSeriesView(
  state: GameState,
  series: PlayoffSeries,
  fieldSize: number,
  bracket: PlayoffBracketAnalysis,
  seedByTeam: Map<string, number>,
  gamesById: { get(gameId: string): Game | undefined },
  userTeamId: string,
): PlayoffSeriesView {
  const conferenceId = bracket.isConferenceBracket
    ? (bracket.conferenceBySeriesId.get(series.id) ?? null)
    : null;
  let roundLabel = `Round ${series.round + 1}`;
  if (bracket.isConferenceBracket) {
    roundLabel = conferenceBracketRoundLabel(
      series.round,
      conferenceId != null,
      bracket,
    );
  } else {
    try {
      roundLabel = playoffRoundLabel(series.round, fieldSize).replaceAll(
        "_",
        " ",
      );
    } catch {
      // fieldSize may be invalid mid-migration — keep fallback label
    }
  }
  const higherId = series.higherSeedTeamId;
  const lowerId = series.lowerSeedTeamId;
  const confSeed = (teamId: string | null, fallback: number | null) =>
    teamId ? (seedByTeam.get(teamId) ?? fallback) : fallback;
  return {
    id: series.id,
    round: series.round,
    roundLabel,
    slot: series.slot,
    status: series.status,
    higherSeed: confSeed(higherId, series.higherSeed),
    lowerSeed: confSeed(lowerId, series.lowerSeed),
    higherOverallSeed: series.higherSeed,
    lowerOverallSeed: series.lowerSeed,
    conferenceId,
    conferenceName: conferenceId
      ? (state.world.conferences[conferenceId]?.name ?? conferenceId)
      : null,
    higherSeedTeamId: higherId,
    lowerSeedTeamId: lowerId,
    higherSeedTeamName: teamName(state, higherId),
    lowerSeedTeamName: teamName(state, lowerId),
    higherWins: higherId ? (series.wins[higherId] ?? 0) : 0,
    lowerWins: lowerId ? (series.wins[lowerId] ?? 0) : 0,
    winnerTeamId: series.winnerTeamId ?? null,
    gameIds: [...series.gameIds],
    feederSeriesIds: [...(series.feederSeriesIds ?? [])],
    bye: series.byeParticipant
      ? {
          seed:
            seedByTeam.get(series.byeParticipant.teamId) ??
            series.byeParticipant.seed,
          teamId: series.byeParticipant.teamId,
          teamName:
            teamName(state, series.byeParticipant.teamId) ??
            series.byeParticipant.teamId,
          abbreviation:
            teamAbbreviation(state, series.byeParticipant.teamId) ?? "",
          branding: teamBranding(state, series.byeParticipant.teamId),
        }
      : null,
    higherSeedAbbreviation: teamAbbreviation(state, higherId),
    lowerSeedAbbreviation: teamAbbreviation(state, lowerId),
    higherSeedBranding: teamBranding(state, higherId),
    lowerSeedBranding: teamBranding(state, lowerId),
    games: series.gameIds.map((gameId, index) => {
      const game = gamesById.get(gameId);
      const final = game?.status === "final";
      return {
        gameId,
        number: index + 1,
        date: game?.date ?? "",
        homeAbbreviation: game
          ? (teamAbbreviation(state, game.homeTeamId) ?? "")
          : "",
        awayAbbreviation: game
          ? (teamAbbreviation(state, game.awayTeamId) ?? "")
          : "",
        homeScore: game && final ? game.score.home : null,
        awayScore: game && final ? game.score.away : null,
        final,
      };
    }),
    involvesUser:
      higherId === userTeamId ||
      lowerId === userTeamId ||
      series.byeParticipant?.teamId === userTeamId,
  };
}

function groupRounds(seriesViews: PlayoffSeriesView[]): PlayoffRoundView[] {
  const roundMap = new Map<number, PlayoffSeriesView[]>();
  for (const series of seriesViews) {
    const list = roundMap.get(series.round) ?? [];
    list.push(series);
    roundMap.set(series.round, list);
  }
  return [...roundMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, series]) => ({
      round,
      label: series[0]?.roundLabel ?? `Round ${round + 1}`,
      series,
    }));
}

export function toPlayoffHubView(state: GameState): PlayoffHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const playoffs = state.competition.playoffs;
  const available = playoffs.status !== "not_started" && playoffs.fieldSize > 0;

  const bracket = analyzePlayoffBracket(playoffs, state);
  const seedByTeam = conferenceSeedByTeam(state);
  // Direct lookups: the archive can hold thousands of games.
  const gamesById = {
    get: (gameId: string): Game | undefined =>
      state.competition.games[gameId] ?? state.business.gameArchive[gameId],
  };
  const seriesViews = playoffs.series
    .map((s) =>
      toSeriesView(
        state,
        s,
        playoffs.fieldSize,
        bracket,
        seedByTeam,
        gamesById,
        teamId,
      ),
    )
    .sort((a, b) => a.round - b.round || a.slot - b.slot);

  const rounds = groupRounds(seriesViews);

  const conferenceSections: PlayoffConferenceSectionView[] = [];
  let crossConferenceRounds: PlayoffRoundView[] = [];
  if (bracket.isConferenceBracket) {
    const conferenceIds: string[] = [];
    for (const entry of playoffs.qualifiedTeams) {
      const conferenceId = state.world.teams[entry.teamId]?.conferenceId;
      if (conferenceId && !conferenceIds.includes(conferenceId)) {
        conferenceIds.push(conferenceId);
      }
    }
    const leagueOrder: string[] = [...state.world.league.conferenceIds];
    const orderOf = (id: string) => {
      const index = leagueOrder.indexOf(id);
      return index < 0 ? leagueOrder.length : index;
    };
    conferenceIds.sort((x, y) => orderOf(x) - orderOf(y));
    for (const conferenceId of conferenceIds) {
      const rounds = groupRounds(
        seriesViews.filter((s) => s.conferenceId === conferenceId),
      );
      // One qualifier per conference: no conference rounds to show.
      if (rounds.length === 0) continue;
      conferenceSections.push({
        conferenceId,
        conferenceName:
          state.world.conferences[conferenceId]?.name ?? conferenceId,
        rounds,
      });
    }
    crossConferenceRounds = groupRounds(
      seriesViews.filter((s) => s.conferenceId == null),
    );
  }

  const activeRound = seriesViews.find((s) => s.status === "active");
  const currentRoundLabel =
    activeRound?.roundLabel ??
    (playoffs.status === "complete" ? "Complete" : null);

  return {
    available,
    saveId,
    seasonYear: state.competition.season.year,
    tournamentStatus: playoffs.status,
    fieldSize: playoffs.fieldSize,
    currentRoundLabel,
    userTeamId: teamId,
    userTeamName: team ? `${team.city} ${team.name}` : "Team",
    userStatus: resolveUserPlayoffStatus(state, teamId),
    championTeamId: playoffs.championTeamId ?? null,
    championTeamName: teamName(state, playoffs.championTeamId ?? null),
    rounds: available ? rounds : [],
    isConferenceBracket: available && bracket.isConferenceBracket,
    conferenceSections: available ? conferenceSections : [],
    crossConferenceRounds: available ? crossConferenceRounds : [],
  };
}

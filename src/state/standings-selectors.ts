/**
 * Enriched standings presentation — centralized games-back + playoff cutoff.
 * Presentation-only; never mutates simulation state.
 */

import {
  createEmptyTeamStanding,
  type StandingStreak,
  type TeamStanding,
} from "@/domain/entities/standings";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import type {
  StandingsPageOptions,
  StandingsStatsMode,
  StandingsViewMode,
} from "@/state/standings-page-params";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import { compareStandings } from "@/systems/standings";
import type { PlayoffRaceStatus } from "@/systems/simulation/calendar-context";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

export type { StandingsPageOptions, StandingsStatsMode, StandingsViewMode };

export type PlayoffPositionLabel =
  | "clinched"
  | "playoff"
  | "play_in"
  | "bubble"
  | "eliminated"
  | "na";

export type StandingsRowEnriched = {
  teamId: string;
  abbreviation: string;
  city: string;
  name: string;
  wins: number;
  losses: number;
  winPercentage: number;
  streak: StandingStreak;
  conferenceId: string;
  conferenceName: string;
  divisionId: string;
  divisionName: string;
  conferenceRank: number;
  leagueRank: number;
  divisionRank: number;
  /** Games back vs conference leader when in conference context. */
  gamesBackConference: number;
  /** Games back vs league leader. */
  gamesBackLeague: number;
  /** Games back vs division leader. */
  gamesBackDivision: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  ppg: number | null;
  oppPpg: number | null;
  net: number | null;
  isUserTeam: boolean;
  playoffLabel: PlayoffPositionLabel;
  branding: TeamBrandingView | null;
};

export type StandingsGroup = {
  id: string;
  name: string;
  kind: StandingsViewMode;
  cutoffRank: number | null;
  rows: StandingsRowEnriched[];
};

export type StandingsPageView = {
  mode: "regular" | "playoffs" | "offseason";
  seasonYear: number;
  seasonPhase: string;
  fieldSize: number;
  view: StandingsViewMode;
  stats: StandingsStatsMode;
  divisionsEnabled: boolean;
  /** League-wide playoff field used for Overall cutoff / race / labels. */
  playoffTeamCount: number;
  /**
   * Per-conference cutoff for League Hub snapshot only.
   * Presentation-only — not used for qualification (`qualifyAndSeed` is league-wide).
   */
  cutoffPerConference: number;
  groups: StandingsGroup[];
  /** Flat league ranking (same rows, league order). */
  leagueRows: StandingsRowEnriched[];
  championTeamId: string | null;
  playoffStatus: string;
  userPlayoffRace: PlayoffRaceStatus;
  ownedTeamIds: string[];
};

export type MyTeamStandingsContext = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  conferenceRank: number;
  conferenceName: string;
  gamesBack: number;
  streakLabel: string | null;
  leagueLeader: { abbreviation: string; wins: number; losses: number };
  cutoffTeam: {
    abbreviation: string;
    wins: number;
    losses: number;
  } | null;
  playoffLabel: PlayoffPositionLabel;
  branding: TeamBrandingView | null;
};

export type PlayoffRaceEntry = {
  teamId: string;
  abbreviation: string;
  city: string;
  name: string;
  wins: number;
  losses: number;
  winPercentage: number;
  leagueRank: number;
  inField: boolean;
  isUserTeam: boolean;
  branding: TeamBrandingView | null;
};

export type PlayoffRaceView = {
  applicable: boolean;
  cutoffRank: number;
  playoffTeamCount: number;
  above: PlayoffRaceEntry[];
  below: PlayoffRaceEntry[];
};

const PLAYOFF_RACE_WINDOW = 4;
const BUBBLE_BAND = 4;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function gamesBack(leader: TeamStanding, team: TeamStanding): number {
  const raw =
    (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
  return round1(raw);
}

function streakLabel(streak: StandingStreak): string | null {
  if (streak.type == null || streak.count <= 0) {
    return null;
  }
  return `${streak.type}${streak.count}`;
}

function scoringRates(standing: TeamStanding): {
  gamesPlayed: number;
  ppg: number | null;
  oppPpg: number | null;
  net: number | null;
} {
  const gamesPlayed = standing.wins + standing.losses;
  if (gamesPlayed <= 0) {
    return { gamesPlayed: 0, ppg: null, oppPpg: null, net: null };
  }
  return {
    gamesPlayed,
    ppg: round1(standing.pointsFor / gamesPlayed),
    oppPpg: round1(standing.pointsAgainst / gamesPlayed),
    net: round1(standing.pointDifferential / gamesPlayed),
  };
}

/**
 * Playoff cutoff rank within a conference from league configuration.
 *
 * Presentation-only. Not used for qualification — `qualifyAndSeed` ranks
 * league-wide by `settings.playoffs.playoffTeams`. Kept for League Hub
 * snapshot consumers that still draw a conference-style line.
 */
export function playoffCutoffPerConference(state: GameState): number {
  const fieldSize = state.competition.playoffs.fieldSize;
  const conferenceCount = Math.max(
    1,
    Object.keys(state.world.conferences).length,
  );
  if (fieldSize >= 2) {
    return Math.max(1, Math.floor(fieldSize / conferenceCount));
  }
  // Fallback: half the teams in the largest conference, minimum 1
  const teamCounts = Object.values(state.world.conferences).map((c) => {
    let n = 0;
    for (const divId of c.divisionIds) {
      const div = state.world.divisions[divId];
      n += div?.teamIds.length ?? 0;
    }
    return n;
  });
  const max = Math.max(1, ...teamCounts, 1);
  return Math.max(1, Math.floor(max / 2));
}

/** League-wide playoff field for Overall cutoff, race, and row labels. */
export function resolvePlayoffTeamCount(state: GameState): number {
  const fieldSize = state.competition.playoffs.fieldSize;
  if (fieldSize >= 2) {
    return fieldSize;
  }
  const configured = state.settings.playoffs.playoffTeams;
  return Number.isFinite(configured) ? configured : 0;
}

export function isPlayoffCutoffVisible(
  playoffTeamCount: number,
  liveTeamCount: number,
): boolean {
  return playoffTeamCount >= 1 && playoffTeamCount < liveTeamCount;
}

function resolvePlayoffLabel(
  state: GameState,
  teamId: TeamId,
  leagueRank: number,
  cutoff: number,
  cutoffVisible: boolean,
): PlayoffPositionLabel {
  const playoffs = state.competition.playoffs;
  const phase = state.competition.season.phase;

  if (phase === "offseason" || playoffs.status === "complete") {
    if (playoffs.championTeamId === teamId) {
      return "clinched";
    }
    if (playoffs.qualifiedTeams.some((s) => s.teamId === teamId)) {
      return "clinched";
    }
    return "na";
  }

  if (playoffs.status === "in_progress") {
    if (playoffs.qualifiedTeams.some((s) => s.teamId === teamId)) {
      return "clinched";
    }
    return "na";
  }

  if (playoffs.qualifiedTeams.some((s) => s.teamId === teamId)) {
    return "clinched";
  }

  if (!cutoffVisible) {
    return "na";
  }

  if (leagueRank <= cutoff) {
    return "playoff";
  }

  if (leagueRank <= cutoff + BUBBLE_BAND) {
    return "bubble";
  }

  return "na";
}

type Draft = {
  teamId: string;
  abbreviation: string;
  city: string;
  name: string;
  wins: number;
  losses: number;
  winPercentage: number;
  streak: StandingStreak;
  conferenceId: string;
  conferenceName: string;
  divisionId: string;
  divisionName: string;
  isUserTeam: boolean;
  branding: TeamBrandingView | null;
  standing: TeamStanding;
};

function compareDrafts(a: Draft, b: Draft): number {
  return compareStandings(a.standing, b.standing);
}

function rankGroup(
  drafts: Draft[],
): { rankById: Map<string, number>; leader: TeamStanding | undefined } {
  const sorted = [...drafts].sort(compareDrafts);
  const rankById = new Map<string, number>();
  sorted.forEach((row, i) => rankById.set(row.teamId, i + 1));
  return { rankById, leader: sorted[0]?.standing };
}

function buildEnrichedRows(state: GameState): StandingsRowEnriched[] {
  const owned = new Set(state.user.ownedTeamIds);
  const liveTeamCount = Object.keys(state.world.teams).length;
  const playoffTeamCount = resolvePlayoffTeamCount(state);
  const cutoffVisible = isPlayoffCutoffVisible(playoffTeamCount, liveTeamCount);

  const drafts: Draft[] = [];
  for (const team of Object.values(state.world.teams)) {
    const standing =
      state.competition.standings.byTeamId[team.id] ??
      createEmptyTeamStanding(team.id);
    const conference = state.world.conferences[team.conferenceId];
    const division = state.world.divisions[team.divisionId];
    drafts.push({
      teamId: team.id,
      abbreviation: team.abbreviation,
      city: team.city,
      name: team.name,
      wins: standing.wins,
      losses: standing.losses,
      winPercentage: standing.winPercentage,
      streak: standing.streak,
      conferenceId: team.conferenceId,
      conferenceName: conference?.name ?? "Conference",
      divisionId: team.divisionId,
      divisionName: division?.name ?? "Division",
      isUserTeam: owned.has(team.id),
      branding: toBrandingView(team.branding),
      standing,
    });
  }

  const league = rankGroup(drafts);
  const leagueLeaderStanding = league.leader;

  const byConference = new Map<string, Draft[]>();
  const byDivision = new Map<string, Draft[]>();
  for (const row of drafts) {
    const confList = byConference.get(row.conferenceId) ?? [];
    confList.push(row);
    byConference.set(row.conferenceId, confList);
    const divList = byDivision.get(row.divisionId) ?? [];
    divList.push(row);
    byDivision.set(row.divisionId, divList);
  }

  const conferenceRankById = new Map<string, number>();
  const conferenceLeaderById = new Map<string, TeamStanding>();
  for (const [confId, rows] of byConference) {
    const ranked = rankGroup(rows);
    for (const [id, rank] of ranked.rankById) {
      conferenceRankById.set(id, rank);
    }
    if (ranked.leader) {
      conferenceLeaderById.set(confId, ranked.leader);
    }
  }

  const divisionRankById = new Map<string, number>();
  const divisionLeaderById = new Map<string, TeamStanding>();
  for (const [divId, rows] of byDivision) {
    const ranked = rankGroup(rows);
    for (const [id, rank] of ranked.rankById) {
      divisionRankById.set(id, rank);
    }
    if (ranked.leader) {
      divisionLeaderById.set(divId, ranked.leader);
    }
  }

  return drafts.map((row) => {
    const conferenceRank = conferenceRankById.get(row.teamId) ?? 99;
    const leagueRank = league.rankById.get(row.teamId) ?? 99;
    const divisionRank = divisionRankById.get(row.teamId) ?? 99;
    const confLeader =
      conferenceLeaderById.get(row.conferenceId) ?? row.standing;
    const divLeader = divisionLeaderById.get(row.divisionId) ?? row.standing;
    const rates = scoringRates(row.standing);
    return {
      teamId: row.teamId,
      abbreviation: row.abbreviation,
      city: row.city,
      name: row.name,
      wins: row.wins,
      losses: row.losses,
      winPercentage: row.winPercentage,
      streak: row.streak,
      conferenceId: row.conferenceId,
      conferenceName: row.conferenceName,
      divisionId: row.divisionId,
      divisionName: row.divisionName,
      conferenceRank,
      leagueRank,
      divisionRank,
      gamesBackConference: gamesBack(confLeader, row.standing),
      gamesBackLeague: leagueLeaderStanding
        ? gamesBack(leagueLeaderStanding, row.standing)
        : 0,
      gamesBackDivision: gamesBack(divLeader, row.standing),
      gamesPlayed: rates.gamesPlayed,
      pointsFor: row.standing.pointsFor,
      pointsAgainst: row.standing.pointsAgainst,
      pointDifferential: row.standing.pointDifferential,
      ppg: rates.ppg,
      oppPpg: rates.oppPpg,
      net: rates.net,
      isUserTeam: row.isUserTeam,
      playoffLabel: resolvePlayoffLabel(
        state,
        row.teamId as TeamId,
        leagueRank,
        playoffTeamCount,
        cutoffVisible,
      ),
      branding: row.branding,
    };
  });
}

function uniqueSortedIds(
  rows: StandingsRowEnriched[],
  idOf: (row: StandingsRowEnriched) => string,
  nameOf: (row: StandingsRowEnriched) => string,
): string[] {
  return [...new Set(rows.map(idOf))].sort((a, b) => {
    const an = rows.find((r) => idOf(r) === a);
    const bn = rows.find((r) => idOf(r) === b);
    return (an ? nameOf(an) : a).localeCompare(bn ? nameOf(bn) : b);
  });
}

function projectGroups(
  state: GameState,
  rows: StandingsRowEnriched[],
  view: StandingsViewMode,
  playoffTeamCount: number,
): StandingsGroup[] {
  const liveTeamCount = rows.length;
  const overallCutoff = isPlayoffCutoffVisible(playoffTeamCount, liveTeamCount)
    ? playoffTeamCount
    : null;

  if (view === "overall") {
    return [
      {
        id: "league",
        name: state.world.league.name || "League",
        kind: "overall",
        cutoffRank: overallCutoff,
        rows: [...rows].sort((a, b) => a.leagueRank - b.leagueRank),
      },
    ];
  }

  if (view === "conference") {
    const ids = uniqueSortedIds(
      rows,
      (r) => r.conferenceId,
      (r) => r.conferenceName,
    );
    return ids.map((conferenceId) => {
      const confRows = rows
        .filter((r) => r.conferenceId === conferenceId)
        .sort((a, b) => a.conferenceRank - b.conferenceRank);
      return {
        id: conferenceId,
        name: confRows[0]?.conferenceName ?? "Conference",
        kind: "conference" as const,
        cutoffRank: null,
        rows: confRows,
      };
    });
  }

  const ids = uniqueSortedIds(
    rows,
    (r) => r.divisionId,
    (r) => r.divisionName,
  );
  return ids.map((divisionId) => {
    const divRows = rows
      .filter((r) => r.divisionId === divisionId)
      .sort((a, b) => a.divisionRank - b.divisionRank);
    return {
      id: divisionId,
      name: divRows[0]?.divisionName ?? "Division",
      kind: "division" as const,
      cutoffRank: null,
      rows: divRows,
    };
  });
}

function standingsMode(state: GameState): StandingsPageView["mode"] {
  const phase = state.competition.season.phase;
  const playoffs = state.competition.playoffs;
  if (phase === "offseason" || playoffs.status === "complete") {
    return "offseason";
  }
  if (phase === "playoffs" || playoffs.status === "in_progress") {
    return "playoffs";
  }
  return "regular";
}

export function toStandingsPageView(
  state: GameState,
  options: StandingsPageOptions,
): StandingsPageView {
  const rows = buildEnrichedRows(state);
  const cutoffPerConference = playoffCutoffPerConference(state);
  const playoffTeamCount = resolvePlayoffTeamCount(state);
  const mode = standingsMode(state);
  const groups = projectGroups(state, rows, options.view, playoffTeamCount);
  const leagueRows = [...rows].sort((a, b) => a.leagueRank - b.leagueRank);

  let userPlayoffRace: PlayoffRaceStatus = "not_applicable";
  try {
    userPlayoffRace = getCalendarContext(state).playoffRace;
  } catch {
    userPlayoffRace = "not_applicable";
  }

  return {
    mode,
    seasonYear: state.competition.season.year,
    seasonPhase: state.competition.season.phase,
    fieldSize: state.competition.playoffs.fieldSize,
    view: options.view,
    stats: options.stats,
    divisionsEnabled: state.settings.league.divisionsEnabled,
    playoffTeamCount,
    cutoffPerConference,
    groups,
    leagueRows,
    championTeamId: state.competition.playoffs.championTeamId ?? null,
    playoffStatus: state.competition.playoffs.status,
    userPlayoffRace,
    ownedTeamIds: [...state.user.ownedTeamIds],
  };
}

function toRaceEntry(row: StandingsRowEnriched, cutoff: number): PlayoffRaceEntry {
  return {
    teamId: row.teamId,
    abbreviation: row.abbreviation,
    city: row.city,
    name: row.name,
    wins: row.wins,
    losses: row.losses,
    winPercentage: row.winPercentage,
    leagueRank: row.leagueRank,
    inField: row.leagueRank <= cutoff,
    isUserTeam: row.isUserTeam,
    branding: row.branding,
  };
}

export function toPlayoffRaceView(state: GameState): PlayoffRaceView {
  const page = toStandingsPageView(state, {
    view: "overall",
    stats: "standard",
  });
  const playoffTeamCount = page.playoffTeamCount;
  const live = page.leagueRows.length;
  const applicable =
    page.mode === "regular" &&
    isPlayoffCutoffVisible(playoffTeamCount, live);

  if (!applicable) {
    return {
      applicable: false,
      cutoffRank: playoffTeamCount,
      playoffTeamCount,
      above: [],
      below: [],
    };
  }

  const cutoff = playoffTeamCount;
  const inTeams = page.leagueRows.filter((r) => r.leagueRank <= cutoff);
  const outTeams = page.leagueRows.filter((r) => r.leagueRank > cutoff);
  let above = inTeams.slice(-Math.min(PLAYOFF_RACE_WINDOW, inTeams.length));
  let below = outTeams.slice(0, Math.min(PLAYOFF_RACE_WINDOW, outTeams.length));

  const windowIds = new Set(
    [...above, ...below].map((row) => row.teamId),
  );
  const owned = new Set(page.ownedTeamIds);
  for (const row of page.leagueRows) {
    if (!owned.has(row.teamId) || windowIds.has(row.teamId)) {
      continue;
    }
    if (row.leagueRank <= cutoff) {
      above = [...above, row].sort((a, b) => a.leagueRank - b.leagueRank);
    } else {
      below = [...below, row].sort((a, b) => a.leagueRank - b.leagueRank);
    }
    windowIds.add(row.teamId);
  }

  return {
    applicable: true,
    cutoffRank: cutoff,
    playoffTeamCount,
    above: above.map((row) => toRaceEntry(row, cutoff)),
    below: below.map((row) => toRaceEntry(row, cutoff)),
  };
}

/**
 * Compact context for League Hub My Team strip.
 */
export function toMyTeamStandingsContext(
  state: GameState,
): MyTeamStandingsContext | null {
  const teamId = getActiveOwnerTeamId(state);
  const page = toStandingsPageView(state, {
    view: "conference",
    stats: "standard",
  });
  const user = page.leagueRows.find((r) => r.teamId === teamId);
  if (!user) {
    return null;
  }

  const leader = page.leagueRows[0];
  const cutoffVisible = isPlayoffCutoffVisible(
    page.playoffTeamCount,
    page.leagueRows.length,
  );
  const cutoffRow = cutoffVisible
    ? (page.leagueRows.find((r) => r.leagueRank === page.playoffTeamCount) ??
      null)
    : null;

  return {
    teamId: user.teamId,
    city: user.city,
    name: user.name,
    abbreviation: user.abbreviation,
    wins: user.wins,
    losses: user.losses,
    conferenceRank: user.conferenceRank,
    conferenceName: user.conferenceName,
    gamesBack: user.gamesBackConference,
    streakLabel: streakLabel(user.streak),
    leagueLeader: leader
      ? {
          abbreviation: leader.abbreviation,
          wins: leader.wins,
          losses: leader.losses,
        }
      : { abbreviation: "—", wins: 0, losses: 0 },
    cutoffTeam: cutoffRow
      ? {
          abbreviation: cutoffRow.abbreviation,
          wins: cutoffRow.wins,
          losses: cutoffRow.losses,
        }
      : null,
    playoffLabel: user.playoffLabel,
    branding: user.branding,
  };
}

export function formatStreak(streak: StandingStreak): string {
  return streakLabel(streak) ?? "—";
}

export type CalendarLeagueContextView = {
  conferenceRank: number;
  divisionRank: number;
  conferenceName: string;
  divisionName: string;
  wins: number;
  losses: number;
  conferenceWins: number;
  conferenceLosses: number;
  divisionWins: number;
  divisionLosses: number;
  gamesBack: number;
  streakLabel: string | null;
};

/**
 * Compact standings strip for the Calendar page — controlled team only.
 */
export function toCalendarLeagueContext(
  state: GameState,
): CalendarLeagueContextView | null {
  const teamId = getActiveOwnerTeamId(state);
  const page = toStandingsPageView(state, {
    view: "conference",
    stats: "standard",
  });
  const user = page.leagueRows.find((row) => row.teamId === teamId);
  if (!user) {
    return null;
  }

  const standing =
    state.competition.standings.byTeamId[teamId] ??
    createEmptyTeamStanding(teamId);

  return {
    conferenceRank: user.conferenceRank,
    divisionRank: user.divisionRank,
    conferenceName: user.conferenceName,
    divisionName: user.divisionName,
    wins: user.wins,
    losses: user.losses,
    conferenceWins: standing.conferenceWins,
    conferenceLosses: standing.conferenceLosses,
    divisionWins: standing.divisionWins,
    divisionLosses: standing.divisionLosses,
    gamesBack: user.gamesBackConference,
    streakLabel: streakLabel(user.streak),
  };
}

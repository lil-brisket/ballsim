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
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import type { PlayoffRaceStatus } from "@/systems/simulation/calendar-context";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

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
  /** Games back vs conference leader when in conference context. */
  gamesBackConference: number;
  /** Games back vs league leader. */
  gamesBackLeague: number;
  isUserTeam: boolean;
  playoffLabel: PlayoffPositionLabel;
  branding: TeamBrandingView | null;
};

export type StandingsConferenceGroup = {
  conferenceId: string;
  conferenceName: string;
  cutoffRank: number;
  rows: StandingsRowEnriched[];
};

export type StandingsPageView = {
  mode: "regular" | "playoffs" | "offseason";
  seasonYear: number;
  seasonPhase: string;
  fieldSize: number;
  /** Per-conference cutoff (teams that make playoffs from that conference). */
  cutoffPerConference: number;
  groups: StandingsConferenceGroup[];
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

function gamesBack(leader: TeamStanding, team: TeamStanding): number {
  const raw =
    (leader.wins - team.wins + (team.losses - leader.losses)) / 2;
  return Math.round(raw * 10) / 10;
}

function streakLabel(streak: StandingStreak): string | null {
  if (streak.type == null || streak.count <= 0) {
    return null;
  }
  return `${streak.type}${streak.count}`;
}

function sortStandingRows(
  a: { wins: number; losses: number; winPercentage: number; abbreviation: string },
  b: { wins: number; losses: number; winPercentage: number; abbreviation: string },
): number {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  if (a.losses !== b.losses) {
    return a.losses - b.losses;
  }
  if (b.winPercentage !== a.winPercentage) {
    return b.winPercentage - a.winPercentage;
  }
  return a.abbreviation.localeCompare(b.abbreviation);
}

/**
 * Playoff cutoff rank within a conference from league configuration.
 * Uses fieldSize / conferenceCount (not a hardcoded rank-8 assumption).
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

function resolvePlayoffLabel(
  state: GameState,
  teamId: TeamId,
  conferenceRank: number,
  cutoff: number,
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

  // Regular season — only use qualifiedTeams for clinched; never invent elimination
  if (playoffs.qualifiedTeams.some((s) => s.teamId === teamId)) {
    return "clinched";
  }

  if (conferenceRank <= cutoff) {
    return "playoff";
  }

  // Play-in: when field suggests play-in band (cutoff+1, cutoff+2) — only if playoffs support it
  // BallSim play-in exists in systems; surface only when fieldSize is set and rank is adjacent
  if (playoffs.fieldSize >= 2 && conferenceRank <= cutoff + 2) {
    return "play_in";
  }

  if (conferenceRank <= cutoff + 4) {
    return "bubble";
  }

  // Do NOT label "eliminated" without mathematical elimination from simulation
  return "na";
}

function buildEnrichedRows(state: GameState): StandingsRowEnriched[] {
  const owned = new Set(state.user.ownedTeamIds);
  const cutoff = playoffCutoffPerConference(state);

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

  // League ranks
  const leagueSorted = [...drafts].sort(sortStandingRows);
  const leagueRankById = new Map<string, number>();
  leagueSorted.forEach((row, i) => leagueRankById.set(row.teamId, i + 1));

  const leagueLeaderStanding = leagueSorted[0]?.standing;

  // Conference ranks + GB
  const byConference = new Map<string, Draft[]>();
  for (const row of drafts) {
    const list = byConference.get(row.conferenceId) ?? [];
    list.push(row);
    byConference.set(row.conferenceId, list);
  }

  const conferenceRankById = new Map<string, number>();
  const conferenceLeaderById = new Map<string, TeamStanding>();
  for (const [confId, rows] of byConference) {
    const sorted = [...rows].sort(sortStandingRows);
    sorted.forEach((row, i) => conferenceRankById.set(row.teamId, i + 1));
    if (sorted[0]) {
      conferenceLeaderById.set(confId, sorted[0].standing);
    }
  }

  return drafts.map((row) => {
    const conferenceRank = conferenceRankById.get(row.teamId) ?? 99;
    const leagueRank = leagueRankById.get(row.teamId) ?? 99;
    const confLeader =
      conferenceLeaderById.get(row.conferenceId) ?? row.standing;
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
      gamesBackConference: gamesBack(confLeader, row.standing),
      gamesBackLeague: leagueLeaderStanding
        ? gamesBack(leagueLeaderStanding, row.standing)
        : 0,
      isUserTeam: row.isUserTeam,
      playoffLabel: resolvePlayoffLabel(
        state,
        row.teamId as TeamId,
        conferenceRank,
        cutoff,
      ),
      branding: row.branding,
    };
  });
}

export function toStandingsPageView(state: GameState): StandingsPageView {
  const rows = buildEnrichedRows(state);
  const cutoff = playoffCutoffPerConference(state);
  const phase = state.competition.season.phase;
  const playoffs = state.competition.playoffs;

  let mode: StandingsPageView["mode"] = "regular";
  if (phase === "offseason" || playoffs.status === "complete") {
    mode = "offseason";
  } else if (phase === "playoffs" || playoffs.status === "in_progress") {
    mode = "playoffs";
  }

  const conferenceIds = [
    ...new Set(rows.map((r) => r.conferenceId)),
  ].sort((a, b) => {
    const an = rows.find((r) => r.conferenceId === a)?.conferenceName ?? a;
    const bn = rows.find((r) => r.conferenceId === b)?.conferenceName ?? b;
    return an.localeCompare(bn);
  });

  const groups: StandingsConferenceGroup[] = conferenceIds.map((conferenceId) => {
    const confRows = rows
      .filter((r) => r.conferenceId === conferenceId)
      .sort((a, b) => a.conferenceRank - b.conferenceRank);
    return {
      conferenceId,
      conferenceName: confRows[0]?.conferenceName ?? "Conference",
      cutoffRank: cutoff,
      rows: confRows,
    };
  });

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
    seasonPhase: phase,
    fieldSize: playoffs.fieldSize,
    cutoffPerConference: cutoff,
    groups,
    leagueRows,
    championTeamId: playoffs.championTeamId ?? null,
    playoffStatus: playoffs.status,
    userPlayoffRace,
    ownedTeamIds: [...state.user.ownedTeamIds],
  };
}

/**
 * Compact context for League Hub My Team strip.
 */
export function toMyTeamStandingsContext(
  state: GameState,
): MyTeamStandingsContext | null {
  const teamId = getActiveOwnerTeamId(state);
  const page = toStandingsPageView(state);
  const user = page.leagueRows.find((r) => r.teamId === teamId);
  if (!user) {
    return null;
  }

  const leader = page.leagueRows[0];
  const userGroup = page.groups.find((g) => g.conferenceId === user.conferenceId);
  const cutoffRow =
    userGroup?.rows.find((r) => r.conferenceRank === userGroup.cutoffRank) ??
    null;

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

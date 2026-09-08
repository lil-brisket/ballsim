/**
 * League Hub view model — single-pass presentation selector.
 * Tier 1 (snapshot, standings, results) + Tier 2 previews (max 3 each).
 */

import { isMediaUnread } from "@/domain/entities/media-item";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import { IMPORTANCE_RANK } from "@/domain/entities/event-source";
import type { GameState } from "@/state/game-state";
import { getFinalGamesForSeason } from "@/state/game-access";
import { getActiveOwnerTeamId, getActiveTeam } from "@/state/owner-context";
import { getActiveOwnedFranchise } from "@/state/owner-context";
import {
  toMyTeamStandingsContext,
  toStandingsPageView,
  type MyTeamStandingsContext,
  type StandingsRowEnriched,
} from "@/state/standings-selectors";
import { toLeagueInjuryBriefing, type LeagueInjuryRow } from "@/state/league-injury-selectors";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import { TEAM_TRANSACTION_EVENT_TYPES } from "@/state/team-transaction-selectors";
import { assessExpansion } from "@/state/expansion-assessment";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

export const LEAGUE_HUB_TIER2_LIMIT = 3;
export const LEAGUE_HUB_STANDINGS_TOP = 5;
export const LEAGUE_HUB_RESULTS_LIMIT = 6;

export type LeagueGameResultRow = {
  gameId: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeAbbreviation: string;
  awayAbbreviation: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  homeBranding: TeamBrandingView | null;
  awayBranding: TeamBrandingView | null;
  competitionType: string;
};

export type LeagueTransactionBrief = {
  id: string;
  type: string;
  occurredOn: string;
  description: string;
  playerIds: string[];
  teamIds: string[];
};

export type LeagueMediaBrief = {
  id: string;
  headline: string;
  summary: string;
  occurredOn: string;
  importance: ImportanceLevel;
  unread: boolean;
  href: string;
};

export type LeagueHubSnapshot = {
  leaderAbbreviation: string;
  leaderRecord: string;
  userRank: number;
  userRecord: string;
  bestRecord: string;
  worstRecord: string;
  playoffRaceLabel: string | null;
  mode: "regular" | "playoffs" | "offseason";
  championAbbreviation: string | null;
};

export type LeagueHubView = {
  saveId: string;
  leagueName: string;
  seasonYear: number;
  seasonPhase: string;
  seasonPhaseLabel: string;
  currentDate: string;
  userTeamId: string;
  userTeamCity: string;
  userTeamName: string;
  myTeam: MyTeamStandingsContext | null;
  snapshot: LeagueHubSnapshot;
  standingsPreview: StandingsRowEnriched[];
  /** True when user team was injected outside top N. */
  standingsIncludesUserOutsideTop: boolean;
  cutoffRank: number;
  recentResults: LeagueGameResultRow[];
  transactions: LeagueTransactionBrief[];
  injuries: LeagueInjuryRow[];
  media: LeagueMediaBrief[];
  expansionActive: boolean;
  playoffBanner: string | null;
};

function resolvePlayerName(state: GameState, playerId: unknown): string {
  if (typeof playerId !== "string") {
    return "Player";
  }
  const player = state.world.players[playerId];
  return player ? `${player.firstName} ${player.lastName}` : playerId;
}

function resolveTeamName(state: GameState, teamId: unknown): string {
  if (typeof teamId !== "string") {
    return "";
  }
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

function describeTxn(state: GameState, event: GameState["competition"]["seasonEventLog"][number]): string {
  const payload = event.payload as Record<string, unknown>;
  const playerName = resolvePlayerName(state, payload.playerId);
  const teamName = resolveTeamName(state, payload.teamId);
  const fromTeam = resolveTeamName(state, payload.fromTeamId);
  const toTeam = resolveTeamName(state, payload.toTeamId);
  switch (event.type) {
    case "FreeAgentSigned":
    case "ContractSigned":
      return `Signed ${playerName}${teamName ? ` — ${teamName}` : ""}`;
    case "PlayerTraded":
      return `Trade: ${playerName} (${fromTeam} → ${toTeam})`;
    case "PlayerReleased":
      return `Released ${playerName}${teamName ? ` — ${teamName}` : ""}`;
    case "DraftPickMade":
      return `Drafted ${playerName}${teamName ? ` — ${teamName}` : ""}`;
    case "CoachHired":
    case "StaffHired":
      return `Hired staff${teamName ? ` — ${teamName}` : ""}`;
    case "StaffFired":
      return `Fired staff${teamName ? ` — ${teamName}` : ""}`;
    default:
      return event.type;
  }
}

function collectIds(payload: Record<string, unknown>, keys: string[]): string[] {
  const ids: string[] = [];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      ids.push(value);
    }
  }
  return ids;
}

function playoffRaceLabel(race: string): string | null {
  switch (race) {
    case "clinched":
      return "Clinched";
    case "contending":
      return "Contending";
    case "bubble":
      return "Bubble";
    case "eliminated":
      return "Eliminated";
    default:
      return null;
  }
}

/**
 * Single-pass League Hub view for the active save.
 */
export function toLeagueHubView(state: GameState): LeagueHubView {
  const saveId = state.meta.saveId;
  const team = getActiveTeam(state);
  const teamId = getActiveOwnerTeamId(state);
  const standingsPage = toStandingsPageView(state);
  const myTeam = toMyTeamStandingsContext(state);

  const top = standingsPage.leagueRows.slice(0, LEAGUE_HUB_STANDINGS_TOP);
  const userInTop = top.some((r) => r.teamId === teamId);
  let standingsPreview = top;
  let standingsIncludesUserOutsideTop = false;
  if (!userInTop) {
    const userRow = standingsPage.leagueRows.find((r) => r.teamId === teamId);
    if (userRow) {
      standingsPreview = [...top, userRow];
      standingsIncludesUserOutsideTop = true;
    }
  }

  const leader = standingsPage.leagueRows[0];
  const worst = standingsPage.leagueRows[standingsPage.leagueRows.length - 1];
  const userRow = standingsPage.leagueRows.find((r) => r.teamId === teamId);

  const champion = standingsPage.championTeamId
    ? state.world.teams[standingsPage.championTeamId]
    : null;

  const snapshot: LeagueHubSnapshot = {
    leaderAbbreviation: leader?.abbreviation ?? "—",
    leaderRecord: leader ? `${leader.wins}–${leader.losses}` : "—",
    userRank: userRow?.leagueRank ?? 0,
    userRecord: userRow ? `${userRow.wins}–${userRow.losses}` : "—",
    bestRecord: leader ? `${leader.wins}–${leader.losses}` : "—",
    worstRecord: worst ? `${worst.wins}–${worst.losses}` : "—",
    playoffRaceLabel: playoffRaceLabel(standingsPage.userPlayoffRace),
    mode: standingsPage.mode,
    championAbbreviation: champion?.abbreviation ?? null,
  };

  // Recent league results — one pass over season finals
  const seasonId = state.competition.season.id;
  const finals = getFinalGamesForSeason(state, seasonId)
    .filter((g) => g.competitionType !== "development_league")
    .sort((a, b) => {
      const d = b.date.localeCompare(a.date);
      if (d !== 0) {
        return d;
      }
      return b.id.localeCompare(a.id);
    })
    .slice(0, LEAGUE_HUB_RESULTS_LIMIT);

  const recentResults: LeagueGameResultRow[] = finals.map((game) => {
    const home = state.world.teams[game.homeTeamId];
    const away = state.world.teams[game.awayTeamId];
    return {
      gameId: game.id,
      date: game.date,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeAbbreviation: home?.abbreviation ?? "???",
      awayAbbreviation: away?.abbreviation ?? "???",
      homeName: home ? `${home.city} ${home.name}` : "Home",
      awayName: away ? `${away.city} ${away.name}` : "Away",
      homeScore: game.score.home,
      awayScore: game.score.away,
      homeBranding: toBrandingView(home?.branding),
      awayBranding: toBrandingView(away?.branding),
      competitionType: game.competitionType,
    };
  });

  // Transactions briefing
  const txnEvents = [...state.competition.seasonEventLog]
    .filter((e) => TEAM_TRANSACTION_EVENT_TYPES.includes(e.type))
    .sort((a, b) => {
      const d = b.occurredOn.localeCompare(a.occurredOn);
      if (d !== 0) {
        return d;
      }
      return b.id.localeCompare(a.id);
    })
    .slice(0, LEAGUE_HUB_TIER2_LIMIT);

  const transactions: LeagueTransactionBrief[] = txnEvents.map((event) => {
    const payload = event.payload as Record<string, unknown>;
    return {
      id: event.id,
      type: event.type,
      occurredOn: event.occurredOn,
      description: describeTxn(state, event),
      playerIds: collectIds(payload, ["playerId"]),
      teamIds: collectIds(payload, [
        "teamId",
        "fromTeamId",
        "toTeamId",
      ]),
    };
  });

  const injuries = toLeagueInjuryBriefing(state, LEAGUE_HUB_TIER2_LIMIT);

  // Media briefing
  const franchise = getActiveOwnedFranchise(state);
  const readState = franchise.mediaReadState ?? {};
  const mediaItems = [...(franchise.mediaFeed?.items ?? [])].sort((a, b) => {
    const imp =
      IMPORTANCE_RANK[b.importance] - IMPORTANCE_RANK[a.importance];
    if (imp !== 0) {
      return imp;
    }
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    const d = b.occurredOn.localeCompare(a.occurredOn);
    if (d !== 0) {
      return d;
    }
    return b.id.localeCompare(a.id);
  });

  const media: LeagueMediaBrief[] = mediaItems
    .slice(0, LEAGUE_HUB_TIER2_LIMIT)
    .map((item) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      occurredOn: item.occurredOn,
      importance: item.importance,
      unread: isMediaUnread(item, readState),
      href: `/dashboard/${saveId}/media`,
    }));

  const expansion = assessExpansion(state);
  const expansionActive =
    expansion.status === "opportunity" || expansion.status === "in_progress";

  let playoffBanner: string | null = null;
  if (standingsPage.mode === "playoffs") {
    playoffBanner = "Playoffs in progress";
    const userSeries = state.competition.playoffs.series.find(
      (s) =>
        s.status === "active" &&
        (s.higherSeedTeamId === teamId || s.lowerSeedTeamId === teamId),
    );
    if (userSeries) {
      playoffBanner = `Playoffs — Round ${userSeries.round + 1}`;
    }
  } else if (standingsPage.mode === "offseason" && champion) {
    playoffBanner = `Champions: ${champion.city} ${champion.name}`;
  }

  const seasonPhaseLabel = getCalendarContext(state).displayLabel;

  return {
    saveId,
    leagueName: state.world.league.name,
    seasonYear: state.competition.season.year,
    seasonPhase: state.competition.season.phase,
    seasonPhaseLabel,
    currentDate: state.world.calendar.currentDate,
    userTeamId: team.id,
    userTeamCity: team.city,
    userTeamName: team.name,
    myTeam,
    snapshot,
    standingsPreview,
    standingsIncludesUserOutsideTop,
    cutoffRank: standingsPage.cutoffPerConference,
    recentResults,
    transactions,
    injuries,
    media,
    expansionActive,
    playoffBanner,
  };
}

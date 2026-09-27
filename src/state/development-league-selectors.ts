/**
 * View selectors for the Franchise Development League dashboard.
 * Presentation-only; composes DL eligibility/readiness systems.
 */

import { DL_MAX_SEASONS } from "@/domain/entities/development-league";
import type { DevelopmentReadiness } from "@/domain/entities/development-league";
import type { TeamStanding } from "@/domain/entities/standings";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { changeFromHistory } from "@/state/player-overall-change";
import { getControlledTeam } from "@/state/selectors";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import {
  getDevelopmentLeagueRosterPlayers,
  getFranchisePlayers,
  isPlayerDlAssigned,
} from "@/systems/development-league/franchise-membership";
import { isDevelopmentLeagueEligible } from "@/systems/development-league/eligibility";
import {
  getDevelopmentReadiness,
  getDlAssignmentExplanation,
  getDlAssignmentRecommendation,
  getPromotionExplanation,
} from "@/systems/development-league/recommendations";

export const DL_NOTABLE_MIN_GAMES = 5;
export const DL_NOTABLE_PPG = 10;
export const DL_WHY_BULLETS_FALLBACK =
  "Readiness based on current OVR and projected top-league minutes.";

export type DlProspectRowView = {
  playerId: string;
  name: string;
  overall: number;
  potential: number;
  potentialHeadroom: number;
  age: number;
  dlSeason: number;
  seasonsRemaining: number;
  role: string;
  mpg: number | null;
  ppg: number | null;
  rpg: number | null;
  apg: number | null;
  readiness: DevelopmentReadiness;
  whyBullets: string[];
  changeDelta: number | null;
  changeLabel: string | null;
};

export type DlRecentResultView = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  opponentTeamId: string;
  opponentName: string;
  opponentBranding: TeamBrandingView | null;
  home: boolean;
  teamScore: number;
  opponentScore: number;
  won: boolean;
};

export type DevelopmentLeagueDashboardView = {
  saveId: string;
  teamId: string;
  teamName: string;
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
  /** Franchise Development League record — same teamId as parent franchise. */
  record: { wins: number; losses: number } | null;
  leagueRank: number | null;
  streakLabel: string | null;
  assignedCount: number;
  summary: {
    developing: number;
    ready: number;
    nearReady: number;
    notReady: number;
  };
  /** Pipeline: ready for recall first. */
  recallCandidates: DlProspectRowView[];
  developingProspects: DlProspectRowView[];
  notablePerformance: DlProspectRowView[];
  improvers: DlProspectRowView[];
  prospects: DlProspectRowView[];
  recentResults: DlRecentResultView[];
  eligibleToAssign: Array<{
    playerId: string;
    name: string;
    overall: number;
    potential: number;
    projectedMpg: number;
    strongCandidate: boolean;
  }>;
};

function mpgFromCache(
  stats: { games: number; minutes: number } | undefined,
): number | null {
  if (stats == null || stats.games <= 0) return null;
  return Math.round((stats.minutes / stats.games) * 10) / 10;
}

function avg(
  stats:
    | { games: number; points?: number; rebounds?: number; assists?: number }
    | undefined,
  key: "points" | "rebounds" | "assists",
): number | null {
  if (stats == null || stats.games <= 0) return null;
  const value = stats[key] ?? 0;
  return Math.round((value / stats.games) * 10) / 10;
}

const READINESS_ORDER: Record<DevelopmentReadiness, number> = {
  ready: 0,
  near_ready: 1,
  developing: 2,
  not_ready: 3,
};

/**
 * Sort: ready for recall → development relevance → performance (ppg) → name
 */
export function sortDlProspects(
  prospects: DlProspectRowView[],
): DlProspectRowView[] {
  return [...prospects].sort((a, b) => {
    const ra = READINESS_ORDER[a.readiness] ?? 9;
    const rb = READINESS_ORDER[b.readiness] ?? 9;
    if (ra !== rb) return ra - rb;
    const ppgA = a.ppg ?? -1;
    const ppgB = b.ppg ?? -1;
    if (ppgB !== ppgA) return ppgB - ppgA;
    return a.name.localeCompare(b.name);
  });
}

function withWhyFallback(bullets: string[]): string[] {
  if (bullets.length === 0) {
    return [DL_WHY_BULLETS_FALLBACK];
  }
  return bullets;
}

function streakLabelFromStanding(
  standing: TeamStanding | undefined,
): string | null {
  if (standing == null) return null;
  if (standing.streak.type == null || standing.streak.count <= 0) return null;
  return `${standing.streak.type}${standing.streak.count}`;
}

function dlLeagueRank(state: GameState, teamId: string): number | null {
  const byTeamId =
    state.competition.developmentLeague?.standings.byTeamId ?? {};
  const rows = Object.values(byTeamId);
  if (rows.length === 0) return null;
  if (byTeamId[teamId] == null) return null;

  const ranked = rows
    .map((standing) => ({
      standing,
      abbreviation:
        state.world.teams[standing.teamId]?.abbreviation ?? standing.teamId,
    }))
    .sort((a, b) => {
      if (b.standing.winPercentage !== a.standing.winPercentage) {
        return b.standing.winPercentage - a.standing.winPercentage;
      }
      if (b.standing.wins !== a.standing.wins) {
        return b.standing.wins - a.standing.wins;
      }
      return a.abbreviation.localeCompare(b.abbreviation);
    });

  const index = ranked.findIndex((row) => row.standing.teamId === teamId);
  return index < 0 ? null : index + 1;
}

export function toDevelopmentLeagueDashboardView(
  state: GameState,
): DevelopmentLeagueDashboardView {
  const team = getControlledTeam(state);
  const teamId = team.id;
  const saveId = state.meta.saveId;
  const dlPlayers = getDevelopmentLeagueRosterPlayers(teamId, state);
  const prospects: DlProspectRowView[] = [];
  let developing = 0;
  let ready = 0;
  let nearReady = 0;
  let notReady = 0;

  for (const player of dlPlayers) {
    const readiness = getDevelopmentReadiness(player, teamId, state);
    if (readiness === "ready") ready += 1;
    else if (readiness === "near_ready") nearReady += 1;
    else if (readiness === "developing") developing += 1;
    else notReady += 1;

    const stats = player.developmentLeague?.currentSeasonStats;
    const seasonsUsed = player.developmentLeague?.seasonsUsed ?? 0;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    const potential = player.potential.overall;
    const change = changeFromHistory(state, player.id, overall);
    const whyBullets = isPlayerDlAssigned(player)
      ? getPromotionExplanation(player, teamId, state)
      : getDlAssignmentExplanation(player, teamId, state);

    prospects.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      overall,
      potential,
      potentialHeadroom: Math.max(0, potential - overall),
      age: player.age,
      dlSeason:
        seasonsUsed + (player.developmentLeague?.assignedThisSeason ? 1 : 0),
      seasonsRemaining: Math.max(0, DL_MAX_SEASONS - seasonsUsed),
      role: player.developmentLeague?.role ?? "development",
      mpg: mpgFromCache(stats),
      ppg: avg(stats, "points"),
      rpg: avg(stats, "rebounds"),
      apg: avg(stats, "assists"),
      readiness,
      whyBullets: withWhyFallback(whyBullets),
      changeDelta: change.delta,
      changeLabel: change.label,
    });
  }

  const sorted = sortDlProspects(prospects);
  const recallCandidates = sorted.filter((p) => p.readiness === "ready");
  const developingProspects = sorted.filter((p) => p.readiness !== "ready");
  const notablePerformance = [...sorted]
    .filter((p) => {
      const player = state.world.players[p.playerId];
      const games = player?.developmentLeague?.currentSeasonStats?.games ?? 0;
      return (
        p.ppg !== null &&
        p.ppg >= DL_NOTABLE_PPG &&
        games >= DL_NOTABLE_MIN_GAMES
      );
    })
    .sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0))
    .slice(0, 5);
  const improvers = [...sorted]
    .filter((p) => p.changeDelta !== null && p.changeDelta > 0)
    .sort((a, b) => (b.changeDelta ?? 0) - (a.changeDelta ?? 0))
    .slice(0, 5);

  const standing =
    state.competition.developmentLeague?.standings.byTeamId[teamId];
  const record = standing
    ? { wins: standing.wins, losses: standing.losses }
    : null;

  const recentResults: DlRecentResultView[] = [];
  const dlGames = state.competition.developmentLeague?.games ?? {};
  const teamGames = Object.values(dlGames)
    .filter(
      (g) =>
        (g.homeTeamId === teamId || g.awayTeamId === teamId) &&
        g.status === "final",
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);

  for (const game of teamGames) {
    const home = game.homeTeamId === teamId;
    const teamScore = home ? game.score.home : game.score.away;
    const opponentScore = home ? game.score.away : game.score.home;
    const opponentId = home ? game.awayTeamId : game.homeTeamId;
    const opponent = state.world.teams[opponentId];
    recentResults.push({
      gameId: game.id,
      date: game.date,
      opponentAbbreviation: opponent?.abbreviation ?? opponentId,
      opponentTeamId: opponentId,
      opponentName: opponent ? `${opponent.city} ${opponent.name}` : opponentId,
      opponentBranding: toBrandingView(opponent?.branding) ?? null,
      home,
      teamScore,
      opponentScore,
      won: teamScore > opponentScore,
    });
  }

  const eligibleToAssign = getFranchisePlayers(teamId, state)
    .filter(
      (p) =>
        !isPlayerDlAssigned(p) && isDevelopmentLeagueEligible(p, teamId, state),
    )
    .map((p) => {
      const rec = getDlAssignmentRecommendation(p, teamId, state);
      return {
        playerId: p.id,
        name: `${p.firstName} ${p.lastName}`,
        overall: rec.overall,
        potential: p.potential.overall,
        projectedMpg: Math.round(rec.projectedTopLeagueMpg * 10) / 10,
        strongCandidate: rec.strongCandidate,
      };
    })
    .sort(
      (a, b) =>
        Number(b.strongCandidate) - Number(a.strongCandidate) ||
        a.name.localeCompare(b.name),
    );

  return {
    saveId,
    teamId,
    teamName: `${team.city} ${team.name}`,
    city: team.city,
    name: team.name,
    abbreviation: team.abbreviation,
    branding: toBrandingView(team.branding),
    record,
    leagueRank: dlLeagueRank(state, teamId),
    streakLabel: streakLabelFromStanding(standing),
    assignedCount: sorted.length,
    summary: { developing, ready, nearReady, notReady },
    recallCandidates,
    developingProspects,
    notablePerformance,
    improvers,
    prospects: sorted,
    recentResults,
    eligibleToAssign,
  };
}

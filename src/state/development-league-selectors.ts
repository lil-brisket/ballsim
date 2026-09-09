/**
 * View selectors for the Franchise Development League dashboard.
 * Presentation-only; composes DL eligibility/readiness systems.
 */

import type { DevelopmentReadiness } from "@/domain/entities/development-league";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getControlledTeam } from "@/state/selectors";
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

export type DlProspectRowView = {
  playerId: string;
  name: string;
  overall: number;
  potential: number;
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
};

export type DlRecentResultView = {
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  home: boolean;
  teamScore: number;
  opponentScore: number;
  won: boolean;
};

export type DevelopmentLeagueDashboardView = {
  saveId: string;
  teamId: string;
  teamName: string;
  /** Franchise Development League record — same teamId as parent franchise. */
  record: { wins: number; losses: number } | null;
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

function mpgFromCache(stats: { games: number; minutes: number } | undefined): number | null {
  if (stats == null || stats.games <= 0) return null;
  return Math.round((stats.minutes / stats.games) * 10) / 10;
}

function avg(
  stats: { games: number; points?: number; rebounds?: number; assists?: number } | undefined,
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
    prospects.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      overall: calculatePlayerOverall(player.position, player.attributes),
      potential: player.potential.overall,
      age: player.age,
      dlSeason: seasonsUsed + (player.developmentLeague?.assignedThisSeason ? 1 : 0),
      seasonsRemaining: Math.max(0, 3 - seasonsUsed),
      role: player.developmentLeague?.role ?? "development",
      mpg: mpgFromCache(stats),
      ppg: avg(stats, "points"),
      rpg: avg(stats, "rebounds"),
      apg: avg(stats, "assists"),
      readiness,
      whyBullets: isPlayerDlAssigned(player)
        ? getPromotionExplanation(player, teamId, state)
        : getDlAssignmentExplanation(player, teamId, state),
    });
  }

  const sorted = sortDlProspects(prospects);
  const recallCandidates = sorted.filter((p) => p.readiness === "ready");
  const developingProspects = sorted.filter((p) => p.readiness !== "ready");
  const notablePerformance = [...sorted]
    .filter((p) => p.ppg !== null && p.ppg >= 10)
    .sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0))
    .slice(0, 5);

  const standing = state.competition.developmentLeague?.standings.byTeamId[teamId];
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
      home,
      teamScore,
      opponentScore,
      won: teamScore > opponentScore,
    });
  }

  const eligibleToAssign = getFranchisePlayers(teamId, state)
    .filter(
      (p) =>
        !isPlayerDlAssigned(p) &&
        isDevelopmentLeagueEligible(p, teamId, state),
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
    .sort((a, b) => Number(b.strongCandidate) - Number(a.strongCandidate) || a.name.localeCompare(b.name));

  return {
    saveId,
    teamId,
    teamName: `${team.city} ${team.name}`,
    record,
    summary: { developing, ready, nearReady, notReady },
    recallCandidates,
    developingProspects,
    notablePerformance,
    prospects: sorted,
    recentResults,
    eligibleToAssign,
  };
}

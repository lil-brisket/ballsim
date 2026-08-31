/**
 * View selectors for the Development League dashboard and player cards.
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

export type DevelopmentLeagueDashboardView = {
  summary: {
    developing: number;
    ready: number;
    nearReady: number;
    notReady: number;
  };
  prospects: DlProspectRowView[];
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

export function toDevelopmentLeagueDashboardView(
  state: GameState,
): DevelopmentLeagueDashboardView {
  const team = getControlledTeam(state);
  const teamId = team.id;
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

  prospects.sort((a, b) => b.overall - a.overall);

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
    .sort((a, b) => Number(b.strongCandidate) - Number(a.strongCandidate));

  return {
    summary: { developing, ready, nearReady, notReady },
    prospects,
    eligibleToAssign,
  };
}

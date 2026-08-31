/**
 * AI Development League assign / promote decisions for non-user teams.
 * Projected top-league minutes is the highest-weight factor.
 */

import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import {
  assignPlayerToDevelopmentLeague,
  recallPlayerFromDevelopmentLeague,
} from "@/systems/development-league/assignment";
import { isDevelopmentLeagueEligible } from "@/systems/development-league/eligibility";
import {
  getDevelopmentLeagueRosterPlayers,
  getTopLeagueRosterPlayers,
} from "@/systems/development-league/franchise-membership";
import {
  getDevelopmentReadiness,
  getDlAssignmentRecommendation,
} from "@/systems/development-league/recommendations";

const ASSIGN_SCORE_THRESHOLD = 40;
const PROMOTE_READINESS: ReadonlySet<string> = new Set([
  "ready",
  "near_ready",
]);

/**
 * Run AI DL decisions for all non-user-controlled franchises.
 */
export function runAiDevelopmentLeagueDecisions(
  state: GameState,
  _rng: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;

  const teamIds = (Object.keys(current.world.teams) as TeamId[])
    .filter((teamId) => !isUserControlledTeam(current, teamId))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const teamId of teamIds) {
    // Promotions first — free up DL spots / fill roster needs
    const dlPlayers = getDevelopmentLeagueRosterPlayers(teamId, current);
    for (const player of dlPlayers) {
      const readiness = getDevelopmentReadiness(player, teamId, current);
      if (!PROMOTE_READINESS.has(readiness)) continue;
      // Prefer promoting when projected minutes justify it
      const rec = getDlAssignmentRecommendation(player, teamId, current);
      if (rec.projectedTopLeagueMpg < 10 && readiness !== "ready") continue;
      const result = recallPlayerFromDevelopmentLeague(
        current,
        player.id,
        teamId,
      );
      if (result.success) {
        current = result.state;
        events.push(...result.events);
      }
    }

    // Assignments — low projected MPG + eligibility
    const topPlayers = getTopLeagueRosterPlayers(teamId, current);
    const candidates = topPlayers
      .filter((p) => isDevelopmentLeagueEligible(p, teamId, current))
      .map((p) => ({
        player: p,
        rec: getDlAssignmentRecommendation(p, teamId, current),
      }))
      .filter((c) => c.rec.score >= ASSIGN_SCORE_THRESHOLD)
      .sort((a, b) => b.rec.score - a.rec.score);

    for (const { player } of candidates) {
      // Keep at least min roster after assignment
      const result = assignPlayerToDevelopmentLeague(
        current,
        player.id,
        teamId,
      );
      if (result.success) {
        current = result.state;
        events.push(...result.events);
      }
    }
  }

  return systemResult(current, events);
}

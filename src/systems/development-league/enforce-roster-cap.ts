/**
 * Keep top-league rosters at or below the season-start maximum.
 *
 * Draft selection may add players above the cap. Until waivers exist,
 * overflow goes to the Development League when eligible.
 */

import type { Player } from "@/domain/entities/player";
import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { assignPlayerToDevelopmentLeague } from "@/systems/development-league/assignment";
import { isDevelopmentLeagueEligible } from "@/systems/development-league/eligibility";
import { getTopLeagueRosterPlayers } from "@/systems/development-league/franchise-membership";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type EnforceRosterCapOptions = {
  teamIds?: readonly TeamId[];
};

function overallOf(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function pickOverflowDlCandidate(
  state: GameState,
  teamId: TeamId,
): Player | null {
  const candidates = getTopLeagueRosterPlayers(teamId, state)
    .filter((player) => isDevelopmentLeagueEligible(player, teamId, state))
    .sort((a, b) => {
      const overallDelta = overallOf(a) - overallOf(b);
      if (overallDelta !== 0) {
        return overallDelta;
      }
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  return candidates[0] ?? null;
}

/**
 * Assign the weakest Development-League-eligible extras until each team
 * is at {@link TRADE_ROSTER_RULES.maxRosterSize}.
 */
export function enforceMaxRosterViaDevelopmentLeague(
  state: GameState,
  options: EnforceRosterCapOptions = {},
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const maxSize = TRADE_ROSTER_RULES.maxRosterSize;
  const teamIds = (
    options.teamIds ?? (Object.keys(current.world.teams) as TeamId[])
  )
    .slice()
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const teamId of teamIds) {
    let guard = 0;
    while (guard < maxSize + 8) {
      guard += 1;
      const rosterSize = current.world.teams[teamId]?.roster.length ?? 0;
      if (rosterSize <= maxSize) {
        break;
      }
      const candidate = pickOverflowDlCandidate(current, teamId);
      if (candidate == null) {
        break;
      }
      const assigned = assignPlayerToDevelopmentLeague(
        current,
        candidate.id,
        teamId,
      );
      if (!assigned.success) {
        break;
      }
      current = assigned.state;
      events.push(...assigned.events);
    }
  }

  return systemResult(current, events);
}

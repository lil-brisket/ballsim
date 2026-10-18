import { calendarDaysBetween } from "@/domain/calendar-date";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";
import {
  cpuOfferClosedReason,
  getActiveOwnerDecision,
} from "@/systems/owner-decisions";
import { getCalendarContext } from "@/systems/simulation/calendar-context";
import { AI_TRADE_SEARCH_MAX_STALE_DAYS } from "@/systems/trades-config";
import { getTradeBlock } from "@/systems/trades/trade-block";

/**
 * CPU trade-search gate. A full trade search costs tens of milliseconds per
 * team and almost always returns yesterday's answer. Each team stores a hash
 * of the inputs that reshape the market; the search runs again only when that
 * hash changes or the last search is stale. Pure and RNG-free.
 *
 * Day-to-day noise is deliberately left out of the hash and picked up by the
 * stale cap instead: player availability changes somewhere in the league
 * almost every day, and preference values drift with standings, but neither
 * changed a search's outcome in measured seasons, while hashing them made
 * every team search daily.
 *
 * A 64-bit hash collision would only delay one search until the stale cap.
 */

const marketKeyCache = new WeakMap<GameState, string>();

/**
 * League-wide trade market: rosters, DL status, contracts, trade blocks, pick
 * ownership and which teams the user controls.
 */
export function tradeMarketKey(state: GameState): string {
  const cached = marketKeyCache.get(state);
  if (cached !== undefined) {
    return cached;
  }
  const parts: string[] = [];
  const teamIds = (Object.keys(state.world.teams) as TeamId[]).sort();
  for (const teamId of teamIds) {
    const team = state.world.teams[teamId];
    if (!team) continue;
    parts.push(`T${teamId}`);
    for (const playerId of [...team.roster].sort()) {
      const player = state.world.players[playerId];
      const contract =
        player?.contractId != null
          ? state.business.contracts[player.contractId]
          : undefined;
      parts.push(
        `${playerId}:${player?.developmentLeague?.status ?? "-"}:${player?.contractId ?? "-"}:${contract ? JSON.stringify(contract.salaryByYear) : "-"}`,
      );
    }
    parts.push(`B${JSON.stringify(getTradeBlock(state, teamId).assets)}`);
  }
  for (const pickId of Object.keys(state.world.draftPicks).sort()) {
    const pick = state.world.draftPicks[pickId];
    if (!pick) continue;
    parts.push(`P${pickId}:${pick.ownerTeamId}:${pick.status}`);
  }
  parts.push(`U${[...state.user.ownedTeamIds].sort().join(",")}`);
  const key = hash64(parts.join("|"));
  marketKeyCache.set(state, key);
  return key;
}

/** Market key plus this team's posture and the calendar pressure. */
export function teamTradeSearchKey(
  state: GameState,
  teamId: TeamId,
  marketKey: string,
): string {
  const posture = resolveFranchisePreferences(state, teamId)?.posture ?? "-";
  const deadline = getCalendarContext(state).deadlineWindow ? "D" : "-";
  const ownerDecision = getActiveOwnerDecision(state.user) ? "O" : "-";
  // Offers to the owner are windowed; re-search when the window reopens.
  const offerWindow = cpuOfferClosedReason(state) === null ? "W" : "-";
  return hash64(
    `${marketKey}|${teamId}|${posture}|${deadline}|${ownerDecision}|${offerWindow}`,
  );
}

/** True when the team has never searched, its inputs changed, or it is stale. */
export function isTradeSearchDue(
  state: GameState,
  teamId: TeamId,
  searchKey: string,
): boolean {
  const record = state.competition.aiTradeSearch.byTeamId[teamId];
  if (record === undefined || record.inputsKey !== searchKey) {
    return true;
  }
  return (
    calendarDaysBetween(
      record.lastSearchDate,
      state.world.calendar.currentDate,
    ) >= AI_TRADE_SEARCH_MAX_STALE_DAYS
  );
}

/** Records today's search for each team with the inputs it should compare against next time. */
export function withTradeSearchesRecorded(
  state: GameState,
  searchKeys: ReadonlyMap<TeamId, string>,
): GameState {
  if (searchKeys.size === 0) {
    return state;
  }
  const date = state.world.calendar.currentDate;
  const byTeamId = { ...state.competition.aiTradeSearch.byTeamId };
  for (const [teamId, inputsKey] of searchKeys) {
    byTeamId[teamId] = { lastSearchDate: date, inputsKey };
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      aiTradeSearch: { byTeamId },
    },
  };
}

function hash64(value: string): string {
  return fnv1a32(value, 0x811c9dc5) + fnv1a32(value, 0x050c5d1f);
}

function fnv1a32(value: string, offset: number): string {
  let hash = offset;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Player History hub — derived from business.playerHistory season-end
 * snapshots plus business.awards and business.franchiseHistory. Never reads
 * current rosters for historical team membership.
 *
 * Championship credit uses the player's team-of-record at season end
 * (PlayerSeasonRecord.contractSnapshot.teamId), not every team the player
 * appeared for during that season. A player traded away from the eventual
 * champion earns no title that season; a player traded onto the champion
 * before season end does.
 */

import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getPlayerAwardCareerTotals,
  type PlayerAwardCareerTotalView,
} from "@/state/award-selectors";

export type PlayerHistoryIndexEntry = {
  playerId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  retired: boolean;
  seasonsPlayed: number;
  lastSeasonYear: number | null;
};

export type PlayerHistoryTeamStop = {
  seasonYear: number;
  teamId: string | null;
  /** Identity from that season's franchise snapshot when available. */
  teamName: string | null;
  championship: boolean;
};

export type PlayerHistoryView = {
  playerId: string;
  hasHistory: boolean;
  displayName: string;
  retired: boolean;
  /** Number of season-end snapshots. */
  seasonsPlayed: number;
  /** Distinct non-null season-end teams. */
  teamsPlayed: number;
  championships: number;
  championshipSeasons: number[];
  trackingStartedSeasonYear: number | null;
  teamSequence: PlayerHistoryTeamStop[];
  awardTotals: PlayerAwardCareerTotalView[];
  profileHref: string;
};

function resolvePlayerIdentity(
  state: GameState,
  playerId: string,
): {
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  retired: boolean;
} {
  const player = state.world.players[playerId];
  if (!player) {
    return {
      displayName: playerId,
      firstName: null,
      lastName: null,
      retired: false,
    };
  }
  return {
    displayName: `${player.firstName} ${player.lastName}`,
    firstName: player.firstName,
    lastName: player.lastName,
    retired: player.retired === true,
  };
}

function franchiseSeason(state: GameState, teamId: string, seasonYear: number) {
  return state.business.franchiseHistory[teamId]?.seasons.find(
    (season) => season.seasonYear === seasonYear,
  );
}

/** Searchable index built from playerHistory keys (retired players included). */
export function toPlayerHistoryIndex(
  state: GameState,
): PlayerHistoryIndexEntry[] {
  return Object.entries(state.business.playerHistory)
    .map(([playerId, history]) => {
      const identity = resolvePlayerIdentity(state, playerId);
      const years = history.seasons.map((season) => season.seasonYear);
      return {
        playerId,
        ...identity,
        seasonsPlayed: history.seasons.length,
        lastSeasonYear: years.length > 0 ? Math.max(...years) : null,
      };
    })
    .sort(
      (a, b) =>
        (a.lastName ?? a.displayName).localeCompare(
          b.lastName ?? b.displayName,
        ) ||
        a.displayName.localeCompare(b.displayName) ||
        a.playerId.localeCompare(b.playerId),
    );
}

/** Case-insensitive match on first, last, or full name; id only as fallback. */
export function filterPlayerHistoryIndex(
  index: readonly PlayerHistoryIndexEntry[],
  query: string,
): PlayerHistoryIndexEntry[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [...index];
  const nameMatches = index.filter((entry) =>
    [entry.firstName, entry.lastName, entry.displayName].some((value) =>
      value?.toLowerCase().includes(needle),
    ),
  );
  if (nameMatches.length > 0) return nameMatches;
  return index.filter((entry) => entry.playerId.toLowerCase().includes(needle));
}

export function toPlayerHistoryView(
  state: GameState,
  playerId: string,
): PlayerHistoryView {
  const identity = resolvePlayerIdentity(state, playerId);
  const history = state.business.playerHistory[playerId];
  const seasons = [...(history?.seasons ?? [])].sort(
    (a, b) => a.seasonYear - b.seasonYear,
  );

  const teamSequence: PlayerHistoryTeamStop[] = seasons.map((season) => {
    const teamId = season.contractSnapshot.teamId;
    const snapshot = teamId
      ? franchiseSeason(state, teamId, season.seasonYear)
      : undefined;
    const team = teamId ? state.world.teams[teamId] : undefined;
    return {
      seasonYear: season.seasonYear,
      teamId,
      teamName: snapshot
        ? `${snapshot.city} ${snapshot.name}`
        : team
          ? `${team.city} ${team.name}`
          : teamId,
      championship: snapshot?.championship === true,
    };
  });

  const championshipSeasons = teamSequence
    .filter((stop) => stop.championship)
    .map((stop) => stop.seasonYear);
  const distinctTeams = new Set(
    teamSequence
      .map((stop) => stop.teamId)
      .filter(
        (teamId): teamId is NonNullable<typeof teamId> => teamId !== null,
      ),
  );

  return {
    playerId,
    hasHistory: seasons.length > 0,
    displayName: identity.displayName,
    retired: identity.retired,
    seasonsPlayed: seasons.length,
    teamsPlayed: distinctTeams.size,
    championships: championshipSeasons.length,
    championshipSeasons,
    trackingStartedSeasonYear: history?.trackingStartedSeasonYear ?? null,
    teamSequence,
    awardTotals: getPlayerAwardCareerTotals(state, playerId as PlayerId),
    profileHref: `/dashboard/${state.meta.saveId}/players/${playerId}`,
  };
}

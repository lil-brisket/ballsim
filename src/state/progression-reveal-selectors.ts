/**
 * Progression reveal — how the owner's roster changed in the latest
 * end-of-season development. Compares each player's archived season record
 * (written before development ran) with their current attributes.
 * Pure and deterministic; never mutates state.
 */

import {
  PLAYER_ATTRIBUTE_KEYS,
  type PlayerAttributes,
  type PlayerPosition,
} from "@/domain/entities";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { formatAttributeLabel } from "@/presentation/player-rating-categories";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";

export type ProgressionAttributeMove = {
  key: keyof PlayerAttributes;
  label: string;
  before: number;
  after: number;
  delta: number;
};

export type ProgressionPlayerRow = {
  playerId: string;
  name: string;
  position: PlayerPosition;
  age: number;
  portrait: PlayerPortraitAssignment | null;
  before: number;
  after: number;
  delta: number;
  /** Up to 3 attributes with non-zero change, largest |delta| first, ties by key name. */
  topMoves: ProgressionAttributeMove[];
};

export type ProgressionLeagueRow = {
  playerId: string;
  name: string;
  teamId: string;
  teamAbbreviation: string;
  before: number;
  after: number;
  delta: number;
};

export type ProgressionRevealView = {
  /** Season whose end-of-season development is shown. */
  seasonYear: number;
  teamId: string;
  teamName: string;
  improved: number;
  declined: number;
  unchanged: number;
  averageBefore: number;
  averageAfter: number;
  averageDelta: number;
  /** delta !== 0: biggest jump first, biggest drop last. */
  changed: ProgressionPlayerRow[];
  /** delta === 0. */
  unchangedPlayers: ProgressionPlayerRow[];
  risers: ProgressionLeagueRow[];
  fallers: ProgressionLeagueRow[];
  /** Phase is offseason and the current season is finalized: this is news. */
  isCurrent: boolean;
};

const LEAGUE_LIST_SIZE = 5;
const TOP_MOVES = 3;

function isSeasonFinalized(state: GameState): boolean {
  const seasonId = state.competition.season.id;
  return Object.values(state.business.franchiseHistory).some((history) =>
    history.seasons.some((season) => season.seasonId === seasonId),
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function toProgressionRevealView(
  state: GameState,
  teamId?: string,
): ProgressionRevealView | null {
  const resolvedTeamId = teamId ?? getActiveOwnerTeamId(state);
  const team = state.world.teams[resolvedTeamId];
  if (!team) return null;

  const finalized = isSeasonFinalized(state);
  const seasonYear = finalized
    ? state.competition.season.year
    : state.competition.season.year - 1;

  function rowFor(playerId: string): ProgressionPlayerRow | null {
    const player = state.world.players[playerId];
    if (!player) return null;
    const record = state.business.playerHistory[playerId]?.seasons.find(
      (season) => season.seasonYear === seasonYear,
    );
    if (!record) return null;
    const after = calculatePlayerOverall(player.position, player.attributes);
    const moves: ProgressionAttributeMove[] = [];
    for (const key of PLAYER_ATTRIBUTE_KEYS) {
      const before = record.attributes[key];
      const now = player.attributes[key];
      if (typeof before !== "number" || typeof now !== "number") continue;
      if (before === now) continue;
      moves.push({
        key,
        label: formatAttributeLabel(key),
        before,
        after: now,
        delta: now - before,
      });
    }
    moves.sort(
      (a, b) =>
        Math.abs(b.delta) - Math.abs(a.delta) || compareText(a.key, b.key),
    );
    return {
      playerId,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      age: player.age,
      portrait: selectPlayerPortrait(state, playerId),
      before: record.overall,
      after,
      delta: after - record.overall,
      topMoves: moves.slice(0, TOP_MOVES),
    };
  }

  const rows: ProgressionPlayerRow[] = [];
  for (const playerId of team.roster) {
    const row = rowFor(playerId);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return null;

  const byName = (a: ProgressionPlayerRow, b: ProgressionPlayerRow) =>
    compareText(a.name, b.name) || compareText(a.playerId, b.playerId);

  const changed = rows
    .filter((row) => row.delta !== 0)
    .sort((a, b) => b.delta - a.delta || b.after - a.after || byName(a, b));
  const unchangedPlayers = rows
    .filter((row) => row.delta === 0)
    .sort((a, b) => b.after - a.after || byName(a, b));

  const meanBefore =
    rows.reduce((sum, row) => sum + row.before, 0) / rows.length;
  const meanAfter = rows.reduce((sum, row) => sum + row.after, 0) / rows.length;

  const league: ProgressionLeagueRow[] = [];
  for (const player of Object.values(state.world.players)) {
    if (player.retired || !player.teamId) continue;
    const record = state.business.playerHistory[player.id]?.seasons.find(
      (season) => season.seasonYear === seasonYear,
    );
    if (!record) continue;
    const leagueTeam = state.world.teams[player.teamId];
    const after = calculatePlayerOverall(player.position, player.attributes);
    league.push({
      playerId: player.id,
      name: `${player.firstName} ${player.lastName}`,
      teamId: player.teamId,
      teamAbbreviation: leagueTeam?.abbreviation ?? "",
      before: record.overall,
      after,
      delta: after - record.overall,
    });
  }
  const risers = league
    .filter((row) => row.delta > 0)
    .sort(
      (a, b) =>
        b.delta - a.delta ||
        b.after - a.after ||
        compareText(a.playerId, b.playerId),
    )
    .slice(0, LEAGUE_LIST_SIZE);
  const fallers = league
    .filter((row) => row.delta < 0)
    .sort(
      (a, b) =>
        a.delta - b.delta ||
        b.after - a.after ||
        compareText(a.playerId, b.playerId),
    )
    .slice(0, LEAGUE_LIST_SIZE);

  return {
    seasonYear,
    teamId: resolvedTeamId,
    teamName: `${team.city} ${team.name}`,
    improved: changed.filter((row) => row.delta > 0).length,
    declined: changed.filter((row) => row.delta < 0).length,
    unchanged: unchangedPlayers.length,
    averageBefore: round1(meanBefore),
    averageAfter: round1(meanAfter),
    averageDelta: round1(meanAfter - meanBefore),
    changed,
    unchangedPlayers,
    risers,
    fallers,
    isCurrent: state.competition.season.phase === "offseason" && finalized,
  };
}

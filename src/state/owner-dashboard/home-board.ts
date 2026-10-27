/**
 * Home tile board facts: the active owner team's best player, biggest
 * season-over-season riser and conference standing. Read-only presentation
 * selector; no RNG and no writes.
 */

import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { changeFromHistory } from "@/state/player-overall-change";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { toMyTeamStandingsContext } from "@/state/standings-selectors";

export type HomeBoardView = {
  topPlayer: {
    playerId: string;
    name: string;
    position: string;
    overall: number;
    portrait: PlayerPortraitAssignment | null;
  } | null;
  biggestRiser: {
    playerId: string;
    name: string;
    overall: number;
    delta: number;
  } | null;
  standing: {
    conferenceRank: number;
    conferenceName: string;
    gamesBack: number;
  } | null;
};

type Row = {
  playerId: string;
  name: string;
  position: string;
  overall: number;
  delta: number | null;
};

export function toHomeBoardView(state: GameState): HomeBoardView {
  const team = state.world.teams[getActiveOwnerTeamId(state)];
  const rows: Row[] = [];
  for (const playerId of team?.roster ?? []) {
    const player = state.world.players[playerId];
    if (!player) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    rows.push({
      playerId,
      name: `${player.firstName} ${player.lastName}`,
      position: player.position,
      overall,
      delta: changeFromHistory(state, playerId, overall).delta,
    });
  }

  const byId = (a: Row, b: Row) =>
    a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;

  const top = [...rows].sort((a, b) => b.overall - a.overall || byId(a, b))[0];
  const riser = rows
    .filter((row) => row.delta !== null && row.delta > 0)
    .sort(
      (a, b) =>
        (b.delta ?? 0) - (a.delta ?? 0) || b.overall - a.overall || byId(a, b),
    )[0];

  const standing = toMyTeamStandingsContext(state);

  return {
    topPlayer: top
      ? {
          playerId: top.playerId,
          name: top.name,
          position: top.position,
          overall: top.overall,
          portrait: selectPlayerPortrait(state, top.playerId),
        }
      : null,
    biggestRiser: riser
      ? {
          playerId: riser.playerId,
          name: riser.name,
          overall: riser.overall,
          delta: riser.delta ?? 0,
        }
      : null,
    standing: standing
      ? {
          conferenceRank: standing.conferenceRank,
          conferenceName: standing.conferenceName,
          gamesBack: standing.gamesBack,
        }
      : null,
  };
}

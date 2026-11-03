/**
 * Home tile board facts: the active owner team's best player, biggest
 * season-over-season riser and conference standing. Read-only presentation
 * selector; no RNG and no writes.
 */

import type { PlayerPosition } from "@/domain/entities/player";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { changeFromHistory } from "@/state/player-overall-change";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { toPayrollRulesView } from "@/state/payroll-rules-selectors";
import { toPlayoffHubView } from "@/state/playoff-hub-selectors";
import {
  toMyTeamStandingsContext,
  type PlayoffPositionLabel,
} from "@/state/standings-selectors";

export type HomeBoardView = {
  topPlayer: {
    playerId: string;
    name: string;
    position: string;
    secondaryPosition?: PlayerPosition | null;
    overall: number;
    portrait: PlayerPortraitAssignment | null;
  } | null;
  biggestRiser: {
    playerId: string;
    name: string;
    overall: number;
    delta: number;
    portrait: PlayerPortraitAssignment | null;
  } | null;
  /** Largest season-over-season drop on the roster; null when nobody fell. */
  biggestFaller: {
    playerId: string;
    name: string;
    overall: number;
    delta: number;
  } | null;
  standing: {
    conferenceRank: number;
    conferenceName: string;
    gamesBack: number;
    playoffLabel: PlayoffPositionLabel;
    streakLabel: string | null;
  } | null;
  /** Payroll against the luxury-tax line (null when the tax is off). */
  payroll: {
    payroll: number;
    taxLine: number | null;
    projectedTax: number;
  };
  /** The controlled team's active playoff series; null outside the playoffs. */
  playoffSeries: {
    roundLabel: string;
    opponentAbbreviation: string;
    teamWins: number;
    opponentWins: number;
  } | null;
};

function toPlayoffSeriesFact(state: GameState): HomeBoardView["playoffSeries"] {
  if (state.competition.season.phase !== "playoffs") return null;
  const teamId = getActiveOwnerTeamId(state);
  const hub = toPlayoffHubView(state);
  if (!hub.available) return null;
  for (const round of hub.rounds) {
    for (const series of round.series) {
      if (!series.involvesUser || series.status !== "active") continue;
      const isHigher = series.higherSeedTeamId === teamId;
      const opponentAbbreviation = isHigher
        ? series.lowerSeedAbbreviation
        : series.higherSeedAbbreviation;
      if (!opponentAbbreviation) continue;
      return {
        roundLabel: series.roundLabel,
        opponentAbbreviation,
        teamWins: isHigher ? series.higherWins : series.lowerWins,
        opponentWins: isHigher ? series.lowerWins : series.higherWins,
      };
    }
  }
  return null;
}

type Row = {
  playerId: string;
  name: string;
  position: string;
  secondaryPosition: PlayerPosition | null;
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
      secondaryPosition: player.secondaryPosition ?? null,
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

  const faller = rows
    .filter((row) => row.delta !== null && row.delta < 0)
    .sort(
      (a, b) =>
        (a.delta ?? 0) - (b.delta ?? 0) || b.overall - a.overall || byId(a, b),
    )[0];

  const standing = toMyTeamStandingsContext(state);
  const payroll = toPayrollRulesView(state);

  return {
    topPlayer: top
      ? {
          playerId: top.playerId,
          name: top.name,
          position: top.position,
          secondaryPosition: top.secondaryPosition,
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
          portrait: selectPlayerPortrait(state, riser.playerId),
        }
      : null,
    biggestFaller: faller
      ? {
          playerId: faller.playerId,
          name: faller.name,
          overall: faller.overall,
          delta: faller.delta ?? 0,
        }
      : null,
    payroll: {
      payroll: payroll.payroll,
      taxLine: payroll.luxuryTaxEnabled ? payroll.threshold : null,
      projectedTax: payroll.projectedTax,
    },
    standing: standing
      ? {
          conferenceRank: standing.conferenceRank,
          conferenceName: standing.conferenceName,
          gamesBack: standing.gamesBack,
          playoffLabel: standing.playoffLabel,
          streakLabel: standing.streakLabel,
        }
      : null,
    playoffSeries: toPlayoffSeriesFact(state),
  };
}

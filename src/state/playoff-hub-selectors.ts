/**
 * Playoff Hub presentation — read-only bracket from competition.playoffs.
 * Canonical user playoff status owned here.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  playoffRoundLabel,
  type PlayoffSeries,
} from "@/domain/entities/playoffs";

export type UserPlayoffStatus =
  | "not_in_playoffs"
  | "in_playoffs"
  | "eliminated"
  | "advanced"
  | "champion";

export type PlayoffSeriesView = {
  id: string;
  round: number;
  roundLabel: string;
  slot: number;
  status: string;
  higherSeed: number | null;
  lowerSeed: number | null;
  higherSeedTeamId: string | null;
  lowerSeedTeamId: string | null;
  higherSeedTeamName: string | null;
  lowerSeedTeamName: string | null;
  higherWins: number;
  lowerWins: number;
  winnerTeamId: string | null;
  gameIds: string[];
};

export type PlayoffRoundView = {
  round: number;
  label: string;
  series: PlayoffSeriesView[];
};

export type PlayoffHubView = {
  available: boolean;
  saveId: string;
  seasonYear: number;
  tournamentStatus: string;
  fieldSize: number;
  currentRoundLabel: string | null;
  userTeamId: string;
  userTeamName: string;
  userStatus: UserPlayoffStatus;
  championTeamId: string | null;
  championTeamName: string | null;
  rounds: PlayoffRoundView[];
};

function teamName(state: GameState, teamId: string | null): string | null {
  if (!teamId) return null;
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

export function resolveUserPlayoffStatus(
  state: GameState,
  teamId: string,
): UserPlayoffStatus {
  const playoffs = state.competition.playoffs;
  if (playoffs.championTeamId === teamId) {
    return "champion";
  }
  const qualified = playoffs.qualifiedTeams.some((q) => q.teamId === teamId);
  if (!qualified) {
    return "not_in_playoffs";
  }
  if (playoffs.status === "not_started") {
    return "in_playoffs";
  }

  const teamSeries = playoffs.series.filter(
    (s) =>
      s.higherSeedTeamId === teamId || s.lowerSeedTeamId === teamId,
  );
  const lostComplete = teamSeries.some(
    (s) =>
      s.status === "complete" &&
      s.winnerTeamId != null &&
      s.winnerTeamId !== teamId,
  );
  if (lostComplete) {
    return "eliminated";
  }

  const wonComplete = teamSeries.some(
    (s) => s.status === "complete" && s.winnerTeamId === teamId,
  );
  const stillActive = teamSeries.some((s) => s.status === "active");
  if (wonComplete && !stillActive && playoffs.status === "in_progress") {
    return "advanced";
  }
  return "in_playoffs";
}

function toSeriesView(
  state: GameState,
  series: PlayoffSeries,
  fieldSize: number,
): PlayoffSeriesView {
  let roundLabel = `Round ${series.round + 1}`;
  try {
    roundLabel = playoffRoundLabel(series.round, fieldSize).replaceAll(
      "_",
      " ",
    );
  } catch {
    // fieldSize may be invalid mid-migration — keep fallback label
  }
  const higherId = series.higherSeedTeamId;
  const lowerId = series.lowerSeedTeamId;
  return {
    id: series.id,
    round: series.round,
    roundLabel,
    slot: series.slot,
    status: series.status,
    higherSeed: series.higherSeed,
    lowerSeed: series.lowerSeed,
    higherSeedTeamId: higherId,
    lowerSeedTeamId: lowerId,
    higherSeedTeamName: teamName(state, higherId),
    lowerSeedTeamName: teamName(state, lowerId),
    higherWins: higherId ? (series.wins[higherId] ?? 0) : 0,
    lowerWins: lowerId ? (series.wins[lowerId] ?? 0) : 0,
    winnerTeamId: series.winnerTeamId ?? null,
    gameIds: [...series.gameIds],
  };
}

export function toPlayoffHubView(state: GameState): PlayoffHubView {
  const saveId = state.meta.saveId;
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const playoffs = state.competition.playoffs;
  const available =
    playoffs.status !== "not_started" && playoffs.fieldSize > 0;

  const seriesViews = playoffs.series
    .map((s) => toSeriesView(state, s, playoffs.fieldSize))
    .sort((a, b) => a.round - b.round || a.slot - b.slot);

  const roundMap = new Map<number, PlayoffSeriesView[]>();
  for (const series of seriesViews) {
    const list = roundMap.get(series.round) ?? [];
    list.push(series);
    roundMap.set(series.round, list);
  }

  const rounds: PlayoffRoundView[] = [...roundMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, series]) => ({
      round,
      label: series[0]?.roundLabel ?? `Round ${round + 1}`,
      series,
    }));

  const activeRound = seriesViews.find((s) => s.status === "active");
  const currentRoundLabel =
    activeRound?.roundLabel ??
    (playoffs.status === "complete" ? "Complete" : null);

  return {
    available,
    saveId,
    seasonYear: state.competition.season.year,
    tournamentStatus: playoffs.status,
    fieldSize: playoffs.fieldSize,
    currentRoundLabel,
    userTeamId: teamId,
    userTeamName: team ? `${team.city} ${team.name}` : "Team",
    userStatus: resolveUserPlayoffStatus(state, teamId),
    championTeamId: playoffs.championTeamId ?? null,
    championTeamName: teamName(state, playoffs.championTeamId ?? null),
    rounds: available ? rounds : [],
  };
}

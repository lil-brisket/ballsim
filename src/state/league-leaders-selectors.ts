/**
 * League-wide player statistical leaders for the standings hub.
 * Presentation-only; never mutates simulation state.
 */

import type { GameState } from "@/state/game-state";
import {
  aggregateAllPlayersInGames,
  getPrimaryLeagueFinalGames,
  type PeriodPlayerAgg,
} from "@/systems/awards/award-stat-sources";

export const LEAGUE_LEADER_STAT_KEYS = [
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "fgPct",
] as const;

export type LeagueLeaderStatKey = (typeof LEAGUE_LEADER_STAT_KEYS)[number];

export type LeagueLeaderEntry = {
  playerId: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
  teamAbbreviation: string | null;
  value: number;
};

export type LeagueLeaderCard = {
  key: LeagueLeaderStatKey;
  label: string;
  leader: LeagueLeaderEntry | null;
};

export type LeagueLeadersView = {
  minGames: number;
  minFgAttempts: number;
  cards: LeagueLeaderCard[];
  allEmpty: boolean;
};

const STAT_LABELS: Record<LeagueLeaderStatKey, string> = {
  ppg: "PPG",
  rpg: "RPG",
  apg: "APG",
  spg: "SPG",
  bpg: "BPG",
  fgPct: "FG%",
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function maxTeamGamesPlayed(state: GameState): number {
  let max = 0;
  for (const standing of Object.values(state.competition.standings.byTeamId)) {
    max = Math.max(max, standing.wins + standing.losses);
  }
  return max;
}

function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}

function identityFor(
  state: GameState,
  agg: PeriodPlayerAgg,
): Pick<
  LeagueLeaderEntry,
  "playerId" | "firstName" | "lastName" | "teamId" | "teamAbbreviation"
> {
  const player = state.world.players[agg.playerId];
  const team = agg.teamId ? state.world.teams[agg.teamId] : undefined;
  return {
    playerId: agg.playerId,
    firstName: player?.firstName ?? "Player",
    lastName: player?.lastName ?? "",
    teamId: agg.teamId,
    teamAbbreviation: team?.abbreviation ?? null,
  };
}

function pickLeader(
  qualified: PeriodPlayerAgg[],
  rateOf: (agg: PeriodPlayerAgg) => number,
  totalOf: (agg: PeriodPlayerAgg) => number,
  state: GameState,
): LeagueLeaderEntry | null {
  if (qualified.length === 0) {
    return null;
  }
  const sorted = [...qualified].sort((a, b) => {
    const rateDiff = rateOf(b) - rateOf(a);
    if (rateDiff !== 0) {
      return rateDiff;
    }
    const totalDiff = totalOf(b) - totalOf(a);
    if (totalDiff !== 0) {
      return totalDiff;
    }
    return a.playerId.localeCompare(b.playerId);
  });
  const winner = sorted[0]!;
  return {
    ...identityFor(state, winner),
    value: rateOf(winner),
  };
}

export function toLeagueLeadersView(state: GameState): LeagueLeadersView {
  const maxGp = maxTeamGamesPlayed(state);
  const minGames = maxGp === 0 ? 1 : Math.max(1, Math.ceil(maxGp * 0.5));
  const minFgAttempts = Math.max(1, minGames * 3);

  const emptyCards: LeagueLeaderCard[] = LEAGUE_LEADER_STAT_KEYS.map((key) => ({
    key,
    label: STAT_LABELS[key],
    leader: null,
  }));

  if (maxGp === 0) {
    return {
      minGames,
      minFgAttempts,
      cards: emptyCards,
      allEmpty: true,
    };
  }

  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  const aggs = aggregateAllPlayersInGames(games);
  const qualified = aggs.filter((agg) => agg.games >= minGames);
  const fgQualified = qualified.filter(
    (agg) => agg.totals.fgAttempted >= minFgAttempts,
  );

  const cards: LeagueLeaderCard[] = [
    {
      key: "ppg",
      label: STAT_LABELS.ppg,
      leader: pickLeader(
        qualified,
        (agg) => round1(perGame(agg.totals.points, agg.games)),
        (agg) => agg.totals.points,
        state,
      ),
    },
    {
      key: "rpg",
      label: STAT_LABELS.rpg,
      leader: pickLeader(
        qualified,
        (agg) => round1(perGame(agg.totals.rebounds, agg.games)),
        (agg) => agg.totals.rebounds,
        state,
      ),
    },
    {
      key: "apg",
      label: STAT_LABELS.apg,
      leader: pickLeader(
        qualified,
        (agg) => round1(perGame(agg.totals.assists, agg.games)),
        (agg) => agg.totals.assists,
        state,
      ),
    },
    {
      key: "spg",
      label: STAT_LABELS.spg,
      leader: pickLeader(
        qualified,
        (agg) => round1(perGame(agg.totals.steals, agg.games)),
        (agg) => agg.totals.steals,
        state,
      ),
    },
    {
      key: "bpg",
      label: STAT_LABELS.bpg,
      leader: pickLeader(
        qualified,
        (agg) => round1(perGame(agg.totals.blocks, agg.games)),
        (agg) => agg.totals.blocks,
        state,
      ),
    },
    {
      key: "fgPct",
      label: STAT_LABELS.fgPct,
      leader: pickLeader(
        fgQualified,
        (agg) =>
          agg.totals.fgAttempted > 0
            ? round1((agg.totals.fgMade / agg.totals.fgAttempted) * 100)
            : 0,
        (agg) => agg.totals.fgAttempted,
        state,
      ),
    },
  ];

  return {
    minGames,
    minFgAttempts,
    cards,
    allEmpty: cards.every((card) => card.leader == null),
  };
}

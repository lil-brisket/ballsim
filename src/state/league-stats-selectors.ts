/**
 * League page Team Stats and Player Stats tables (Issue #184).
 * Regular-season primary-league games only. Presentation-only; never mutates
 * simulation state.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { firstSearchParam } from "@/state/standings-page-params";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import {
  aggregateAllPlayersInGames,
  getPrimaryLeagueFinalGames,
} from "@/systems/awards/award-stat-sources";

export type SortDirection = "asc" | "desc";

export const TEAM_STAT_KEYS = [
  "gp",
  "winPct",
  "ppg",
  "oppPpg",
  "net",
  "fgPct",
  "threePct",
  "ftPct",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "tov",
] as const;

export type TeamStatKey = (typeof TEAM_STAT_KEYS)[number];

export const PLAYER_STAT_KEYS = [
  "gp",
  "mpg",
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "tov",
  "fgPct",
  "threePct",
  "ftPct",
] as const;

export type PlayerStatKey = (typeof PLAYER_STAT_KEYS)[number];

/** Stats where a lower value ranks first. */
const ASCENDING_FIRST = new Set<string>(["oppPpg", "tov"]);

/** Rows shown before "Show all" on the Player Stats tab. */
export const PLAYER_STATS_PAGE_SIZE = 50;

export type LeagueStatsSort<K extends string> = {
  key: K;
  dir: SortDirection;
};

export type TeamStatsRow = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
  isUserTeam: boolean;
  /** Stat values; percentages are 0-100, null when no attempts. */
  values: Record<TeamStatKey, number | null>;
};

export type TeamStatsView = {
  sort: LeagueStatsSort<TeamStatKey>;
  rows: TeamStatsRow[];
  gamesPlayed: number;
};

export type PlayerStatsRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
  teamAbbreviation: string | null;
  isUserTeam: boolean;
  values: Record<PlayerStatKey, number | null>;
};

export type PlayerStatsView = {
  sort: LeagueStatsSort<PlayerStatKey>;
  rows: PlayerStatsRow[];
  /** Qualified players before the page-size cut. */
  totalQualified: number;
  showAll: boolean;
  minGames: number;
  /** Minimum attempts per game played for a shooting-percentage sort. */
  minAttemptsPerGame: number;
};

function defaultDir(key: string): SortDirection {
  return ASCENDING_FIRST.has(key) ? "asc" : "desc";
}

export function parseLeagueStatsSort<K extends string>(
  search: { sort?: string | string[]; dir?: string | string[] },
  keys: readonly K[],
  fallback: K,
): LeagueStatsSort<K> {
  const rawKey = firstSearchParam(search.sort);
  const key =
    rawKey != null && (keys as readonly string[]).includes(rawKey)
      ? (rawKey as K)
      : fallback;
  const rawDir = firstSearchParam(search.dir);
  const dir: SortDirection =
    rawDir === "asc" || rawDir === "desc" ? rawDir : defaultDir(key);
  return { key, dir };
}

/**
 * Href for a sortable column header: picks the column with its natural
 * direction, or flips the direction when it is already active.
 */
export function buildLeagueStatsSortHref(input: {
  pathname: string;
  current: LeagueStatsSort<string>;
  key: string;
  extra?: Record<string, string>;
}): string {
  const params = new URLSearchParams(input.extra);
  const natural = defaultDir(input.key);
  const dir =
    input.current.key === input.key
      ? input.current.dir === "asc"
        ? "desc"
        : "asc"
      : natural;
  params.set("sort", input.key);
  if (dir !== natural) {
    params.set("dir", dir);
  }
  return `${input.pathname}?${params.toString()}`;
}

function rate(total: number, games: number): number | null {
  return games > 0 ? Math.round((total / games) * 10) / 10 : null;
}

function pct(made: number, attempted: number): number | null {
  return attempted > 0 ? Math.round((made / attempted) * 1000) / 10 : null;
}

function compareValues(
  a: number | null,
  b: number | null,
  dir: SortDirection,
): number {
  // Missing values always sink, whatever the direction.
  if (a == null || b == null) {
    return a == null ? (b == null ? 0 : 1) : -1;
  }
  return dir === "asc" ? a - b : b - a;
}

type TeamTotals = {
  games: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};

function emptyTotals(): TeamTotals {
  return {
    games: 0,
    wins: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    fgMade: 0,
    fgAttempted: 0,
    threeMade: 0,
    threeAttempted: 0,
    ftMade: 0,
    ftAttempted: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
  };
}

export function toTeamStatsView(
  state: GameState,
  sort: LeagueStatsSort<TeamStatKey>,
): TeamStatsView {
  const userTeamId = getActiveOwnerTeamId(state);
  const totals = new Map<string, TeamTotals>();
  for (const teamId of Object.keys(state.competition.standings.byTeamId)) {
    totals.set(teamId, emptyTotals());
  }

  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  for (const game of games) {
    const sides = [
      { teamId: game.homeTeamId, for: game.score.home, vs: game.score.away },
      { teamId: game.awayTeamId, for: game.score.away, vs: game.score.home },
    ];
    for (const side of sides) {
      const acc = totals.get(side.teamId);
      if (!acc) continue;
      acc.games += 1;
      acc.wins += side.for > side.vs ? 1 : 0;
      acc.pointsFor += side.for;
      acc.pointsAgainst += side.vs;
    }
    for (const row of game.playerStats) {
      const acc = row.teamId ? totals.get(row.teamId) : undefined;
      if (!acc) continue;
      acc.fgMade += row.fieldGoalsMade;
      acc.fgAttempted += row.fieldGoalsAttempted;
      acc.threeMade += row.threePointersMade;
      acc.threeAttempted += row.threePointersAttempted;
      acc.ftMade += row.freeThrowsMade;
      acc.ftAttempted += row.freeThrowsAttempted;
      acc.rebounds += row.rebounds;
      acc.assists += row.assists;
      acc.steals += row.steals;
      acc.blocks += row.blocks;
      acc.turnovers += row.turnovers;
    }
  }

  const rows: TeamStatsRow[] = [];
  let gamesPlayed = 0;
  for (const [teamId, acc] of totals) {
    const team = state.world.teams[teamId];
    if (!team) continue;
    gamesPlayed = Math.max(gamesPlayed, acc.games);
    const ppg = rate(acc.pointsFor, acc.games);
    const oppPpg = rate(acc.pointsAgainst, acc.games);
    rows.push({
      teamId,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
      branding: toBrandingView(team.branding),
      isUserTeam: teamId === userTeamId,
      values: {
        gp: acc.games,
        winPct:
          acc.games > 0
            ? Math.round((acc.wins / acc.games) * 1000) / 1000
            : null,
        ppg,
        oppPpg,
        net: rate(acc.pointsFor - acc.pointsAgainst, acc.games),
        fgPct: pct(acc.fgMade, acc.fgAttempted),
        threePct: pct(acc.threeMade, acc.threeAttempted),
        ftPct: pct(acc.ftMade, acc.ftAttempted),
        rpg: rate(acc.rebounds, acc.games),
        apg: rate(acc.assists, acc.games),
        spg: rate(acc.steals, acc.games),
        bpg: rate(acc.blocks, acc.games),
        tov: rate(acc.turnovers, acc.games),
      },
    });
  }

  rows.sort(
    (a, b) =>
      compareValues(a.values[sort.key], b.values[sort.key], sort.dir) ||
      a.abbreviation.localeCompare(b.abbreviation),
  );

  return { sort, rows, gamesPlayed };
}

const SHOOTING_ATTEMPTS: Partial<
  Record<PlayerStatKey, "fgAttempted" | "threeAttempted" | "ftAttempted">
> = {
  fgPct: "fgAttempted",
  threePct: "threeAttempted",
  ftPct: "ftAttempted",
};

export function toPlayerStatsView(
  state: GameState,
  options: { sort: LeagueStatsSort<PlayerStatKey>; showAll: boolean },
): PlayerStatsView {
  const { sort } = options;
  const userTeamId = getActiveOwnerTeamId(state);
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });

  let maxGp = 0;
  for (const standing of Object.values(state.competition.standings.byTeamId)) {
    maxGp = Math.max(maxGp, standing.wins + standing.losses);
  }
  // Same qualifier as League Leaders: half the most games any team has played.
  const minGames = Math.max(1, Math.ceil(maxGp * 0.5));
  const minAttemptsPerGame = 1;

  const attemptsKey = SHOOTING_ATTEMPTS[sort.key];
  const qualified = aggregateAllPlayersInGames(games).filter(
    (agg) =>
      agg.games >= minGames &&
      (attemptsKey == null ||
        agg.totals[attemptsKey] >= agg.games * minAttemptsPerGame),
  );

  const rows: PlayerStatsRow[] = qualified.map((agg) => {
    const player = state.world.players[agg.playerId];
    const team = agg.teamId ? state.world.teams[agg.teamId] : undefined;
    const t = agg.totals;
    return {
      playerId: agg.playerId,
      firstName: player?.firstName ?? "Player",
      lastName: player?.lastName ?? "",
      teamId: agg.teamId,
      teamAbbreviation: team?.abbreviation ?? null,
      isUserTeam: agg.teamId != null && agg.teamId === userTeamId,
      values: {
        gp: agg.games,
        mpg: rate(t.minutes, agg.games),
        ppg: rate(t.points, agg.games),
        rpg: rate(t.rebounds, agg.games),
        apg: rate(t.assists, agg.games),
        spg: rate(t.steals, agg.games),
        bpg: rate(t.blocks, agg.games),
        tov: rate(t.turnovers, agg.games),
        fgPct: pct(t.fgMade, t.fgAttempted),
        threePct: pct(t.threeMade, t.threeAttempted),
        ftPct: pct(t.ftMade, t.ftAttempted),
      },
    };
  });

  rows.sort(
    (a, b) =>
      compareValues(a.values[sort.key], b.values[sort.key], sort.dir) ||
      a.playerId.localeCompare(b.playerId),
  );

  return {
    sort,
    rows: options.showAll ? rows : rows.slice(0, PLAYER_STATS_PAGE_SIZE),
    totalQualified: rows.length,
    showAll: options.showAll,
    minGames,
    minAttemptsPerGame,
  };
}

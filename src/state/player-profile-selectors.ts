import type { Game, GamePlayerStats } from "@/domain/entities/game";
import type {
  PlayerAttributes,
  PlayerPosition,
} from "@/domain/entities/player";
import {
  type PlayerHistory,
  type PlayerSeasonRecord,
  type PlayerSeasonStatLine,
  type PlayerTeamStint,
} from "@/domain/entities/player-history";
import {
  getContractSalaryForYear,
  getContractStatus,
} from "@/domain/entities/contract";
import {
  derivePlayerStrengthsWeaknesses,
  topAttributesByPosition,
  type PlayerAttributeEvaluation,
} from "@/domain/player-evaluation";
import type { PlayerId, SeasonId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getAllFinalGames,
  getPlayerFinalGames,
  getPlayerSeasonGames,
} from "@/state/game-access";
import { getTeamPayroll } from "@/systems/salary-cap";
import {
  toPlayerAwardsView,
  type PlayerAwardCareerTotalView,
  type PlayerAwardRowView,
} from "@/state/award-selectors";
import type { PlayerDetailView } from "@/state/selectors";
import {
  toBrandingView,
  type TeamBrandingView,
} from "@/state/team-branding-view";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";
import { isDevelopmentLeagueEligible } from "@/systems/development-league/eligibility";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";
import {
  getDevelopmentReadiness,
  getDlAssignmentExplanation,
  getPromotionExplanation,
} from "@/systems/development-league/recommendations";
import { getDevelopmentLeagueSeasonsRemaining } from "@/domain/entities/development-league";
import { getControlledTeam } from "@/state/selectors";
import {
  accumulatePlayerStatLine,
  addPlayerStatLines,
  aggregatePlayerGames,
  createEmptyPlayerStatLine,
  classifyCompetition,
  isTopLeagueStatGame,
  type PlayerStatBuckets,
  type PlayerStatLine,
} from "@/domain/player-stat-aggregation";

export type CareerHighStatKey =
  | "points"
  | "rebounds"
  | "assists"
  | "steals"
  | "blocks"
  | "threeMade"
  | "minutes"
  | "fgMade"
  | "fgAttempted"
  | "ftMade"
  | "threeAttempted";

export const CAREER_HIGH_STAT_KEYS: readonly CareerHighStatKey[] = [
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "threeMade",
  "minutes",
  "fgMade",
  "fgAttempted",
  "ftMade",
  "threeAttempted",
] as const;

export type CareerHighView = {
  stat: CareerHighStatKey;
  value: number;
  gameId: string;
  date: string;
  opponentAbbreviation: string;
  opponentBranding: TeamBrandingView | null;
  teamAbbreviation: string;
  seasonYear: number;
};

export type BestSeasonView = {
  kind: "scoring" | "rebounding" | "playmaking" | "overall";
  label: string;
  seasonYear: number;
  value: number;
  valueLabel: string;
};

export type TrendPoint = {
  season: number;
  value: number | null;
};

export type PlayerGameLogRowView = {
  gameId: string;
  date: string;
  seasonYear: number;
  competitionType: string;
  opponentAbbreviation: string;
  opponentBranding: TeamBrandingView | null;
  home: boolean;
  won: boolean | null;
  teamScore: number | null;
  opponentScore: number | null;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
};

export type RecentFormView = {
  last5: PlayerSeasonStatLine | null;
  last10: PlayerSeasonStatLine | null;
  seasonAverages: {
    ppg: number;
    rpg: number;
    apg: number;
    mpg: number;
  } | null;
  last5Averages: {
    ppg: number;
    rpg: number;
    apg: number;
    mpg: number;
  } | null;
};

export type PlayerContractProfileView = {
  contractId: string;
  salary: number | null;
  startYear: number;
  endYear: number;
  yearsRemaining: number;
  status: string;
  salaryByYear: Array<{ year: number; salary: number }>;
  totalRemainingValue: number;
  teamPayroll: number | null;
  payrollPercent: number | null;
  hasPendingTeamOption: boolean;
  hasPendingPlayerOption: boolean;
};

export type SeasonAveragesView = {
  games: number;
  /** Pre-v57 box scores never record a start, so older seasons undercount. */
  gamesStarted: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  orpg: number;
  drpg: number;
  pfpg: number;
  doubleDoubles: number;
  tripleDoubles: number;
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
};

/**
 * One season of a player's stats. Lines are summed from box scores when the
 * season's games are archived ("games"); otherwise they fall back to the
 * season-end snapshot ("snapshot"), which lacks GS, ORB/DRB, PF, DD and TD.
 */
export type PlayerSeasonStatsView = {
  seasonId: string;
  seasonYear: number;
  current: boolean;
  /** Season-end age/OVR from the snapshot; live values for the current season. */
  age: number | null;
  overall: number | null;
  source: "games" | "snapshot";
  regular: PlayerStatLine;
  playoffs: PlayerStatLine;
  development: PlayerStatLine;
  combined: PlayerStatLine;
};

export type PlayerCareerStatsView = {
  regular: PlayerStatLine;
  playoffs: PlayerStatLine;
  development: PlayerStatLine;
  combined: PlayerStatLine;
  /** False when a snapshot-only season leaves GS/ORB/DRB/PF/DD/TD incomplete. */
  extendedColumnsComplete: boolean;
};

/** Statistics data shared by the player card and the full profile page. */
export type PlayerStatsBundle = {
  currentSeasonId: string;
  /** Oldest first; includes the current season once it has games. */
  seasons: PlayerSeasonStatsView[];
  career: PlayerCareerStatsView;
  /** Current season only; fetch other seasons with fetchPlayerGameSeriesAction. */
  currentSeasonGames: PlayerGameSeriesPoint[];
};

/** Development data shared by the player card and the full profile page. */
export type PlayerDevelopmentBundle = {
  /** Actual ratings only — no projections. */
  ratingHistory: PlayerRatingHistoryPoint[];
  trackingStartedSeasonYear: number | null;
};

export type PlayerProfileView = PlayerDetailView & {
  stats: PlayerStatsBundle;
  development: PlayerDevelopmentBundle;
  seasonStatLine: PlayerSeasonStatLine;
  seasonAverages: SeasonAveragesView | null;
  playoffStatLine: PlayerSeasonStatLine;
  regularStatLine: PlayerSeasonStatLine;
  strengths: PlayerAttributeEvaluation[];
  weaknesses: PlayerAttributeEvaluation[];
  keyAttributes: Array<{
    attribute: keyof PlayerAttributes;
    rating: number;
    weight: number;
  }>;
  recentForm: RecentFormView;
  gameLog: PlayerGameLogRowView[];
  seasonHistory: PlayerSeasonRecord[];
  teamStints: PlayerTeamStint[];
  careerHighs: CareerHighView[];
  bestSeasons: BestSeasonView[];
  /** Oldest first, including the current season once it has games or a snapshot. */
  seasonLines: PlayerSeasonStatsView[];
  career: PlayerCareerStatsView;
  /** Top-league career totals (career.combined). */
  careerTotals: PlayerStatLine;
  careerAverages: SeasonAveragesView | null;
  contractProfile: PlayerContractProfileView | null;
  trackingStartedSeasonYear: number | null;
  currentSeasonYear: number;
  attributeDevelopment: Record<string, TrendPoint[]>;
  overallTrend: TrendPoint[];
  trendSeries: Record<string, TrendPoint[]>;
  developmentLeague: {
    assigned: boolean;
    canAssign: boolean;
    canRecall: boolean;
    statusLabel: string | null;
    readinessLabel: string | null;
    whyBullets: string[];
    seasonsUsed: number;
    seasonsRemaining: number;
    role: string | null;
    developmentStatLine: PlayerSeasonStatLine;
  };
  awards: PlayerAwardRowView[];
  awardCareerTotals: PlayerAwardCareerTotalView[];
};

function seasonYearFromId(seasonId: SeasonId, fallbackYear: number): number {
  const match = /^season_(\d+)$/.exec(seasonId);
  if (match) {
    return Number(match[1]);
  }
  return fallbackYear;
}

function statValueFromRow(
  row: GamePlayerStats,
  stat: CareerHighStatKey,
): number {
  switch (stat) {
    case "points":
      return row.points;
    case "rebounds":
      return row.rebounds;
    case "assists":
      return row.assists;
    case "steals":
      return row.steals;
    case "blocks":
      return row.blocks;
    case "threeMade":
      return row.threePointersMade;
    case "minutes":
      return row.minutes;
    case "fgMade":
      return row.fieldGoalsMade;
    case "fgAttempted":
      return row.fieldGoalsAttempted;
    case "ftMade":
      return row.freeThrowsMade;
    case "threeAttempted":
      return row.threePointersAttempted;
  }
}

function averagesFromLine(line: PlayerStatLine): SeasonAveragesView | null {
  if (line.games === 0) {
    return null;
  }
  const g = line.games;
  return {
    games: g,
    gamesStarted: line.gamesStarted,
    mpg: round1(line.minutes / g),
    ppg: round1(line.points / g),
    rpg: round1(line.rebounds / g),
    apg: round1(line.assists / g),
    spg: round1(line.steals / g),
    bpg: round1(line.blocks / g),
    topg: round1(line.turnovers / g),
    orpg: round1(line.offensiveRebounds / g),
    drpg: round1(line.defensiveRebounds / g),
    pfpg: round1(line.fouls / g),
    doubleDoubles: line.doubleDoubles,
    tripleDoubles: line.tripleDoubles,
    fgPct: pct(line.fgMade, line.fgAttempted),
    threePct: pct(line.threeMade, line.threeAttempted),
    ftPct: pct(line.ftMade, line.ftAttempted),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(made: number, attempted: number): number | null {
  if (attempted === 0) return null;
  return Math.round((made / attempted) * 1000) / 10;
}

function resolveGameTeamIdentity(
  state: GameState,
  game: Game,
  teamId: string,
): {
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
} {
  const isHome = teamId === game.homeTeamId;
  const snapshot = isHome ? game.homeTeamSnapshot : game.awayTeamSnapshot;
  if (snapshot) {
    // Snapshot is authoritative for historical games — never substitute live branding.
    const fromSnapshot = toBrandingView(snapshot.branding);
    return {
      city: snapshot.city,
      name: snapshot.name,
      abbreviation: snapshot.abbreviation,
      branding:
        fromSnapshot ??
        toBrandingView(
          deriveDefaultTeamBranding(
            snapshot.teamId,
            snapshot.city,
            snapshot.name,
          ),
        ),
    };
  }
  const live = state.world.teams[teamId];
  const fromLive = toBrandingView(live?.branding);
  return {
    city: live?.city ?? "Unknown",
    name: live?.name ?? "Team",
    abbreviation: live?.abbreviation ?? "???",
    branding:
      fromLive ??
      toBrandingView(
        deriveDefaultTeamBranding(teamId, live?.city ?? "", live?.name ?? ""),
      ),
  };
}

function playerTeamIdInGame(game: Game, playerId: PlayerId): string | null {
  const row = game.playerStats.find((stat) => stat.playerId === playerId);
  if (!row) return null;
  if (row.teamId) return row.teamId;
  return null;
}

export function aggregatePlayerSeasonStats(
  state: GameState,
  playerId: PlayerId,
  seasonId?: SeasonId,
): PlayerStatBuckets {
  const targetSeasonId = seasonId ?? state.competition.season.id;
  return aggregatePlayerGames(
    getPlayerSeasonGames(state, playerId, targetSeasonId),
    playerId,
  );
}

export function derivePlayerTeamStints(
  state: GameState,
  playerId: PlayerId,
): PlayerTeamStint[] {
  const games = getPlayerFinalGames(state, playerId).filter(
    isTopLeagueStatGame,
  );
  const bySeasonTeam = new Map<
    string,
    { teamId: string; seasonYear: number; games: number }
  >();

  for (const game of games) {
    const teamId = playerTeamIdInGame(game, playerId);
    if (!teamId) continue;
    const seasonYear = seasonYearFromId(
      game.seasonId,
      state.competition.season.year,
    );
    const key = `${seasonYear}:${teamId}`;
    const existing = bySeasonTeam.get(key);
    if (existing) {
      existing.games += 1;
    } else {
      bySeasonTeam.set(key, { teamId, seasonYear, games: 1 });
    }
  }

  const stints: PlayerTeamStint[] = [];
  for (const entry of bySeasonTeam.values()) {
    const team = state.world.teams[entry.teamId];
    // Prefer snapshot from any game this season for this team
    let city = team?.city ?? "Unknown";
    let name = team?.name ?? "Team";
    for (const game of games) {
      const year = seasonYearFromId(
        game.seasonId,
        state.competition.season.year,
      );
      if (year !== entry.seasonYear) continue;
      const identity = resolveGameTeamIdentity(state, game, entry.teamId);
      if (identity.city !== "Unknown") {
        city = identity.city;
        name = identity.name;
        break;
      }
    }
    stints.push({
      teamId: entry.teamId as PlayerTeamStint["teamId"],
      teamCity: city,
      teamName: name,
      games: entry.games,
      seasonYear: entry.seasonYear,
    });
  }

  stints.sort((a, b) => a.seasonYear - b.seasonYear || b.games - a.games);
  return stints;
}

export function deriveCareerHighs(
  state: GameState,
  playerId: PlayerId,
): CareerHighView[] {
  const games = getPlayerFinalGames(state, playerId).filter(
    isTopLeagueStatGame,
  );
  const best = new Map<CareerHighStatKey, CareerHighView>();

  for (const game of games) {
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    const teamId = row.teamId ?? playerTeamIdInGame(game, playerId);
    const opponentId =
      teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    const teamIdentity = teamId
      ? resolveGameTeamIdentity(state, game, teamId)
      : { abbreviation: "???", branding: null as TeamBrandingView | null };
    const oppIdentity = resolveGameTeamIdentity(state, game, opponentId);
    const seasonYear = seasonYearFromId(
      game.seasonId,
      state.competition.season.year,
    );

    for (const stat of CAREER_HIGH_STAT_KEYS) {
      const value = statValueFromRow(row, stat);
      const prior = best.get(stat);
      if (!prior || value > prior.value) {
        best.set(stat, {
          stat,
          value,
          gameId: game.id,
          date: game.date,
          opponentAbbreviation: oppIdentity.abbreviation,
          opponentBranding: oppIdentity.branding,
          teamAbbreviation: teamIdentity.abbreviation,
          seasonYear,
        });
      }
    }
  }

  return CAREER_HIGH_STAT_KEYS.map((key) => best.get(key)).filter(
    (entry): entry is CareerHighView => entry !== undefined && entry.value > 0,
  );
}

export function deriveBestSeasons(
  seasons: readonly PlayerSeasonStatsView[],
): BestSeasonView[] {
  type Candidate = {
    seasonYear: number;
    overall: number;
    ppg: number;
    rpg: number;
    apg: number;
  };

  // The in-progress season only competes once it has games.
  const candidates: Candidate[] = seasons
    .filter((season) => !season.current || season.combined.games > 0)
    .map((season) => {
      const line = season.combined;
      const g = line.games;
      return {
        seasonYear: season.seasonYear,
        overall: season.overall ?? 0,
        ppg: g > 0 ? line.points / g : 0,
        rpg: g > 0 ? line.rebounds / g : 0,
        apg: g > 0 ? line.assists / g : 0,
      };
    });

  if (candidates.length === 0) {
    return [];
  }

  const bestBy = (
    kind: BestSeasonView["kind"],
    label: string,
    pick: (c: Candidate) => number,
    format: (v: number) => string,
  ): BestSeasonView | null => {
    let best = candidates[0]!;
    for (const c of candidates) {
      if (pick(c) > pick(best)) best = c;
    }
    const value = pick(best);
    if (value <= 0 && kind !== "overall") return null;
    return {
      kind,
      label,
      seasonYear: best.seasonYear,
      value,
      valueLabel: format(value),
    };
  };

  return [
    bestBy(
      "scoring",
      "Best Scoring Season",
      (c) => c.ppg,
      (v) => `${round1(v)} PPG`,
    ),
    bestBy(
      "rebounding",
      "Best Rebounding Season",
      (c) => c.rpg,
      (v) => `${round1(v)} RPG`,
    ),
    bestBy(
      "playmaking",
      "Best Playmaking Season",
      (c) => c.apg,
      (v) => `${round1(v)} APG`,
    ),
    bestBy(
      "overall",
      "Best Overall Season",
      (c) => c.overall,
      (v) => `${v} OVR`,
    ),
  ].filter((entry): entry is BestSeasonView => entry !== null);
}

export function toPlayerGameLogView(
  state: GameState,
  playerId: PlayerId,
): PlayerGameLogRowView[] {
  const games = getPlayerFinalGames(state, playerId);
  const rows: PlayerGameLogRowView[] = [];

  for (const game of games) {
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    const teamId = row.teamId;
    const home = teamId === game.homeTeamId;
    const opponentId = home ? game.awayTeamId : game.homeTeamId;
    const opp = resolveGameTeamIdentity(state, game, opponentId);
    const teamScore = home ? game.score.home : game.score.away;
    const opponentScore = home ? game.score.away : game.score.home;
    let won: boolean | null = null;
    if (teamId) {
      won = teamScore > opponentScore;
    }

    rows.push({
      gameId: game.id,
      date: game.date,
      seasonYear: seasonYearFromId(
        game.seasonId,
        state.competition.season.year,
      ),
      competitionType: game.competitionType,
      opponentAbbreviation: opp.abbreviation,
      opponentBranding: opp.branding,
      home,
      won,
      teamScore,
      opponentScore,
      minutes: row.minutes,
      points: row.points,
      rebounds: row.rebounds,
      assists: row.assists,
      steals: row.steals,
      blocks: row.blocks,
      turnovers: row.turnovers,
      fgMade: row.fieldGoalsMade,
      fgAttempted: row.fieldGoalsAttempted,
      threeMade: row.threePointersMade,
      threeAttempted: row.threePointersAttempted,
      ftMade: row.freeThrowsMade,
      ftAttempted: row.freeThrowsAttempted,
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows;
}

export function toPlayerRecentFormView(
  state: GameState,
  playerId: PlayerId,
  seasonLine: PlayerSeasonStatLine,
): RecentFormView {
  const games = getPlayerFinalGames(state, playerId)
    .filter(isTopLeagueStatGame)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  function lineFor(n: number): PlayerSeasonStatLine | null {
    const slice = games.slice(0, n);
    if (slice.length === 0) return null;
    let line = createEmptyPlayerStatLine();
    for (const game of slice) {
      const row = game.playerStats.find((stat) => stat.playerId === playerId);
      if (row) line = accumulatePlayerStatLine(line, row);
    }
    return line;
  }

  const last5 = lineFor(5);
  const last10 = lineFor(10);
  const seasonAverages =
    seasonLine.games > 0
      ? {
          ppg: round1(seasonLine.points / seasonLine.games),
          rpg: round1(seasonLine.rebounds / seasonLine.games),
          apg: round1(seasonLine.assists / seasonLine.games),
          mpg: round1(seasonLine.minutes / seasonLine.games),
        }
      : null;
  const last5Averages =
    last5 && last5.games > 0
      ? {
          ppg: round1(last5.points / last5.games),
          rpg: round1(last5.rebounds / last5.games),
          apg: round1(last5.assists / last5.games),
          mpg: round1(last5.minutes / last5.games),
        }
      : null;

  return { last5, last10, seasonAverages, last5Averages };
}

function widenSnapshotLine(line: PlayerSeasonStatLine): PlayerStatLine {
  return { ...createEmptyPlayerStatLine(), ...line };
}

/**
 * Per-season stat lines, one per seasonId. Box scores are authoritative;
 * a snapshot is used only for a season with no archived games, so a season
 * is never counted from both sources.
 */
export function toPlayerSeasonStatsViews(
  state: GameState,
  playerId: PlayerId,
  history: PlayerHistory | undefined,
  current: { age: number; overall: number },
): PlayerSeasonStatsView[] {
  const currentSeason = state.competition.season;
  const gamesBySeason = new Map<string, Game[]>();
  for (const game of getPlayerFinalGames(state, playerId)) {
    const list = gamesBySeason.get(game.seasonId);
    if (list) list.push(game);
    else gamesBySeason.set(game.seasonId, [game]);
  }

  const snapshots = new Map<string, PlayerSeasonRecord>();
  for (const season of history?.seasons ?? []) {
    snapshots.set(season.seasonId, season);
  }

  const seasonIds = new Set<string>([
    ...gamesBySeason.keys(),
    ...snapshots.keys(),
  ]);
  const views: PlayerSeasonStatsView[] = [];
  for (const seasonId of seasonIds) {
    const snapshot = snapshots.get(seasonId);
    const isCurrent = seasonId === currentSeason.id;
    const games = gamesBySeason.get(seasonId);
    const buckets: PlayerStatBuckets = games
      ? aggregatePlayerGames(games, playerId)
      : {
          regular: widenSnapshotLine(snapshot!.competition.regular),
          playoffs: widenSnapshotLine(snapshot!.competition.playoffs),
          development: widenSnapshotLine(snapshot!.competition.development),
          combined: widenSnapshotLine(snapshot!.competition.combined),
        };
    views.push({
      seasonId,
      seasonYear:
        snapshot?.seasonYear ??
        (isCurrent
          ? currentSeason.year
          : seasonYearFromId(seasonId as SeasonId, currentSeason.year)),
      current: isCurrent,
      age: snapshot?.age ?? (isCurrent ? current.age : null),
      overall: snapshot?.overall ?? (isCurrent ? current.overall : null),
      source: games ? "games" : "snapshot",
      ...buckets,
    });
  }

  views.sort((a, b) => a.seasonYear - b.seasonYear);
  return views;
}

/** Career = sum of season lines; averages divide career totals by career GP. */
export function toPlayerCareerStatsView(
  seasons: readonly PlayerSeasonStatsView[],
): PlayerCareerStatsView {
  let regular = createEmptyPlayerStatLine();
  let playoffs = createEmptyPlayerStatLine();
  let development = createEmptyPlayerStatLine();
  for (const season of seasons) {
    regular = addPlayerStatLines(regular, season.regular);
    playoffs = addPlayerStatLines(playoffs, season.playoffs);
    development = addPlayerStatLines(development, season.development);
  }
  return {
    regular,
    playoffs,
    development,
    combined: addPlayerStatLines(regular, playoffs),
    extendedColumnsComplete: seasons.every(
      (season) => season.source === "games" || season.combined.games === 0,
    ),
  };
}

const STAT_TREND_METRICS = [
  "ppg",
  "rpg",
  "apg",
  "spg",
  "bpg",
  "mpg",
  "fgPct",
  "threePct",
  "ftPct",
] as const;

function statTrendValue(line: PlayerStatLine, metric: string): number | null {
  const g = line.games;
  switch (metric) {
    case "ppg":
      return g > 0 ? round1(line.points / g) : null;
    case "rpg":
      return g > 0 ? round1(line.rebounds / g) : null;
    case "apg":
      return g > 0 ? round1(line.assists / g) : null;
    case "spg":
      return g > 0 ? round1(line.steals / g) : null;
    case "bpg":
      return g > 0 ? round1(line.blocks / g) : null;
    case "mpg":
      return g > 0 ? round1(line.minutes / g) : null;
    case "fgPct":
      return pct(line.fgMade, line.fgAttempted);
    case "threePct":
      return pct(line.threeMade, line.threeAttempted);
    case "ftPct":
      return pct(line.ftMade, line.ftAttempted);
    default:
      return null;
  }
}

/** Season-by-season per-game stat trend (top league, regular + playoffs). */
export function toPlayerStatTrendSeries(
  seasons: readonly PlayerSeasonStatsView[],
  metric: string,
): TrendPoint[] {
  return seasons
    .filter((season) => season.combined.games > 0)
    .map((season) => ({
      season: season.seasonYear,
      value: statTrendValue(season.combined, metric),
    }));
}

/**
 * Rating trend: season-end snapshots plus the live current rating.
 * metric is "ovr" or an attribute key.
 */
export function toPlayerRatingTrendSeries(
  history: PlayerHistory | undefined,
  metric: string,
  current?: {
    seasonYear: number;
    overall: number;
    attributes: PlayerAttributes;
  },
): TrendPoint[] {
  const ratingOf = (
    overall: number,
    attributes: PlayerAttributes,
  ): number | null => {
    if (metric === "ovr") return overall;
    if (metric in attributes) {
      return attributes[metric as keyof PlayerAttributes];
    }
    return null;
  };

  const points: TrendPoint[] = (history?.seasons ?? []).map((season) => ({
    season: season.seasonYear,
    value: ratingOf(season.overall, season.attributes),
  }));
  if (current && !points.some((p) => p.season === current.seasonYear)) {
    points.push({
      season: current.seasonYear,
      value: ratingOf(current.overall, current.attributes),
    });
  }
  points.sort((a, b) => a.season - b.season);
  return points;
}

export function toPlayerAttributeDevelopmentSeries(
  history: PlayerHistory | undefined,
  attributeKey: keyof PlayerAttributes,
): TrendPoint[] {
  if (!history) return [];
  return history.seasons
    .map((season) => ({
      season: season.seasonYear,
      value: season.attributes[attributeKey],
    }))
    .sort((a, b) => a.season - b.season);
}

/** One counted top-league game, for game-by-game charts. */
export type PlayerGameSeriesPoint = {
  gameId: string;
  date: string;
  bucket: "regular" | "playoffs";
  opponentAbbreviation: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fgMade: number;
  fgAttempted: number;
  threeMade: number;
  threeAttempted: number;
  ftMade: number;
  ftAttempted: number;
};

/** Chronological regular-season and playoff games for one season. */
export function toPlayerGameSeries(
  state: GameState,
  playerId: PlayerId,
  seasonId: SeasonId,
): PlayerGameSeriesPoint[] {
  const points: PlayerGameSeriesPoint[] = [];
  for (const game of getPlayerSeasonGames(state, playerId, seasonId)) {
    const bucket = classifyCompetition(game.competitionType);
    if (bucket !== "regular" && bucket !== "playoffs") continue;
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    const opponentId =
      row.teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
    points.push({
      gameId: game.id,
      date: game.date,
      bucket,
      opponentAbbreviation: resolveGameTeamIdentity(state, game, opponentId)
        .abbreviation,
      minutes: row.minutes,
      points: row.points,
      rebounds: row.rebounds,
      assists: row.assists,
      steals: row.steals,
      blocks: row.blocks,
      fgMade: row.fieldGoalsMade,
      fgAttempted: row.fieldGoalsAttempted,
      threeMade: row.threePointersMade,
      threeAttempted: row.threePointersAttempted,
      ftMade: row.freeThrowsMade,
      ftAttempted: row.freeThrowsAttempted,
    });
  }
  points.sort((a, b) =>
    a.date === b.date
      ? a.gameId.localeCompare(b.gameId)
      : a.date.localeCompare(b.date),
  );
  return points;
}

/**
 * Actual ratings only: season-end snapshots (taken before offseason
 * development) plus the live rating. Never projected.
 */
export type PlayerRatingHistoryPoint = {
  seasonYear: number;
  age: number | null;
  overall: number;
  /** The live rating today, not a season-end snapshot. */
  current: boolean;
};

export function toPlayerRatingHistory(
  history: PlayerHistory | undefined,
  current: { seasonYear: number; age: number; overall: number },
): PlayerRatingHistoryPoint[] {
  const points: PlayerRatingHistoryPoint[] = [...(history?.seasons ?? [])]
    .sort((a, b) => a.seasonYear - b.seasonYear)
    .map((season) => ({
      seasonYear: season.seasonYear,
      age: season.age,
      overall: season.overall,
      current: false,
    }));
  points.push({ ...current, current: true });
  return points;
}

export function toPlayerContractProfileView(
  state: GameState,
  playerId: PlayerId,
): PlayerContractProfileView | null {
  const player = state.world.players[playerId];
  if (!player?.contractId) return null;
  const contract = state.business.contracts[player.contractId];
  if (!contract) return null;

  const year = state.competition.season.year;
  const salaryByYear = Object.entries(contract.salaryByYear)
    .map(([y, salary]) => ({ year: Number(y), salary }))
    .sort((a, b) => a.year - b.year);

  const totalRemainingValue = salaryByYear
    .filter((entry) => entry.year >= year)
    .reduce((sum, entry) => sum + entry.salary, 0);

  const teamId = contract.teamId;
  const teamPayroll = getTeamPayroll(teamId, year, state);
  const currentSalary = getContractSalaryForYear(contract, year) ?? null;
  const payrollPercent =
    currentSalary !== null && teamPayroll > 0
      ? Math.round((currentSalary / teamPayroll) * 1000) / 10
      : null;

  return {
    contractId: contract.id,
    salary: currentSalary,
    startYear: contract.startYear,
    endYear: contract.endYear,
    yearsRemaining: Math.max(0, contract.endYear - year + 1),
    status: getContractStatus(contract, year),
    salaryByYear,
    totalRemainingValue,
    teamPayroll,
    payrollPercent,
    hasPendingTeamOption: contract.teamOption?.status === "pending",
    hasPendingPlayerOption: contract.playerOption?.status === "pending",
  };
}

/**
 * Builds the full player profile view from authoritative state.
 * Caller must ensure player is in scope; returns null if player missing.
 */
export function toPlayerProfileView(
  state: GameState,
  playerId: PlayerId,
  detail: PlayerDetailView,
): PlayerProfileView {
  const history = state.business.playerHistory[playerId];
  const seasonStats = aggregatePlayerSeasonStats(state, playerId);
  const { strengths, weaknesses } = derivePlayerStrengthsWeaknesses(
    detail.position as PlayerPosition,
    detail.attributes as PlayerAttributes,
  );
  const keyAttributes = topAttributesByPosition(
    detail.position as PlayerPosition,
    detail.attributes as PlayerAttributes,
  );
  const gameLog = toPlayerGameLogView(state, playerId);
  const teamStints = derivePlayerTeamStints(state, playerId);
  const careerHighs = deriveCareerHighs(state, playerId);
  const seasonLines = toPlayerSeasonStatsViews(state, playerId, history, {
    age: detail.age,
    overall: detail.overall,
  });
  const career = toPlayerCareerStatsView(seasonLines);
  const bestSeasons = deriveBestSeasons(seasonLines);
  const currentPartial = {
    seasonYear: state.competition.season.year,
    overall: detail.overall,
    attributes: detail.attributes as PlayerAttributes,
  };
  const recentForm = toPlayerRecentFormView(
    state,
    playerId,
    seasonStats.combined,
  );
  const contractProfile = toPlayerContractProfileView(state, playerId);

  const attributeKeys = Object.keys(detail.attributes) as Array<
    keyof PlayerAttributes
  >;
  const attributeDevelopment: Record<string, TrendPoint[]> = {};
  for (const key of attributeKeys) {
    attributeDevelopment[key] = toPlayerAttributeDevelopmentSeries(
      history,
      key,
    );
  }

  const seasonHistory = [...(history?.seasons ?? [])].sort(
    (a, b) => a.seasonYear - b.seasonYear,
  );

  const trendSeries: Record<string, TrendPoint[]> = {};
  for (const metric of STAT_TREND_METRICS) {
    trendSeries[metric] = toPlayerStatTrendSeries(seasonLines, metric);
  }
  for (const metric of ["ovr", ...attributeKeys]) {
    trendSeries[metric] = toPlayerRatingTrendSeries(
      history,
      metric,
      currentPartial,
    );
  }

  const worldPlayer = state.world.players[playerId];
  const controlledTeam = getControlledTeam(state);
  const ownedByActive =
    worldPlayer != null && worldPlayer.teamId === controlledTeam.id;
  const assigned = worldPlayer != null && isPlayerDlAssigned(worldPlayer);
  const canAssign =
    ownedByActive &&
    worldPlayer != null &&
    isDevelopmentLeagueEligible(worldPlayer, controlledTeam.id, state);
  const canRecall = ownedByActive && assigned;
  const readiness =
    worldPlayer != null && ownedByActive
      ? getDevelopmentReadiness(worldPlayer, controlledTeam.id, state)
      : null;
  const whyBullets =
    worldPlayer != null && ownedByActive
      ? assigned
        ? getPromotionExplanation(worldPlayer, controlledTeam.id, state)
        : getDlAssignmentExplanation(worldPlayer, controlledTeam.id, state)
      : [];

  return {
    ...detail,
    seasonStats: {
      games: seasonStats.combined.games,
      points: seasonStats.combined.points,
      rebounds: seasonStats.combined.rebounds,
      assists: seasonStats.combined.assists,
      steals: seasonStats.combined.steals,
      blocks: seasonStats.combined.blocks,
      turnovers: seasonStats.combined.turnovers,
      minutes: seasonStats.combined.minutes,
    },
    seasonStatLine: seasonStats.combined,
    seasonAverages: averagesFromLine(seasonStats.combined),
    playoffStatLine: seasonStats.playoffs,
    regularStatLine: seasonStats.regular,
    strengths,
    weaknesses,
    keyAttributes,
    recentForm,
    gameLog,
    seasonHistory,
    teamStints,
    careerHighs,
    bestSeasons,
    stats: {
      currentSeasonId: String(state.competition.season.id),
      seasons: seasonLines,
      career,
      currentSeasonGames: toPlayerGameSeries(
        state,
        playerId,
        state.competition.season.id,
      ),
    },
    development: {
      ratingHistory: toPlayerRatingHistory(history, {
        seasonYear: state.competition.season.year,
        age: detail.age,
        overall: detail.overall,
      }),
      trackingStartedSeasonYear: history?.trackingStartedSeasonYear ?? null,
    },
    seasonLines,
    career,
    careerTotals: career.combined,
    careerAverages: averagesFromLine(career.combined),
    contractProfile,
    trackingStartedSeasonYear: history?.trackingStartedSeasonYear ?? null,
    currentSeasonYear: state.competition.season.year,
    attributeDevelopment,
    overallTrend: trendSeries.ovr ?? [],
    trendSeries,
    developmentLeague: {
      assigned,
      canAssign,
      canRecall,
      statusLabel: assigned
        ? `Assigned (${worldPlayer?.developmentLeague?.role ?? "development"})`
        : worldPlayer?.developmentLeague?.draftSeasonYear != null
          ? "Eligible prospect"
          : null,
      readinessLabel: readiness?.replace(/_/g, " ") ?? null,
      whyBullets,
      seasonsUsed: worldPlayer?.developmentLeague?.seasonsUsed ?? 0,
      seasonsRemaining: getDevelopmentLeagueSeasonsRemaining(
        worldPlayer?.developmentLeague,
      ),
      role: worldPlayer?.developmentLeague?.role ?? null,
      developmentStatLine: seasonStats.development,
    },
    ...toPlayerAwardsView(state, playerId),
  };
}

/** Expose for tests / unused import hygiene. */
export function countFinalGamesInState(state: GameState): number {
  return getAllFinalGames(state).length;
}

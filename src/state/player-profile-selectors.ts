import type { Game, GamePlayerStats } from "@/domain/entities/game";
import type {
  PlayerAttributes,
  PlayerPosition,
} from "@/domain/entities/player";
import {
  addPlayerSeasonStatLines,
  createEmptyPlayerSeasonStatLine,
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
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, SeasonId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getAllFinalGames,
  getPlayerGames,
  getPlayerSeasonGames,
} from "@/state/game-access";
import { getTeamPayroll } from "@/systems/salary-cap";
import type { PlayerDetailView } from "@/state/selectors";

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
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
};

export type PlayerProfileView = PlayerDetailView & {
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
  careerTotals: PlayerSeasonStatLine;
  careerAverages: SeasonAveragesView | null;
  contractProfile: PlayerContractProfileView | null;
  trackingStartedSeasonYear: number | null;
  currentSeasonYear: number;
  attributeDevelopment: Record<string, TrendPoint[]>;
  overallTrend: TrendPoint[];
  trendSeries: Record<string, TrendPoint[]>;
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

function accumulateLine(
  line: PlayerSeasonStatLine,
  row: GamePlayerStats,
): PlayerSeasonStatLine {
  return {
    games: line.games + 1,
    minutes: line.minutes + row.minutes,
    points: line.points + row.points,
    rebounds: line.rebounds + row.rebounds,
    assists: line.assists + row.assists,
    steals: line.steals + row.steals,
    blocks: line.blocks + row.blocks,
    turnovers: line.turnovers + row.turnovers,
    fgMade: line.fgMade + row.fieldGoalsMade,
    fgAttempted: line.fgAttempted + row.fieldGoalsAttempted,
    threeMade: line.threeMade + row.threePointersMade,
    threeAttempted: line.threeAttempted + row.threePointersAttempted,
    ftMade: line.ftMade + row.freeThrowsMade,
    ftAttempted: line.ftAttempted + row.freeThrowsAttempted,
  };
}

function averagesFromLine(line: PlayerSeasonStatLine): SeasonAveragesView | null {
  if (line.games === 0) {
    return null;
  }
  const g = line.games;
  return {
    games: g,
    mpg: round1(line.minutes / g),
    ppg: round1(line.points / g),
    rpg: round1(line.rebounds / g),
    apg: round1(line.assists / g),
    spg: round1(line.steals / g),
    bpg: round1(line.blocks / g),
    topg: round1(line.turnovers / g),
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
): { city: string; name: string; abbreviation: string } {
  const isHome = teamId === game.homeTeamId;
  const snapshot = isHome ? game.homeTeamSnapshot : game.awayTeamSnapshot;
  if (snapshot) {
    return {
      city: snapshot.city,
      name: snapshot.name,
      abbreviation: snapshot.abbreviation,
    };
  }
  const live = state.world.teams[teamId];
  return {
    city: live?.city ?? "Unknown",
    name: live?.name ?? "Team",
    abbreviation: live?.abbreviation ?? "???",
  };
}

function playerTeamIdInGame(
  game: Game,
  playerId: PlayerId,
): string | null {
  const row = game.playerStats.find((stat) => stat.playerId === playerId);
  if (!row) return null;
  if (row.teamId) return row.teamId;
  return null;
}

export function aggregatePlayerSeasonStats(
  state: GameState,
  playerId: PlayerId,
  seasonId?: SeasonId,
): {
  regular: PlayerSeasonStatLine;
  playoffs: PlayerSeasonStatLine;
  combined: PlayerSeasonStatLine;
} {
  const targetSeasonId = seasonId ?? state.competition.season.id;
  const games = getPlayerSeasonGames(state, playerId, targetSeasonId);
  let regular = createEmptyPlayerSeasonStatLine();
  let playoffs = createEmptyPlayerSeasonStatLine();

  for (const game of games) {
    const row = game.playerStats.find((stat) => stat.playerId === playerId);
    if (!row) continue;
    if (game.competitionType === "playoffs") {
      playoffs = accumulateLine(playoffs, row);
    } else {
      regular = accumulateLine(regular, row);
    }
  }

  return {
    regular,
    playoffs,
    combined: addPlayerSeasonStatLines(regular, playoffs),
  };
}

export function derivePlayerTeamStints(
  state: GameState,
  playerId: PlayerId,
): PlayerTeamStint[] {
  const games = getPlayerGames(state, playerId).filter(
    (game) => game.status === "final",
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
      const year = seasonYearFromId(game.seasonId, state.competition.season.year);
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
  const games = getPlayerGames(state, playerId).filter(
    (game) => game.status === "final",
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
      : { abbreviation: "???" };
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
  history: PlayerHistory | undefined,
  currentPartial: {
    seasonYear: number;
    overall: number;
    combined: PlayerSeasonStatLine;
  } | null,
): BestSeasonView[] {
  type Candidate = {
    seasonYear: number;
    overall: number;
    ppg: number;
    rpg: number;
    apg: number;
  };

  const candidates: Candidate[] = [];

  if (history) {
    for (const season of history.seasons) {
      const g = season.competition.combined.games;
      candidates.push({
        seasonYear: season.seasonYear,
        overall: season.overall,
        ppg: g > 0 ? season.competition.combined.points / g : 0,
        rpg: g > 0 ? season.competition.combined.rebounds / g : 0,
        apg: g > 0 ? season.competition.combined.assists / g : 0,
      });
    }
  }

  if (currentPartial && currentPartial.combined.games > 0) {
    const g = currentPartial.combined.games;
    const already = candidates.some(
      (c) => c.seasonYear === currentPartial.seasonYear,
    );
    if (!already) {
      candidates.push({
        seasonYear: currentPartial.seasonYear,
        overall: currentPartial.overall,
        ppg: currentPartial.combined.points / g,
        rpg: currentPartial.combined.rebounds / g,
        apg: currentPartial.combined.assists / g,
      });
    }
  }

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
    bestBy("scoring", "Best Scoring Season", (c) => c.ppg, (v) => `${round1(v)} PPG`),
    bestBy("rebounding", "Best Rebounding Season", (c) => c.rpg, (v) => `${round1(v)} RPG`),
    bestBy("playmaking", "Best Playmaking Season", (c) => c.apg, (v) => `${round1(v)} APG`),
    bestBy("overall", "Best Overall Season", (c) => c.overall, (v) => `${v} OVR`),
  ].filter((entry): entry is BestSeasonView => entry !== null);
}

export function toPlayerGameLogView(
  state: GameState,
  playerId: PlayerId,
): PlayerGameLogRowView[] {
  const games = getPlayerGames(state, playerId).filter(
    (game) => game.status === "final",
  );
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
      seasonYear: seasonYearFromId(game.seasonId, state.competition.season.year),
      competitionType: game.competitionType,
      opponentAbbreviation: opp.abbreviation,
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
  const games = getPlayerGames(state, playerId)
    .filter((game) => game.status === "final")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  function lineFor(n: number): PlayerSeasonStatLine | null {
    const slice = games.slice(0, n);
    if (slice.length === 0) return null;
    let line = createEmptyPlayerSeasonStatLine();
    for (const game of slice) {
      const row = game.playerStats.find((stat) => stat.playerId === playerId);
      if (row) line = accumulateLine(line, row);
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

export function toPlayerCareerTotals(
  history: PlayerHistory | undefined,
  currentCombined: PlayerSeasonStatLine,
  currentSeasonYear: number,
): PlayerSeasonStatLine {
  let totals = createEmptyPlayerSeasonStatLine();
  if (history) {
    for (const season of history.seasons) {
      if (season.seasonYear === currentSeasonYear) {
        continue;
      }
      totals = addPlayerSeasonStatLines(totals, season.competition.combined);
    }
  }
  return addPlayerSeasonStatLines(totals, currentCombined);
}

export function toPlayerTrendSeries(
  history: PlayerHistory | undefined,
  metric: string,
  current?: {
    seasonYear: number;
    overall: number;
    attributes: PlayerAttributes;
    combined: PlayerSeasonStatLine;
  },
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const seasons = [...(history?.seasons ?? [])];

  for (const season of seasons) {
    points.push({
      season: season.seasonYear,
      value: metricValueFromSeason(season, metric),
    });
  }

  if (current) {
    const exists = points.some((p) => p.season === current.seasonYear);
    if (!exists && current.combined.games > 0) {
      points.push({
        season: current.seasonYear,
        value: metricValueFromPartial(current, metric),
      });
    }
  }

  points.sort((a, b) => a.season - b.season);
  return points;
}

function metricValueFromSeason(
  season: PlayerSeasonRecord,
  metric: string,
): number | null {
  const line = season.competition.combined;
  const g = line.games;
  switch (metric) {
    case "ppg":
      return g > 0 ? round1(line.points / g) : null;
    case "rpg":
      return g > 0 ? round1(line.rebounds / g) : null;
    case "apg":
      return g > 0 ? round1(line.assists / g) : null;
    case "mpg":
      return g > 0 ? round1(line.minutes / g) : null;
    case "fgPct":
      return pct(line.fgMade, line.fgAttempted);
    case "threePct":
      return pct(line.threeMade, line.threeAttempted);
    case "ftPct":
      return pct(line.ftMade, line.ftAttempted);
    case "ovr":
      return season.overall;
    default:
      if (metric in season.attributes) {
        return season.attributes[metric as keyof PlayerAttributes];
      }
      return null;
  }
}

function metricValueFromPartial(
  current: {
    overall: number;
    attributes: PlayerAttributes;
    combined: PlayerSeasonStatLine;
  },
  metric: string,
): number | null {
  const line = current.combined;
  const g = line.games;
  switch (metric) {
    case "ppg":
      return g > 0 ? round1(line.points / g) : null;
    case "rpg":
      return g > 0 ? round1(line.rebounds / g) : null;
    case "apg":
      return g > 0 ? round1(line.assists / g) : null;
    case "mpg":
      return g > 0 ? round1(line.minutes / g) : null;
    case "fgPct":
      return pct(line.fgMade, line.fgAttempted);
    case "threePct":
      return pct(line.threeMade, line.threeAttempted);
    case "ftPct":
      return pct(line.ftMade, line.ftAttempted);
    case "ovr":
      return current.overall;
    default:
      if (metric in current.attributes) {
        return current.attributes[metric as keyof PlayerAttributes];
      }
      return null;
  }
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
  const careerTotals = toPlayerCareerTotals(
    history,
    seasonStats.combined,
    state.competition.season.year,
  );
  const currentPartial = {
    seasonYear: state.competition.season.year,
    overall: detail.overall,
    attributes: detail.attributes as PlayerAttributes,
    combined: seasonStats.combined,
  };
  const bestSeasons = deriveBestSeasons(history, currentPartial);
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

  const trendMetrics = [
    "ppg",
    "rpg",
    "apg",
    "mpg",
    "fgPct",
    "threePct",
    "ftPct",
    "ovr",
  ] as const;
  const trendSeries: Record<string, TrendPoint[]> = {};
  for (const metric of trendMetrics) {
    trendSeries[metric] = toPlayerTrendSeries(history, metric, currentPartial);
  }
  for (const key of attributeKeys) {
    trendSeries[key] = toPlayerTrendSeries(history, key, currentPartial);
  }

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
    careerTotals,
    careerAverages: averagesFromLine(careerTotals),
    contractProfile,
    trackingStartedSeasonYear: history?.trackingStartedSeasonYear ?? null,
    currentSeasonYear: state.competition.season.year,
    attributeDevelopment,
    overallTrend: trendSeries.ovr ?? [],
    trendSeries,
  };
}

/** Expose for tests / unused import hygiene. */
export function countFinalGamesInState(state: GameState): number {
  return getAllFinalGames(state).length;
}

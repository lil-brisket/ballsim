import {
  buildAwardResultId,
  type AwardCandidateResult,
  type AwardDefinitionId,
  type AwardResult,
  type AwardStatSnapshot,
  type AwardSubjectRef,
} from "@/domain/entities/awards";
import {
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonStatLine,
} from "@/domain/entities/player-history";
import type { CoachId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  isRookieEligible,
  isSixthManEligible,
  meetsMinGamesMinutes,
} from "@/systems/awards/award-eligibility";
import { getAwardDefinition } from "@/systems/awards/award-definitions";
import {
  defensiveStatImpact,
  efficiencyFromTotals,
  efficiencyIndex,
  percentileScores,
  perGameRates,
  productionIndex,
  weightedScore,
} from "@/systems/awards/award-metrics";
import {
  AWARD_CANDIDATE_LIMIT,
  AWARD_ELIGIBILITY_CONFIG,
  AWARD_METRIC_VERSION,
  AWARD_SCORING_CONFIG,
} from "@/systems/awards/awards-config";
import {
  aggregatePlayerPeriodStats,
  aggregateTeamPeriodRecords,
  getPrimaryGamesForMonth,
  getPrimaryLeagueFinalGames,
  listPlayersInGames,
  rankTeamsByPointsAgainst,
  rankTeamsByWinPct,
  teamWinPct,
  type PeriodPlayerAgg,
  type PeriodTeamRecord,
} from "@/systems/awards/award-stat-sources";

type ScoredCandidate = {
  subjectId: string;
  teamId: TeamId | null;
  score: number;
  breakdown: Record<string, number>;
  agg: PeriodPlayerAgg | null;
  teamRecord: { wins: number; losses: number; winPct: number };
  teamRank: number | null;
};

function emptySnapshot(
  breakdown: Record<string, number>,
  teamRecord: { wins: number; losses: number; winPct: number },
  teamRank: number | null,
  agg: PeriodPlayerAgg | null,
): AwardStatSnapshot {
  const totals = agg?.totals ?? createEmptyPlayerSeasonStatLine();
  const rates = agg
    ? perGameRates(agg)
    : {
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        minutes: 0,
      };
  return {
    games: agg?.games ?? 0,
    minutes: agg?.minutes ?? 0,
    totals,
    perGame: rates,
    efficiency: efficiencyFromTotals(totals),
    teamRecord,
    teamRank,
    scoringBreakdown: breakdown,
    metricVersion: AWARD_METRIC_VERSION,
  };
}

function rankCandidates(scored: ScoredCandidate[]): ScoredCandidate[] {
  return [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.subjectId.localeCompare(b.subjectId);
  });
}

function toAwardResult(
  state: GameState,
  awardId: AwardDefinitionId,
  period: string | null,
  ranked: ScoredCandidate[],
): AwardResult | null {
  if (ranked.length === 0) return null;
  const def = getAwardDefinition(awardId);
  const leagueId = state.world.league.id;
  const seasonYear = state.competition.season.year;
  const seasonId = state.competition.season.id;
  const top = ranked.slice(0, AWARD_CANDIDATE_LIMIT);
  const winnerRow = top[0]!;
  const winner: AwardSubjectRef = {
    subjectType: def.subjectType,
    subjectId: winnerRow.subjectId as PlayerId | CoachId,
    teamId: winnerRow.teamId,
  };
  const candidates: AwardCandidateResult[] = top.map((row, index) => ({
    subjectId: row.subjectId as PlayerId | CoachId,
    teamId: row.teamId,
    rank: index + 1,
    score: row.score,
    breakdown: row.breakdown,
  }));

  return {
    id: buildAwardResultId(leagueId, seasonYear, period, awardId),
    awardId,
    cadence: def.cadence,
    leagueId,
    seasonId,
    seasonYear,
    period,
    winner,
    candidates,
    context: {
      winnerScore: winnerRow.score,
      breakdown: winnerRow.breakdown,
      statSnapshot: emptySnapshot(
        winnerRow.breakdown,
        winnerRow.teamRecord,
        winnerRow.teamRank,
        winnerRow.agg,
      ),
      metricVersion: AWARD_METRIC_VERSION,
    },
  };
}

function teamGamesPlayed(record: PeriodTeamRecord | undefined): number {
  if (!record) return 0;
  return record.wins + record.losses;
}

function buildPlayerPool(
  playerIds: PlayerId[],
  games: ReturnType<typeof getPrimaryLeagueFinalGames>,
  minGames: number,
  minMinutes: number,
): PeriodPlayerAgg[] {
  const pool: PeriodPlayerAgg[] = [];
  for (const playerId of playerIds) {
    const agg = aggregatePlayerPeriodStats(playerId, games);
    if (meetsMinGamesMinutes(agg, minGames, minMinutes)) {
      pool.push(agg);
    }
  }
  return pool;
}

function scoreProductionPool(
  pool: PeriodPlayerAgg[],
  teamRecords: Map<string, PeriodTeamRecord>,
  teamRanks: Map<string, number>,
  weights: Record<string, number>,
  options?: {
    includeTeamSuccess?: boolean;
    includeAvailability?: boolean;
  },
): ScoredCandidate[] {
  if (pool.length === 0) return [];
  const includeTeam = options?.includeTeamSuccess !== false;
  const includeAvail = options?.includeAvailability !== false;

  const production = pool.map((agg) => productionIndex(perGameRates(agg)));
  const efficiency = pool.map((agg) =>
    efficiencyIndex(efficiencyFromTotals(agg.totals)),
  );
  const teamSuccess = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const rec = teamRecords.get(agg.teamId);
    return rec ? teamWinPct(rec) : 0;
  });
  const availability = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const tgp = teamGamesPlayed(teamRecords.get(agg.teamId));
    return tgp === 0 ? 0 : agg.games / tgp;
  });

  const prodPct = percentileScores(production);
  const effPct = percentileScores(efficiency);
  const teamPct = percentileScores(teamSuccess);
  const availPct = percentileScores(availability);

  return pool.map((agg, i) => {
    const components: Record<string, number> = {
      production: prodPct[i]!,
      efficiency: effPct[i]!,
    };
    if (includeTeam) components.teamSuccess = teamPct[i]!;
    if (includeAvail) components.availability = availPct[i]!;
    const { score, breakdown } = weightedScore(components, weights);
    const rec = agg.teamId ? teamRecords.get(agg.teamId) : undefined;
    return {
      subjectId: agg.playerId,
      teamId: agg.teamId,
      score,
      breakdown,
      agg,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: agg.teamId ? (teamRanks.get(agg.teamId) ?? null) : null,
    };
  });
}

export function evaluatePlayerOfMonth(
  state: GameState,
  monthId: string,
): AwardResult | null {
  const games = getPrimaryGamesForMonth(state, monthId);
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.playerOfMonth;
  const pool = buildPlayerPool(
    listPlayersInGames(games),
    games,
    cfg.minGames,
    cfg.minMinutes,
  );
  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);
  const scored = scoreProductionPool(
    pool,
    teamRecords,
    teamRanks,
    AWARD_SCORING_CONFIG.playerOfMonth,
  );
  return toAwardResult(state, "player_of_month", monthId, rankCandidates(scored));
}

export function evaluateRookieOfMonth(
  state: GameState,
  monthId: string,
): AwardResult | null {
  const games = getPrimaryGamesForMonth(state, monthId);
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.rookieOfMonth;
  const seasonYear = state.competition.season.year;
  const rookies = listPlayersInGames(games).filter((id) =>
    isRookieEligible(state, id, seasonYear),
  );
  const pool = buildPlayerPool(rookies, games, cfg.minGames, cfg.minMinutes);
  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);
  const scored = scoreProductionPool(
    pool,
    teamRecords,
    teamRanks,
    AWARD_SCORING_CONFIG.rookieOfMonth,
  );
  return toAwardResult(state, "rookie_of_month", monthId, rankCandidates(scored));
}

export function evaluateDefensivePlayerOfMonth(
  state: GameState,
  monthId: string,
): AwardResult | null {
  const games = getPrimaryGamesForMonth(state, monthId);
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.defensivePlayerOfMonth;
  const pool = buildPlayerPool(
    listPlayersInGames(games),
    games,
    cfg.minGames,
    cfg.minMinutes,
  );
  if (pool.length === 0) return null;
  const teamRecords = aggregateTeamPeriodRecords(games);
  const paRanks = rankTeamsByPointsAgainst(teamRecords);
  const teamRanks = rankTeamsByWinPct(teamRecords);

  const defImpact = pool.map((agg) => defensiveStatImpact(perGameRates(agg)));
  const teamDef = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const rank = paRanks.get(agg.teamId) ?? teamRecords.size;
    return teamRecords.size <= 1
      ? 100
      : ((teamRecords.size - rank) / (teamRecords.size - 1)) * 100;
  });
  const availability = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const tgp = teamGamesPlayed(teamRecords.get(agg.teamId));
    return tgp === 0 ? 0 : agg.games / tgp;
  });

  const defPct = percentileScores(defImpact);
  const availPct = percentileScores(availability);

  const scored = pool.map((agg, i) => {
    const { score, breakdown } = weightedScore(
      {
        defensiveImpact: defPct[i]!,
        teamDefense: teamDef[i]!,
        availability: availPct[i]!,
      },
      AWARD_SCORING_CONFIG.defensivePlayerOfMonth,
    );
    const rec = agg.teamId ? teamRecords.get(agg.teamId) : undefined;
    return {
      subjectId: agg.playerId,
      teamId: agg.teamId,
      score,
      breakdown,
      agg,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: agg.teamId ? (teamRanks.get(agg.teamId) ?? null) : null,
    };
  });
  return toAwardResult(
    state,
    "defensive_player_of_month",
    monthId,
    rankCandidates(scored),
  );
}

export function evaluateMvp(state: GameState): AwardResult | null {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.mvp;
  const pool = buildPlayerPool(
    listPlayersInGames(games),
    games,
    cfg.minGames,
    cfg.minMinutes,
  );
  if (pool.length === 0) return null;
  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);

  const impact = pool.map((agg) => productionIndex(perGameRates(agg)));
  const efficiency = pool.map((agg) =>
    efficiencyIndex(efficiencyFromTotals(agg.totals)),
  );
  const teamSuccess = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const rec = teamRecords.get(agg.teamId);
    return rec ? teamWinPct(rec) : 0;
  });
  const availability = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const tgp = teamGamesPlayed(teamRecords.get(agg.teamId));
    return tgp === 0 ? 0 : agg.games / tgp;
  });
  const defImpact = pool.map((agg) => defensiveStatImpact(perGameRates(agg)));

  const impactPct = percentileScores(impact);
  const effPct = percentileScores(efficiency);
  const teamPct = percentileScores(teamSuccess);
  const availPct = percentileScores(availability);
  const defPct = percentileScores(defImpact);
  const twoWay = impactPct.map((off, i) => (off + defPct[i]!) / 2);

  const scored = pool.map((agg, i) => {
    const { score, breakdown } = weightedScore(
      {
        individualImpact: impactPct[i]!,
        efficiency: effPct[i]!,
        teamSuccess: teamPct[i]!,
        availability: availPct[i]!,
        twoWayImpact: twoWay[i]!,
      },
      AWARD_SCORING_CONFIG.mvp,
    );
    const rec = agg.teamId ? teamRecords.get(agg.teamId) : undefined;
    return {
      subjectId: agg.playerId,
      teamId: agg.teamId,
      score,
      breakdown,
      agg,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: agg.teamId ? (teamRanks.get(agg.teamId) ?? null) : null,
    };
  });
  return toAwardResult(state, "mvp", null, rankCandidates(scored));
}

export function evaluateDpoy(state: GameState): AwardResult | null {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.dpoy;
  const pool = buildPlayerPool(
    listPlayersInGames(games),
    games,
    cfg.minGames,
    cfg.minMinutes,
  );
  if (pool.length === 0) return null;
  const teamRecords = aggregateTeamPeriodRecords(games);
  const paRanks = rankTeamsByPointsAgainst(teamRecords);
  const teamRanks = rankTeamsByWinPct(teamRecords);

  const defImpact = pool.map((agg) => {
    const rates = perGameRates(agg);
    return defensiveStatImpact(rates) + rates.steals + rates.blocks;
  });
  const teamDef = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const rank = paRanks.get(agg.teamId) ?? teamRecords.size;
    return teamRecords.size <= 1
      ? 100
      : ((teamRecords.size - rank) / (teamRecords.size - 1)) * 100;
  });
  const advanced = pool.map((agg) => {
    const rates = perGameRates(agg);
    return rates.steals * 1.5 + rates.blocks * 1.5 + rates.rebounds * 0.2;
  });

  const defPct = percentileScores(defImpact);
  const advPct = percentileScores(advanced);

  const scored = pool.map((agg, i) => {
    const { score, breakdown } = weightedScore(
      {
        defensiveImpact: defPct[i]!,
        teamDefense: teamDef[i]!,
        advancedContextual: advPct[i]!,
      },
      AWARD_SCORING_CONFIG.dpoy,
    );
    const rec = agg.teamId ? teamRecords.get(agg.teamId) : undefined;
    return {
      subjectId: agg.playerId,
      teamId: agg.teamId,
      score,
      breakdown,
      agg,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: agg.teamId ? (teamRanks.get(agg.teamId) ?? null) : null,
    };
  });
  return toAwardResult(state, "dpoy", null, rankCandidates(scored));
}

export function evaluateRoy(state: GameState): AwardResult | null {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.rookieOfYear;
  const seasonYear = state.competition.season.year;
  const rookies = listPlayersInGames(games).filter((id) =>
    isRookieEligible(state, id, seasonYear),
  );
  const pool = buildPlayerPool(rookies, games, cfg.minGames, cfg.minMinutes);
  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);
  const scored = scoreProductionPool(
    pool,
    teamRecords,
    teamRanks,
    AWARD_SCORING_CONFIG.roy,
    { includeTeamSuccess: false },
  );
  return toAwardResult(state, "roy", null, rankCandidates(scored));
}

export function evaluateSixthMan(state: GameState): AwardResult | null {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  if (games.length === 0) return null;
  const all = buildPlayerPool(
    listPlayersInGames(games),
    games,
    AWARD_ELIGIBILITY_CONFIG.sixthMan.minGames,
    AWARD_ELIGIBILITY_CONFIG.sixthMan.minMinutes,
  );
  const pool = all.filter(isSixthManEligible);
  if (pool.length === 0) return null;
  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);

  const production = pool.map((agg) => productionIndex(perGameRates(agg)));
  const efficiency = pool.map((agg) =>
    efficiencyIndex(efficiencyFromTotals(agg.totals)),
  );
  const benchImpact = pool.map((agg) => {
    const rates = perGameRates(agg);
    const mpg = Math.max(rates.minutes, 1);
    return productionIndex(rates) * (24 / mpg);
  });
  const availability = pool.map((agg) => {
    if (!agg.teamId) return 0;
    const tgp = teamGamesPlayed(teamRecords.get(agg.teamId));
    return tgp === 0 ? 0 : agg.games / tgp;
  });

  const prodPct = percentileScores(production);
  const effPct = percentileScores(efficiency);
  const benchPct = percentileScores(benchImpact);
  const availPct = percentileScores(availability);

  const scored = pool.map((agg, i) => {
    const { score, breakdown } = weightedScore(
      {
        production: prodPct[i]!,
        efficiency: effPct[i]!,
        benchImpact: benchPct[i]!,
        availability: availPct[i]!,
      },
      AWARD_SCORING_CONFIG.sixthMan,
    );
    const rec = agg.teamId ? teamRecords.get(agg.teamId) : undefined;
    return {
      subjectId: agg.playerId,
      teamId: agg.teamId,
      score,
      breakdown,
      agg,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: agg.teamId ? (teamRanks.get(agg.teamId) ?? null) : null,
    };
  });
  return toAwardResult(state, "sixth_man", null, rankCandidates(scored));
}

function priorSeasonLine(
  state: GameState,
  playerId: PlayerId,
): PlayerSeasonStatLine | null {
  const history = state.business.playerHistory[playerId];
  if (!history || history.seasons.length === 0) return null;
  const currentYear = state.competition.season.year;
  const prior = history.seasons
    .filter((s) => s.seasonYear === currentYear - 1)
    .at(0);
  return prior?.competition.regular ?? null;
}

export function evaluateMostImproved(state: GameState): AwardResult | null {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  if (games.length === 0) return null;
  const cfg = AWARD_ELIGIBILITY_CONFIG.mostImproved;
  const candidates = listPlayersInGames(games);
  const pool: Array<{
    agg: PeriodPlayerAgg;
    prior: PlayerSeasonStatLine;
  }> = [];

  for (const playerId of candidates) {
    const agg = aggregatePlayerPeriodStats(playerId, games);
    if (
      !meetsMinGamesMinutes(
        agg,
        cfg.minCurrentSeasonGames,
        cfg.minCurrentSeasonMinutes,
      )
    ) {
      continue;
    }
    const prior = priorSeasonLine(state, playerId);
    if (
      !prior ||
      prior.games < cfg.minPreviousSeasonGames ||
      prior.minutes < cfg.minPreviousSeasonMinutes
    ) {
      continue;
    }
    pool.push({ agg, prior });
  }
  if (pool.length === 0) return null;

  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);

  function rate(line: PlayerSeasonStatLine) {
    const g = Math.max(1, line.games);
    return {
      points: line.points / g,
      rebounds: line.rebounds / g,
      assists: line.assists / g,
      steals: line.steals / g,
      blocks: line.blocks / g,
      minutes: line.minutes / g,
      ts: efficiencyIndex(efficiencyFromTotals(line)),
    };
  }

  const scoringDelta = pool.map(({ agg, prior }) => {
    const cur = rate(agg.totals);
    const prev = rate(prior);
    return cur.points - prev.points;
  });
  const efficiencyDelta = pool.map(({ agg, prior }) => {
    return rate(agg.totals).ts - rate(prior).ts;
  });
  const playmakingDelta = pool.map(({ agg, prior }) => {
    return rate(agg.totals).assists - rate(prior).assists;
  });
  const reboundingDelta = pool.map(({ agg, prior }) => {
    return rate(agg.totals).rebounds - rate(prior).rebounds;
  });
  const defensiveDelta = pool.map(({ agg, prior }) => {
    const cur = rate(agg.totals);
    const prev = rate(prior);
    return cur.steals + cur.blocks - (prev.steals + prev.blocks);
  });
  const roleAdjusted = pool.map(({ agg, prior }) => {
    const cur = rate(agg.totals);
    const prev = rate(prior);
    const minuteFactor = Math.max(prev.minutes, 1) / Math.max(cur.minutes, 1);
    const rawProd =
      cur.points + cur.rebounds * 1.2 + cur.assists * 1.5 -
      (prev.points + prev.rebounds * 1.2 + prev.assists * 1.5);
    // Penalize improvement driven purely by minute spikes.
    return rawProd * Math.min(1, minuteFactor + 0.25);
  });

  const scores = {
    scoringDelta: percentileScores(scoringDelta),
    efficiencyDelta: percentileScores(efficiencyDelta),
    playmakingDelta: percentileScores(playmakingDelta),
    reboundingDelta: percentileScores(reboundingDelta),
    defensiveDelta: percentileScores(defensiveDelta),
    roleAdjustedDelta: percentileScores(roleAdjusted),
  };

  const scored = pool.map(({ agg }, i) => {
    const { score, breakdown } = weightedScore(
      {
        scoringDelta: scores.scoringDelta[i]!,
        efficiencyDelta: scores.efficiencyDelta[i]!,
        playmakingDelta: scores.playmakingDelta[i]!,
        reboundingDelta: scores.reboundingDelta[i]!,
        defensiveDelta: scores.defensiveDelta[i]!,
        roleAdjustedDelta: scores.roleAdjustedDelta[i]!,
      },
      AWARD_SCORING_CONFIG.mostImproved,
    );
    const rec = agg.teamId ? teamRecords.get(agg.teamId) : undefined;
    return {
      subjectId: agg.playerId,
      teamId: agg.teamId,
      score,
      breakdown,
      agg,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: agg.teamId ? (teamRanks.get(agg.teamId) ?? null) : null,
    };
  });
  return toAwardResult(state, "most_improved", null, rankCandidates(scored));
}

export function evaluateCoachOfYear(state: GameState): AwardResult | null {
  const games = getPrimaryLeagueFinalGames(state, {
    competitionTypes: ["regular_season"],
  });
  if (games.length === 0) return null;
  const teamRecords = aggregateTeamPeriodRecords(games);
  const teamRanks = rankTeamsByWinPct(teamRecords);
  const playoffTeams = new Set(
    Object.values(state.competition.standings.byTeamId ?? {})
      .sort((a, b) => b.winPercentage - a.winPercentage)
      .slice(0, state.settings.playoffs.playoffTeams)
      .map((s) => s.teamId),
  );

  const coaches = Object.values(state.world.coaches).filter(
    (coach) => coach.teamId != null,
  );
  if (coaches.length === 0) return null;

  const currentSuccess = coaches.map((coach) => {
    const rec = teamRecords.get(coach.teamId!);
    return rec ? teamWinPct(rec) : 0;
  });
  const improvement = coaches.map((coach) => {
    const teamId = coach.teamId!;
    const rec = teamRecords.get(teamId);
    const currentWins = rec?.wins ?? 0;
    const history = state.business.franchiseHistory[teamId];
    const prior = history?.seasons
      .filter((s) => s.seasonYear === state.competition.season.year - 1)
      .at(0);
    const priorWins = prior?.wins ?? currentWins;
    return currentWins - priorWins;
  });
  const standing = coaches.map((coach) => {
    const rank = teamRanks.get(coach.teamId!) ?? teamRecords.size;
    return teamRecords.size <= 1
      ? 100
      : ((teamRecords.size - rank) / (teamRecords.size - 1)) * 100;
  });
  const playoff = coaches.map((coach) =>
    playoffTeams.has(coach.teamId!) ? 100 : 0,
  );

  const successPct = percentileScores(currentSuccess);
  const improvePct = percentileScores(improvement);

  const scored = coaches.map((coach, i) => {
    const { score, breakdown } = weightedScore(
      {
        currentSuccess: successPct[i]!,
        improvement: improvePct[i]!,
        leagueStanding: standing[i]!,
        playoffQualification: playoff[i]!,
      },
      AWARD_SCORING_CONFIG.coachOfYear,
    );
    const rec = teamRecords.get(coach.teamId!);
    return {
      subjectId: coach.id,
      teamId: coach.teamId,
      score,
      breakdown,
      agg: null,
      teamRecord: {
        wins: rec?.wins ?? 0,
        losses: rec?.losses ?? 0,
        winPct: rec ? teamWinPct(rec) : 0,
      },
      teamRank: teamRanks.get(coach.teamId!) ?? null,
    };
  });
  return toAwardResult(state, "coach_of_year", null, rankCandidates(scored));
}

export function ensureAwardResult(
  state: GameState,
  result: AwardResult | null,
): GameState {
  if (!result) return state;
  if (state.business.awards.results[result.id]) {
    return state;
  }
  return {
    ...state,
    business: {
      ...state.business,
      awards: {
        results: {
          ...state.business.awards.results,
          [result.id]: result,
        },
      },
    },
  };
}

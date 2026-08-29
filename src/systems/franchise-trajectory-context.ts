/**
 * Derived franchise trajectory context from multi-season history.
 * Never persisted — history (franchiseHistory, books, live state) is authoritative.
 *
 * Combines league-relative and self-relative (vs own 3-year baseline) signals.
 */

import {
  PLAYOFF_RESULT_DEPTH,
  type FranchiseSeasonRecord,
} from "@/domain/entities/franchise-history";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  meanRosterAge,
  meanRosterOverall,
  youngRosterSharePct,
  YOUNG_PLAYER_AGE_MAX,
} from "@/state/roster-strength";
import { calculateCashRunway } from "@/state/franchise-selectors";
import { clampPreference } from "@/systems/franchise-ai-preferences-config";
import type { FinancialHealthState } from "@/systems/financial-health";

export type FranchiseTrajectoryContext = {
  /** Multi-season rebuild urge 0–1. */
  rebuildPressure: number;
  /** Multi-factor competitive window strength 0–1 (not wins-only). */
  competitiveWindow: number;
  /** Financial stress arc 0–1. */
  financialStress: number;
  /** Commercial / market growth opportunity 0–1. */
  marketOpportunity: number;
  /** Overall organizational momentum 0–1. */
  organizationalMomentum: number;
  /** Self-relative win trend vs own 3-year baseline (−1..1). */
  winsVsOwnBaseline: number;
  /** Self-relative attendance trend (−1..1). */
  attendanceVsOwnBaseline: number;
  /** Self-relative franchise value trend (−1..1). */
  valueVsOwnBaseline: number;
  /** Self-relative revenue trend (−1..1). */
  revenueVsOwnBaseline: number;
  /** Self-relative sentiment trend (−1..1). */
  sentimentVsOwnBaseline: number;
  /** Consecutive losing seasons (wins < 0.4 winpct) ending most recently. */
  consecutiveLosingSeasons: number;
  /** Playoff drought seasons since last appearance. */
  playoffDroughtSeasons: number;
  /** Young star present (age ≤26, overall ≥78). */
  hasYoungStar: boolean;
  /** Top young star overall if any; else 0. */
  youngStarOverall: number;
};

const HISTORY_LOOKBACK = 3;
const YOUNG_STAR_AGE_MAX = 26;
const YOUNG_STAR_OVERALL_MIN = 78;

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
}

/**
 * Relative change of latest vs baseline mean, normalized roughly to −1..1.
 */
function selfRelativeTrend(
  latest: number | null | undefined,
  baselineValues: number[],
  scale: number,
): number {
  if (
    latest === null ||
    latest === undefined ||
    !Number.isFinite(latest) ||
    baselineValues.length === 0
  ) {
    return 0;
  }
  const baseline = mean(baselineValues.filter(Number.isFinite));
  if (!Number.isFinite(baseline) || baseline === 0) {
    return 0;
  }
  return clampSigned((latest - baseline) / Math.max(Math.abs(baseline), scale));
}

function recentSeasons(
  seasons: readonly FranchiseSeasonRecord[],
): FranchiseSeasonRecord[] {
  if (seasons.length === 0) {
    return [];
  }
  return seasons.slice(-HISTORY_LOOKBACK);
}

function winPct(record: FranchiseSeasonRecord): number {
  const games = record.wins + record.losses;
  return games === 0 ? 0.5 : record.wins / games;
}

function detectYoungStar(
  state: GameState,
  teamId: TeamId,
): { hasYoungStar: boolean; youngStarOverall: number } {
  const team = state.world.teams[teamId];
  if (!team) {
    return { hasYoungStar: false, youngStarOverall: 0 };
  }
  let best = 0;
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player || player.age > YOUNG_STAR_AGE_MAX) {
      continue;
    }
    const overall = calculatePlayerOverall(player.position, player.attributes);
    if (overall > best) {
      best = overall;
    }
  }
  return {
    hasYoungStar: best >= YOUNG_STAR_OVERALL_MIN,
    youngStarOverall: best,
  };
}

function healthStress(health: FinancialHealthState): number {
  switch (health) {
    case "healthy":
      return 0;
    case "stable":
      return 0.15;
    case "warning":
      return 0.55;
    case "critical":
      return 0.85;
    case "insolvent":
      return 1;
  }
}

function countConsecutiveLosingSeasons(
  seasons: readonly FranchiseSeasonRecord[],
): number {
  let count = 0;
  for (let index = seasons.length - 1; index >= 0; index -= 1) {
    if (winPct(seasons[index]!) < 0.4) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

function playoffDrought(
  seasons: readonly FranchiseSeasonRecord[],
): number {
  let drought = 0;
  for (let index = seasons.length - 1; index >= 0; index -= 1) {
    if (seasons[index]!.playoffResult === "missed") {
      drought += 1;
    } else {
      break;
    }
  }
  return drought;
}

function leagueMeanWins(state: GameState): number {
  const seasons = Object.values(state.business.franchiseHistory);
  const latestWins: number[] = [];
  for (const history of seasons) {
    const last = history.seasons[history.seasons.length - 1];
    if (last) {
      latestWins.push(last.wins);
    }
  }
  return latestWins.length === 0 ? 41 : mean(latestWins);
}

/**
 * Build trajectory context from history + live state. Pure read.
 */
export function buildFranchiseTrajectoryContext(
  state: GameState,
  teamId: TeamId,
): FranchiseTrajectoryContext | null {
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  if (!team || !ops) {
    return null;
  }

  const history = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const lookback = recentSeasons(history);
  const priorForBaseline =
    lookback.length >= 2 ? lookback.slice(0, -1) : lookback;
  const latest = lookback[lookback.length - 1];

  const standing = state.competition.standings.byTeamId[teamId];
  const currentWins = standing?.wins ?? latest?.wins ?? 0;
  const currentLosses = standing?.losses ?? latest?.losses ?? 0;
  const currentGames = currentWins + currentLosses;
  const currentWinPct =
    currentGames === 0
      ? latest
        ? winPct(latest)
        : 0.5
      : currentWins / currentGames;

  const runway = calculateCashRunway(state, teamId);
  const rosterStrength = meanRosterOverall(state, teamId);
  const rosterAge = meanRosterAge(state, teamId);
  const youngShare = youngRosterSharePct(state, teamId);
  const { hasYoungStar, youngStarOverall } = detectYoungStar(state, teamId);

  const winsVsOwnBaseline = selfRelativeTrend(
    latest ? latest.wins : currentWins,
    priorForBaseline.map((season) => season.wins),
    15,
  );
  const attendanceVsOwnBaseline = selfRelativeTrend(
    latest?.attendance ?? null,
    priorForBaseline
      .map((season) => season.attendance)
      .filter((value): value is number => value !== null),
    50_000,
  );
  const valueVsOwnBaseline = selfRelativeTrend(
    latest?.franchiseValue ?? null,
    priorForBaseline.map((season) => season.franchiseValue),
    50_000_000,
  );
  const revenueVsOwnBaseline = selfRelativeTrend(
    latest?.revenue ?? null,
    priorForBaseline.map((season) => season.revenue),
    20_000_000,
  );
  const sentimentVsOwnBaseline = selfRelativeTrend(
    latest?.fanSentiment ?? ops.fanSentiment,
    priorForBaseline.map((season) => season.fanSentiment),
    15,
  );

  const consecutiveLosingSeasons = countConsecutiveLosingSeasons(history);
  const drought = playoffDrought(history);

  // --- rebuildPressure ---
  const losingArc = clampPreference(consecutiveLosingSeasons / 3);
  const droughtArc = clampPreference(drought / 4);
  const agingPressure = clampPreference((rosterAge - 27) / 6);
  const weakRoster =
    rosterStrength > 0
      ? clampPreference((50 - rosterStrength) / 25)
      : 0.5;
  const valueDecline = clampPreference(-valueVsOwnBaseline);
  const rebuildPressure = clampPreference(
    losingArc * 0.3 +
      droughtArc * 0.2 +
      agingPressure * 0.15 +
      weakRoster * 0.2 +
      valueDecline * 0.15,
  );

  // --- competitiveWindow (multi-factor, not wins-only) ---
  const performanceFactor = clampPreference((currentWinPct - 0.4) / 0.3);
  const strengthFactor =
    rosterStrength > 0
      ? clampPreference((rosterStrength - 52) / 20)
      : 0.3;
  const youngStarFactor = hasYoungStar
    ? clampPreference((youngStarOverall - YOUNG_STAR_OVERALL_MIN) / 15 + 0.45)
    : youngShare >= 45
      ? 0.25
      : 0;
  const playoffDepth = latest
    ? PLAYOFF_RESULT_DEPTH[latest.playoffResult] / 5
    : 0;
  const financialCapacity =
    runway.health === "healthy"
      ? 0.85
      : runway.health === "stable"
        ? 0.65
        : runway.health === "warning"
          ? 0.35
          : 0.1;
  const ageFit =
    rosterAge > 0
      ? clampPreference(1 - Math.abs(rosterAge - 26.5) / 8)
      : 0.4;
  const competitiveWindow = clampPreference(
    performanceFactor * 0.25 +
      strengthFactor * 0.25 +
      youngStarFactor * 0.2 +
      playoffDepth * 0.1 +
      financialCapacity * 0.12 +
      ageFit * 0.08,
  );

  // --- financialStress ---
  const cashTrendStress = clampPreference(
    latest && priorForBaseline.length > 0
      ? Math.max(
          0,
          (mean(priorForBaseline.map((season) => season.businessFunds)) -
            latest.businessFunds) /
            Math.max(
              mean(priorForBaseline.map((season) => season.businessFunds)),
              1,
            ),
        )
      : 0,
  );
  const financialStress = clampPreference(
    healthStress(runway.health) * 0.65 +
      cashTrendStress * 0.2 +
      clampPreference(-revenueVsOwnBaseline) * 0.15,
  );

  // --- marketOpportunity ---
  const attendanceRising = clampPreference(attendanceVsOwnBaseline);
  const sentimentRising = clampPreference(sentimentVsOwnBaseline);
  const awarenessFactor = clampPreference(ops.marketing.awareness / 100);
  const leagueWins = leagueMeanWins(state);
  const attendanceLeagueRelative =
    latest?.attendance !== null &&
    latest?.attendance !== undefined &&
    latest.attendance > 0
      ? 0.5 // without league attendance mean, lean on self-relative + awareness
      : 0.5;
  void leagueWins;
  void attendanceLeagueRelative;
  const marketOpportunity = clampPreference(
    attendanceRising * 0.35 +
      sentimentRising * 0.25 +
      awarenessFactor * 0.25 +
      (ops.fanSentiment >= 55 ? 0.15 : 0),
  );

  // --- organizationalMomentum ---
  const organizationalMomentum = clampPreference(
    clampPreference(winsVsOwnBaseline) * 0.25 +
      clampPreference(valueVsOwnBaseline) * 0.25 +
      clampPreference(attendanceVsOwnBaseline) * 0.2 +
      clampPreference(revenueVsOwnBaseline) * 0.15 +
      clampPreference(sentimentVsOwnBaseline) * 0.15 +
      0.35,
  );

  return {
    rebuildPressure,
    competitiveWindow,
    financialStress,
    marketOpportunity,
    organizationalMomentum,
    winsVsOwnBaseline,
    attendanceVsOwnBaseline,
    valueVsOwnBaseline,
    revenueVsOwnBaseline,
    sentimentVsOwnBaseline,
    consecutiveLosingSeasons,
    playoffDroughtSeasons: drought,
    hasYoungStar,
    youngStarOverall,
  };
}

/** Neutral trajectory when history is unavailable (tests / edge cases). */
export function emptyFranchiseTrajectoryContext(): FranchiseTrajectoryContext {
  return {
    rebuildPressure: 0.35,
    competitiveWindow: 0.35,
    financialStress: 0.2,
    marketOpportunity: 0.35,
    organizationalMomentum: 0.5,
    winsVsOwnBaseline: 0,
    attendanceVsOwnBaseline: 0,
    valueVsOwnBaseline: 0,
    revenueVsOwnBaseline: 0,
    sentimentVsOwnBaseline: 0,
    consecutiveLosingSeasons: 0,
    playoffDroughtSeasons: 0,
    hasYoungStar: false,
    youngStarOverall: 0,
  };
}

export { YOUNG_PLAYER_AGE_MAX, YOUNG_STAR_AGE_MAX, YOUNG_STAR_OVERALL_MIN };

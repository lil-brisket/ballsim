import type { DraftPick } from "@/domain/entities/draft-pick";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  PICK_UNCERTAINTY_CONFIG,
  PICK_VALUE_CURVE,
  PICK_YEAR_DISCOUNT_PER_YEAR,
  STANDINGS_TIER_THRESHOLDS,
  type StandingsTier,
} from "@/systems/trades-config";
import type { PickProjection } from "@/systems/trades/asset-valuation/types";
import { draftYearForSeason } from "@/systems/draft/draft-order";

/**
 * Project draft-pick slot from reverse standings of the originating team.
 * Includes uncertainty band that contracts as the season progresses.
 */
export function projectDraftPick(
  state: GameState,
  pick: DraftPick,
): PickProjection {
  const teamIds = Object.keys(state.world.teams) as TeamId[];
  const leagueSize = Math.max(1, teamIds.length);
  const ranked = rankTeamsWorstToBest(state, teamIds);
  const originRank =
    ranked.findIndex((id) => id === pick.originalTeamId) + 1 || leagueSize;
  const roundOffset = pick.round === 1 ? 0 : leagueSize;
  const projectedOverallPick = Math.min(
    leagueSize * 2,
    Math.max(1, originRank + roundOffset),
  );

  const seasonProgress = computeSeasonProgress(state);
  const halfWidth = uncertaintyHalfWidth(seasonProgress, leagueSize);
  const rangeLow = Math.max(1, projectedOverallPick - halfWidth);
  const rangeHigh = Math.min(leagueSize * 2, projectedOverallPick + halfWidth);
  const confidence =
    seasonProgress < 0.35 ? "low" : seasonProgress < 0.7 ? "medium" : "high";
  const tier = standingsTierFromRank(originRank);

  return {
    projectedOverallPick,
    rangeLow,
    rangeHigh,
    confidence,
    tier,
    seasonProgress,
  };
}

export function pickValueFromProjection(
  projection: PickProjection,
  pick: DraftPick,
  currentSeasonYear: number,
): number {
  // Expected value across uncertainty band (uniform average of endpoints + mid).
  const low = interpolatePickCurve(projection.rangeLow);
  const mid = interpolatePickCurve(projection.projectedOverallPick);
  const high = interpolatePickCurve(projection.rangeHigh);
  let value = (low + mid + high) / 3;

  const nextDraftYear = draftYearForSeason(currentSeasonYear);
  const yearsAway = Math.max(0, pick.seasonYear - nextDraftYear);
  value *= Math.max(0.45, 1 - yearsAway * PICK_YEAR_DISCOUNT_PER_YEAR);

  // Round-2 picks already shifted by leagueSize in projection; slight extra haircut
  // if somehow still in first-round slot math.
  if (pick.round === 2) {
    value *= 0.95;
  }

  return Math.round(value * 10) / 10;
}

export function standingsTierFromRank(rankWorstFirst: number): StandingsTier {
  if (rankWorstFirst <= STANDINGS_TIER_THRESHOLDS.strongLotteryMaxRank) {
    return "strong_lottery";
  }
  if (rankWorstFirst <= STANDINGS_TIER_THRESHOLDS.likelyLotteryMaxRank) {
    return "likely_lottery";
  }
  if (rankWorstFirst <= STANDINGS_TIER_THRESHOLDS.playInMaxRank) {
    return "play_in_range";
  }
  if (rankWorstFirst <= STANDINGS_TIER_THRESHOLDS.likelyPlayoffMaxRank) {
    return "likely_playoff";
  }
  return "contender";
}

export function tierDisplayLabel(tier: StandingsTier): string {
  switch (tier) {
    case "strong_lottery":
      return "Strong lottery projection";
    case "likely_lottery":
      return "Likely lottery";
    case "play_in_range":
      return "Play-in range";
    case "likely_playoff":
      return "Likely playoff";
    case "contender":
      return "Contender";
  }
}

function interpolatePickCurve(overallPick: number): number {
  const curve = PICK_VALUE_CURVE;
  if (overallPick <= curve[0]!.overallPick) {
    return curve[0]!.value;
  }
  const last = curve[curve.length - 1]!;
  if (overallPick >= last.overallPick) {
    return last.value;
  }
  for (let i = 0; i < curve.length - 1; i += 1) {
    const a = curve[i]!;
    const b = curve[i + 1]!;
    if (overallPick >= a.overallPick && overallPick <= b.overallPick) {
      const t =
        (overallPick - a.overallPick) / (b.overallPick - a.overallPick);
      return a.value + t * (b.value - a.value);
    }
  }
  return last.value;
}

function uncertaintyHalfWidth(
  seasonProgress: number,
  leagueSize: number,
): number {
  const { earlySeasonFraction, lateSeasonFraction, minHalfWidth, maxHalfWidth } =
    PICK_UNCERTAINTY_CONFIG;
  const fraction =
    earlySeasonFraction +
    (lateSeasonFraction - earlySeasonFraction) * clamp01(seasonProgress);
  const raw = Math.round(leagueSize * fraction);
  return Math.min(maxHalfWidth, Math.max(minHalfWidth, raw));
}

function computeSeasonProgress(state: GameState): number {
  const gamesPerTeam = state.settings.regularSeason.gamesPerTeam;
  if (gamesPerTeam <= 0) return 0;
  let played = 0;
  let teams = 0;
  for (const standing of Object.values(state.competition.standings.byTeamId)) {
    played += standing.wins + standing.losses;
    teams += 1;
  }
  if (teams === 0) return 0;
  return clamp01(played / teams / gamesPerTeam);
}

function rankTeamsWorstToBest(
  state: GameState,
  teamIds: TeamId[],
): TeamId[] {
  return [...teamIds].sort((a, b) => {
    const sa = state.competition.standings.byTeamId[a];
    const sb = state.competition.standings.byTeamId[b];
    const winsA = sa?.wins ?? 0;
    const winsB = sb?.wins ?? 0;
    if (winsA !== winsB) return winsA - winsB;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Scout Evaluation Engine — converts true prospect data into EstimatedProspectData.
 * Deterministic given RNG stream. Never re-rolls on report open.
 */

import type { DraftProspect } from "@/domain/entities/draft";
import type { LeagueArea } from "@/domain/game-settings";
import type { Player, PlayerPersonality } from "@/domain/entities/player";
import { playerCanPlay } from "@/domain/entities/player";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import {
  createRatingRange,
  ESTIMATED_SCOUTING_CATEGORY_KEYS,
  type EstimatedProspectData,
  type EstimatedScoutingCategories,
  type EstimatedScoutingCategoryKey,
  type PersonalityKey,
  type RatingRange,
  type ScoutConfidence,
  type ScoutGrade,
  type ScoutingKnowledgeLevel,
  type ScoutingRegion,
  PERSONALITY_KEYS,
  ratingRangeMidpoint,
  ratingRangeWidth,
} from "@/domain/entities/scouting-types";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import type { GameState } from "@/state/game-state";
import {
  scoutInternationalModifier,
  scoutQualityMultiplier,
  scoutSpeedMultiplier,
} from "@/systems/staff-effects/scout-effects";

/** Effective exposure thresholds for knowledge levels (before scout quality scaling). */
export const EXPOSURE_BASIC = 0.5;
export const EXPOSURE_DEVELOPING = 2;
export const EXPOSURE_DETAILED = 5;
export const EXPOSURE_COMPREHENSIVE = 10;

/** Base half-width for overall/potential at zero exposure with average scout. */
export const BASE_OVERALL_HALF_WIDTH = 10;
export const BASE_CATEGORY_HALF_WIDTH = 12;
export const BASE_RANK_HALF_WIDTH = 4;
export const BASE_INTANGIBLE_HALF_WIDTH = 14;

export type ScoutEvaluationContext = {
  teamId: TeamId;
  leagueArea: LeagueArea;
  region: ScoutingRegion;
  regionCoverage: number;
  exposure: number;
  currentDate: string;
  classSize: number;
};

/**
 * Evaluation difficulty from prospect traits — not personality.consistency.
 */
export function prospectUncertainty(player: Player): number {
  let uncertainty = 1;
  if (player.age <= 20) {
    uncertainty += 0.25;
  } else if (player.age >= 22) {
    uncertainty -= 0.1;
  }
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const ceilingGap = Math.max(0, player.potential.overall - overall);
  uncertainty += Math.min(0.4, ceilingGap / 50);
  if (player.development.stage === "developing") {
    uncertainty += 0.15;
  }
  if (player.availability === "out" || player.availability === "suspended" || !playerCanPlay(player)) {
    uncertainty += 0.2;
  }
  return Math.max(0.5, Math.min(2, uncertainty));
}

export function computeEffectiveExposure(input: {
  exposure: number;
  scoutQuality: number;
  scoutSpeed: number;
  region: ScoutingRegion;
  regionCoverage: number;
  internationalScoutMod: number;
}): number {
  const regionMod =
    input.region === "international"
      ? 0.55 * input.internationalScoutMod * input.regionCoverage
      : 1 * input.regionCoverage;
  return (
    input.exposure *
    input.scoutQuality *
    input.scoutSpeed *
    Math.max(0.35, Math.min(1.5, regionMod))
  );
}

export function knowledgeLevelFromEffectiveExposure(
  effectiveExposure: number,
): ScoutingKnowledgeLevel {
  if (effectiveExposure <= 0) return "unknown";
  if (effectiveExposure < EXPOSURE_BASIC) return "unknown";
  if (effectiveExposure < EXPOSURE_DEVELOPING) return "basic";
  if (effectiveExposure < EXPOSURE_DETAILED) return "developing";
  if (effectiveExposure < EXPOSURE_COMPREHENSIVE) return "detailed";
  return "comprehensive";
}

export function confidenceFromWidth(
  width: number,
  baseWidth: number,
): ScoutConfidence {
  const ratio = width / Math.max(1, baseWidth * 2);
  if (ratio <= 0.45) return "high";
  if (ratio <= 0.75) return "medium";
  return "low";
}

export function scoutGradeFromEstimated(
  overall: RatingRange,
  potential: RatingRange,
): ScoutGrade {
  const score =
    ratingRangeMidpoint(overall) * 0.45 +
    ratingRangeMidpoint(potential) * 0.55;
  if (score >= 92) return "A+";
  if (score >= 88) return "A";
  if (score >= 84) return "A-";
  if (score >= 80) return "B+";
  if (score >= 76) return "B";
  if (score >= 72) return "B-";
  if (score >= 68) return "C+";
  if (score >= 64) return "C";
  if (score >= 58) return "C-";
  if (score >= 50) return "D";
  return "F";
}

function trueCategoryRatings(player: Player): Record<
  EstimatedScoutingCategoryKey,
  number
> {
  const a = player.attributes;
  return {
    shooting: Math.round((a.threePoint + a.freeThrow + a.midRange) / 3),
    finishing: a.finishing,
    passing: a.passing,
    ballHandling: a.ballHandling,
    perimeterDefense: a.perimeterDefense,
    interiorDefense: a.interiorDefense,
    rebounding: a.rebounding,
    athleticism: Math.round(
      (a.speed + a.strength + a.athleticism + a.stamina) / 4,
    ),
  };
}

function halfWidthFor(
  base: number,
  uncertainty: number,
  scoutQuality: number,
  effectiveExposure: number,
): number {
  const exposureFactor = 1 / (1 + effectiveExposure * 0.35);
  const qualityFactor = 1 / Math.max(0.5, scoutQuality);
  return Math.max(
    1,
    Math.round(base * uncertainty * exposureFactor * qualityFactor),
  );
}

function noisyRange(
  trueValue: number,
  halfWidth: number,
  rng: Rng,
): RatingRange {
  const bias = rng.nextInt(-Math.ceil(halfWidth * 0.4), Math.ceil(halfWidth * 0.4));
  const center = trueValue + bias;
  return createRatingRange(center - halfWidth, center + halfWidth);
}

/**
 * Build EstimatedProspectData for one team × prospect.
 * Consumes RNG for seeded offsets — store result; do not regenerate on open.
 */
export function evaluateProspectForTeam(
  state: GameState,
  prospect: DraftProspect,
  ctx: ScoutEvaluationContext,
  rng: Rng,
): EstimatedProspectData {
  const player = prospect.player;
  const scoutQuality = scoutQualityMultiplier(state, ctx.teamId);
  const scoutSpeed = scoutSpeedMultiplier(state, ctx.teamId);
  const internationalMod = scoutInternationalModifier(state, ctx.teamId);
  const uncertainty = prospectUncertainty(player);
  const effectiveExposure = computeEffectiveExposure({
    exposure: ctx.exposure,
    scoutQuality,
    scoutSpeed,
    region: ctx.region,
    regionCoverage: ctx.regionCoverage,
    internationalScoutMod: internationalMod,
  });
  const knowledgeLevel = knowledgeLevelFromEffectiveExposure(effectiveExposure);

  const overallHalf = halfWidthFor(
    BASE_OVERALL_HALF_WIDTH,
    uncertainty,
    scoutQuality,
    effectiveExposure,
  );
  const trueOverall = calculatePlayerOverall(player.position, player.attributes);
  const estimatedOverall = noisyRange(trueOverall, overallHalf, rng);
  const estimatedPotential = noisyRange(
    player.potential.overall,
    halfWidthFor(
      BASE_OVERALL_HALF_WIDTH + 1,
      uncertainty,
      scoutQuality,
      effectiveExposure,
    ),
    rng,
  );

  const categoryHalf = halfWidthFor(
    BASE_CATEGORY_HALF_WIDTH,
    uncertainty,
    scoutQuality,
    effectiveExposure,
  );
  const trueCats = trueCategoryRatings(player);
  const estimatedCategories = {} as EstimatedScoutingCategories;
  for (const key of ESTIMATED_SCOUTING_CATEGORY_KEYS) {
    estimatedCategories[key] = noisyRange(trueCats[key], categoryHalf, rng);
  }

  const rankHalf = halfWidthFor(
    BASE_RANK_HALF_WIDTH,
    uncertainty,
    scoutQuality,
    effectiveExposure,
  );
  const rankBias = rng.nextInt(-rankHalf, rankHalf);
  const rankCenter = Math.max(
    1,
    Math.min(ctx.classSize, prospect.ranking + rankBias),
  );
  const projectedRank = {
    min: Math.max(1, rankCenter - rankHalf),
    max: Math.min(ctx.classSize, rankCenter + rankHalf),
  };

  const intangibles: Partial<Record<PersonalityKey, RatingRange>> = {};
  if (
    knowledgeLevel === "detailed" ||
    knowledgeLevel === "comprehensive"
  ) {
    const intangibleHalf = halfWidthFor(
      BASE_INTANGIBLE_HALF_WIDTH,
      uncertainty,
      scoutQuality,
      effectiveExposure,
    );
    for (const key of PERSONALITY_KEYS) {
      const trueVal = player.personality[key as keyof PlayerPersonality];
      intangibles[key] = noisyRange(trueVal, intangibleHalf, rng);
    }
  }

  const confidence = confidenceFromWidth(
    ratingRangeWidth(estimatedOverall),
    BASE_OVERALL_HALF_WIDTH,
  );

  let positionEstimate = player.position;
  let positionConfidence: ScoutConfidence = "high";
  if (knowledgeLevel === "unknown" || knowledgeLevel === "basic") {
    positionConfidence = knowledgeLevel === "unknown" ? "low" : "medium";
    // Small chance of position confusion at low knowledge — deterministic via rng
    if (knowledgeLevel === "unknown" && rng.nextInt(0, 99) < 15) {
      const positions = ["PG", "SG", "SF", "PF", "C"] as const;
      positionEstimate = positions[rng.nextInt(0, 4)]!;
      positionConfidence = "low";
    }
  }

  return {
    teamId: ctx.teamId,
    prospectPlayerId: prospect.playerId,
    exposure: ctx.exposure,
    effectiveExposure,
    knowledgeLevel,
    confidence,
    estimatedOverall,
    estimatedPotential,
    projectedRank,
    scoutGrade: scoutGradeFromEstimated(estimatedOverall, estimatedPotential),
    estimatedCategories,
    positionEstimate,
    positionConfidence,
    intangibles,
    lastUpdatedOn: ctx.currentDate,
  };
}

export function buildScoutEvaluationContext(
  state: GameState,
  teamId: TeamId,
  prospect: DraftProspect,
  exposure: number,
  regionCoverage: { domestic: number; international: number },
  classSize: number,
): ScoutEvaluationContext {
  const leagueArea = state.settings.league.area ?? "north_america";
  const region = resolveScoutingRegion(leagueArea, prospect.player.nationality);
  return {
    teamId,
    leagueArea,
    region,
    regionCoverage:
      region === "domestic"
        ? regionCoverage.domestic
        : regionCoverage.international,
    exposure,
    currentDate: state.world.calendar.currentDate,
    classSize,
  };
}

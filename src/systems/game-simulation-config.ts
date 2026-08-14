/**
 * Tunable constants for complete game simulation orchestration.
 * Probability formulas remain in shot/pass/rebound/foul/FT resolvers.
 */

export const GAME_SIMULATION_CONFIG = {
  regulationPeriodCount: 4,
  regulationPeriodSeconds: 720,
  overtimePeriodSeconds: 300,
  startingLineupSize: 5,
  /** Base action weights before attribute modifiers (turnover/foul stay rare). */
  actionBaseWeights: {
    shot: 55,
    pass: 30,
    turnover: 6,
    foul: 9,
  },
  /** Clamp for weight(action) = base * modifiers. */
  actionWeightMin: 1,
  actionWeightMax: 120,
  /**
   * Attribute modifiers are multipliers around 1.0 derived from (rating - 50) / 100.
   * High ratings modestly boost related actions; they are never used as raw probabilities.
   */
  attributeModifierScale: 0.35,
  /** Foul subtype weights when foul action is chosen. */
  foulSubtypeWeights: {
    defensiveNonShooting: 70,
    defensiveShooting: 22,
    offensive: 8,
  },
  /** Default possession clock cost range (seconds) by outcome category. */
  possessionTimeSeconds: {
    defaultMin: 8,
    defaultMax: 18,
    turnoverMin: 4,
    turnoverMax: 10,
    foulMin: 5,
    foulMax: 12,
    freeThrowMin: 6,
    freeThrowMax: 14,
  },
} as const;

export type GameSimulationConfig = {
  regulationPeriodCount: number;
  regulationPeriodSeconds: number;
  overtimePeriodSeconds: number;
  startingLineupSize: number;
  actionBaseWeights: {
    shot: number;
    pass: number;
    turnover: number;
    foul: number;
  };
  actionWeightMin: number;
  actionWeightMax: number;
  attributeModifierScale: number;
  foulSubtypeWeights: {
    defensiveNonShooting: number;
    defensiveShooting: number;
    offensive: number;
  };
  possessionTimeSeconds: {
    defaultMin: number;
    defaultMax: number;
    turnoverMin: number;
    turnoverMax: number;
    foulMin: number;
    foulMax: number;
    freeThrowMin: number;
    freeThrowMax: number;
  };
};

export function mergeGameSimulationConfig(
  overrides?: Partial<GameSimulationConfig>,
): GameSimulationConfig {
  if (overrides == null) {
    return { ...GAME_SIMULATION_CONFIG, actionBaseWeights: { ...GAME_SIMULATION_CONFIG.actionBaseWeights }, foulSubtypeWeights: { ...GAME_SIMULATION_CONFIG.foulSubtypeWeights }, possessionTimeSeconds: { ...GAME_SIMULATION_CONFIG.possessionTimeSeconds } };
  }
  return {
    regulationPeriodCount:
      overrides.regulationPeriodCount ??
      GAME_SIMULATION_CONFIG.regulationPeriodCount,
    regulationPeriodSeconds:
      overrides.regulationPeriodSeconds ??
      GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
    overtimePeriodSeconds:
      overrides.overtimePeriodSeconds ??
      GAME_SIMULATION_CONFIG.overtimePeriodSeconds,
    startingLineupSize:
      overrides.startingLineupSize ?? GAME_SIMULATION_CONFIG.startingLineupSize,
    actionBaseWeights: {
      ...GAME_SIMULATION_CONFIG.actionBaseWeights,
      ...overrides.actionBaseWeights,
    },
    actionWeightMin:
      overrides.actionWeightMin ?? GAME_SIMULATION_CONFIG.actionWeightMin,
    actionWeightMax:
      overrides.actionWeightMax ?? GAME_SIMULATION_CONFIG.actionWeightMax,
    attributeModifierScale:
      overrides.attributeModifierScale ??
      GAME_SIMULATION_CONFIG.attributeModifierScale,
    foulSubtypeWeights: {
      ...GAME_SIMULATION_CONFIG.foulSubtypeWeights,
      ...overrides.foulSubtypeWeights,
    },
    possessionTimeSeconds: {
      ...GAME_SIMULATION_CONFIG.possessionTimeSeconds,
      ...overrides.possessionTimeSeconds,
    },
  };
}

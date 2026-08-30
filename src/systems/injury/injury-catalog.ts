/**
 * Config-driven injury catalog — definitions only; no status progressions.
 */

import type {
  ExposureSource,
  InjuryDefinition,
  InjurySeverity,
} from "@/domain/entities/injury";

const SEVERITIES: readonly InjurySeverity[] = [
  "minor",
  "moderate",
  "major",
  "severe",
];

function severityMap<T>(
  minor: T,
  moderate: T,
  major: T,
  severe: T,
): Record<InjurySeverity, T> {
  return { minor, moderate, major, severe };
}

function emptyDist(
  minor: number,
  moderate: number,
  major: number,
  severe: number,
): Record<InjurySeverity, number> {
  return { minor, moderate, major, severe };
}

const PHYSICAL_EFFECTS = {
  light: severityMap(
    [{ attribute: "speed" as const, delta: -2 }],
    [
      { attribute: "speed" as const, delta: -4 },
      { attribute: "athleticism" as const, delta: -3 },
    ],
    [
      { attribute: "speed" as const, delta: -8 },
      { attribute: "athleticism" as const, delta: -6 },
      { attribute: "stamina" as const, delta: -5 },
    ],
    [
      { attribute: "speed" as const, delta: -12 },
      { attribute: "athleticism" as const, delta: -10 },
      { attribute: "stamina" as const, delta: -8 },
      { attribute: "strength" as const, delta: -4 },
    ],
  ),
  upper: severityMap(
    [{ attribute: "strength" as const, delta: -2 }],
    [
      { attribute: "strength" as const, delta: -4 },
      { attribute: "finishing" as const, delta: -3 },
    ],
    [
      { attribute: "strength" as const, delta: -7 },
      { attribute: "finishing" as const, delta: -6 },
      { attribute: "rebounding" as const, delta: -4 },
    ],
    [
      { attribute: "strength" as const, delta: -10 },
      { attribute: "finishing" as const, delta: -9 },
      { attribute: "rebounding" as const, delta: -7 },
      { attribute: "block" as const, delta: -5 },
    ],
  ),
  hand: severityMap(
    [{ attribute: "ballHandling" as const, delta: -2 }],
    [
      { attribute: "ballHandling" as const, delta: -5 },
      { attribute: "passing" as const, delta: -3 },
      { attribute: "freeThrow" as const, delta: -2 },
    ],
    [
      { attribute: "ballHandling" as const, delta: -8 },
      { attribute: "passing" as const, delta: -6 },
      { attribute: "threePoint" as const, delta: -4 },
      { attribute: "freeThrow" as const, delta: -5 },
    ],
    [
      { attribute: "ballHandling" as const, delta: -12 },
      { attribute: "passing" as const, delta: -9 },
      { attribute: "threePoint" as const, delta: -7 },
      { attribute: "freeThrow" as const, delta: -8 },
    ],
  ),
  back: severityMap(
    [{ attribute: "athleticism" as const, delta: -2 }],
    [
      { attribute: "athleticism" as const, delta: -4 },
      { attribute: "stamina" as const, delta: -3 },
      { attribute: "rebounding" as const, delta: -2 },
    ],
    [
      { attribute: "athleticism" as const, delta: -8 },
      { attribute: "stamina" as const, delta: -6 },
      { attribute: "rebounding" as const, delta: -5 },
      { attribute: "interiorDefense" as const, delta: -4 },
    ],
    [
      { attribute: "athleticism" as const, delta: -12 },
      { attribute: "stamina" as const, delta: -10 },
      { attribute: "rebounding" as const, delta: -8 },
      { attribute: "interiorDefense" as const, delta: -7 },
    ],
  ),
};

function def(input: {
  catalogKey: string;
  displayName: string;
  bodyPart: InjuryDefinition["bodyPart"];
  severityDistribution: Record<InjurySeverity, number>;
  recoveryDays: Record<InjurySeverity, { min: number; max: number }>;
  gameRestriction: Record<InjurySeverity, InjuryDefinition["gameRestriction"][InjurySeverity]>;
  practiceRestriction: Record<
    InjurySeverity,
    InjuryDefinition["practiceRestriction"][InjurySeverity]
  >;
  temporaryEffects: InjuryDefinition["temporaryEffects"];
  reinjuryModifier?: Record<InjurySeverity, number>;
  chronicModifier?: number;
  longTermEffectChance?: Record<InjurySeverity, number>;
  typicalExposure: ExposureSource[];
}): InjuryDefinition {
  return {
    catalogKey: input.catalogKey,
    displayName: input.displayName,
    bodyPart: input.bodyPart,
    severityDistribution: input.severityDistribution,
    recoveryDaysRange: input.recoveryDays,
    gameRestriction: input.gameRestriction,
    practiceRestriction: input.practiceRestriction,
    temporaryEffects: input.temporaryEffects,
    reinjuryModifier:
      input.reinjuryModifier ??
      severityMap(0.05, 0.12, 0.22, 0.35),
    chronicModifier: input.chronicModifier ?? 0.02,
    longTermEffectChance:
      input.longTermEffectChance ??
      severityMap(0, 0, 0.02, 0.08),
    typicalExposure: input.typicalExposure,
  };
}

const GAME_AND_PRACTICE: ExposureSource[] = [
  "game_acute",
  "game_overuse",
  "practice",
];
const ALL_EXPOSURE: ExposureSource[] = [
  "game_acute",
  "game_overuse",
  "practice",
  "rehab",
  "offseason_training",
  "off_court",
];

export const INJURY_CATALOG: readonly InjuryDefinition[] = [
  def({
    catalogKey: "ankle_sprain",
    displayName: "Ankle Sprain",
    bodyPart: "ankle",
    severityDistribution: emptyDist(0.45, 0.35, 0.15, 0.05),
    recoveryDays: severityMap(
      { min: 1, max: 5 },
      { min: 5, max: 14 },
      { min: 14, max: 35 },
      { min: 40, max: 90 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: GAME_AND_PRACTICE,
  }),
  def({
    catalogKey: "knee_sprain",
    displayName: "Knee Sprain",
    bodyPart: "knee",
    severityDistribution: emptyDist(0.3, 0.4, 0.22, 0.08),
    recoveryDays: severityMap(
      { min: 3, max: 8 },
      { min: 10, max: 21 },
      { min: 28, max: 60 },
      { min: 90, max: 180 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    longTermEffectChance: severityMap(0, 0, 0.04, 0.12),
    typicalExposure: GAME_AND_PRACTICE,
  }),
  def({
    catalogKey: "hamstring_strain",
    displayName: "Hamstring Strain",
    bodyPart: "hamstring",
    severityDistribution: emptyDist(0.35, 0.4, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 2, max: 7 },
      { min: 7, max: 18 },
      { min: 21, max: 45 },
      { min: 50, max: 100 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    reinjuryModifier: severityMap(0.1, 0.2, 0.3, 0.4),
    typicalExposure: [...GAME_AND_PRACTICE, "offseason_training"],
  }),
  def({
    catalogKey: "quad_strain",
    displayName: "Quad Strain",
    bodyPart: "quad",
    severityDistribution: emptyDist(0.4, 0.35, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 2, max: 6 },
      { min: 6, max: 16 },
      { min: 18, max: 40 },
      { min: 45, max: 90 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: GAME_AND_PRACTICE,
  }),
  def({
    catalogKey: "calf_strain",
    displayName: "Calf Strain",
    bodyPart: "calf",
    severityDistribution: emptyDist(0.4, 0.35, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 2, max: 7 },
      { min: 7, max: 18 },
      { min: 20, max: 42 },
      { min: 45, max: 90 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: GAME_AND_PRACTICE,
  }),
  def({
    catalogKey: "groin_strain",
    displayName: "Groin Strain",
    bodyPart: "groin",
    severityDistribution: emptyDist(0.35, 0.4, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 3, max: 8 },
      { min: 8, max: 20 },
      { min: 21, max: 45 },
      { min: 50, max: 100 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: [...GAME_AND_PRACTICE, "offseason_training"],
  }),
  def({
    catalogKey: "back_spasms",
    displayName: "Back Spasms",
    bodyPart: "back",
    severityDistribution: emptyDist(0.4, 0.35, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 1, max: 5 },
      { min: 5, max: 14 },
      { min: 14, max: 35 },
      { min: 40, max: 90 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.back,
    chronicModifier: 0.05,
    typicalExposure: ALL_EXPOSURE,
  }),
  def({
    catalogKey: "shoulder_strain",
    displayName: "Shoulder Strain",
    bodyPart: "shoulder",
    severityDistribution: emptyDist(0.35, 0.4, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 2, max: 7 },
      { min: 7, max: 18 },
      { min: 21, max: 50 },
      { min: 60, max: 120 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.upper,
    typicalExposure: GAME_AND_PRACTICE,
  }),
  def({
    catalogKey: "wrist_sprain",
    displayName: "Wrist Sprain",
    bodyPart: "wrist",
    severityDistribution: emptyDist(0.45, 0.35, 0.15, 0.05),
    recoveryDays: severityMap(
      { min: 1, max: 5 },
      { min: 5, max: 14 },
      { min: 14, max: 30 },
      { min: 35, max: 70 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.hand,
    typicalExposure: ["game_acute", "practice", "off_court"],
  }),
  def({
    catalogKey: "finger_sprain",
    displayName: "Finger Sprain",
    bodyPart: "finger",
    severityDistribution: emptyDist(0.55, 0.3, 0.12, 0.03),
    recoveryDays: severityMap(
      { min: 0, max: 3 },
      { min: 3, max: 10 },
      { min: 10, max: 21 },
      { min: 25, max: 45 },
    ),
    gameRestriction: severityMap("none", "monitor", "limited", "out"),
    practiceRestriction: severityMap("full", "modified", "rehab", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.hand,
    typicalExposure: ["game_acute", "practice"],
  }),
  def({
    catalogKey: "foot_sprain",
    displayName: "Foot Sprain",
    bodyPart: "foot",
    severityDistribution: emptyDist(0.4, 0.35, 0.2, 0.05),
    recoveryDays: severityMap(
      { min: 2, max: 7 },
      { min: 7, max: 18 },
      { min: 21, max: 45 },
      { min: 50, max: 100 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: GAME_AND_PRACTICE,
  }),
  def({
    catalogKey: "achilles_soreness",
    displayName: "Achilles Soreness",
    bodyPart: "achilles",
    severityDistribution: emptyDist(0.35, 0.35, 0.2, 0.1),
    recoveryDays: severityMap(
      { min: 3, max: 10 },
      { min: 10, max: 25 },
      { min: 30, max: 75 },
      { min: 120, max: 250 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    longTermEffectChance: severityMap(0, 0.01, 0.06, 0.2),
    typicalExposure: [...GAME_AND_PRACTICE, "game_overuse", "offseason_training"],
  }),
  def({
    catalogKey: "hip_pointer",
    displayName: "Hip Contusion",
    bodyPart: "hip",
    severityDistribution: emptyDist(0.5, 0.35, 0.12, 0.03),
    recoveryDays: severityMap(
      { min: 1, max: 4 },
      { min: 4, max: 12 },
      { min: 12, max: 28 },
      { min: 30, max: 60 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: ["game_acute", "practice"],
  }),
  def({
    catalogKey: "concussion",
    displayName: "Concussion",
    bodyPart: "head",
    severityDistribution: emptyDist(0.25, 0.45, 0.25, 0.05),
    recoveryDays: severityMap(
      { min: 3, max: 7 },
      { min: 7, max: 14 },
      { min: 14, max: 28 },
      { min: 30, max: 60 },
    ),
    gameRestriction: severityMap("out", "out", "out", "out"),
    practiceRestriction: severityMap("none", "none", "none", "none"),
    temporaryEffects: severityMap(
      [{ attribute: "consistency" as const, delta: -3 }],
      [
        { attribute: "consistency" as const, delta: -5 },
        { attribute: "basketballIq" as const, delta: -3 },
      ],
      [
        { attribute: "consistency" as const, delta: -8 },
        { attribute: "basketballIq" as const, delta: -5 },
        { attribute: "offensiveIq" as const, delta: -4 },
      ],
      [
        { attribute: "consistency" as const, delta: -12 },
        { attribute: "basketballIq" as const, delta: -8 },
        { attribute: "offensiveIq" as const, delta: -6 },
        { attribute: "defensiveIq" as const, delta: -6 },
      ],
    ),
    longTermEffectChance: severityMap(0, 0, 0.03, 0.1),
    typicalExposure: ["game_acute"],
  }),
  def({
    catalogKey: "illness",
    displayName: "Illness",
    bodyPart: "abdomen",
    severityDistribution: emptyDist(0.55, 0.35, 0.08, 0.02),
    recoveryDays: severityMap(
      { min: 1, max: 3 },
      { min: 3, max: 8 },
      { min: 8, max: 16 },
      { min: 18, max: 30 },
    ),
    gameRestriction: severityMap("monitor", "out", "out", "out"),
    practiceRestriction: severityMap("modified", "none", "none", "none"),
    temporaryEffects: severityMap(
      [{ attribute: "stamina" as const, delta: -3 }],
      [
        { attribute: "stamina" as const, delta: -6 },
        { attribute: "athleticism" as const, delta: -2 },
      ],
      [
        { attribute: "stamina" as const, delta: -10 },
        { attribute: "athleticism" as const, delta: -4 },
      ],
      [
        { attribute: "stamina" as const, delta: -14 },
        { attribute: "athleticism" as const, delta: -6 },
      ],
    ),
    typicalExposure: ["off_court", "offseason_training"],
  }),
  def({
    catalogKey: "undisclosed",
    displayName: "Undisclosed",
    bodyPart: "unknown",
    severityDistribution: emptyDist(0.25, 0.45, 0.25, 0.05),
    recoveryDays: severityMap(
      { min: 2, max: 6 },
      { min: 6, max: 16 },
      { min: 16, max: 40 },
      { min: 45, max: 90 },
    ),
    gameRestriction: severityMap("monitor", "limited", "out", "out"),
    practiceRestriction: severityMap("modified", "rehab", "none", "none"),
    temporaryEffects: PHYSICAL_EFFECTS.light,
    typicalExposure: ALL_EXPOSURE,
  }),
];

const CATALOG_BY_KEY = new Map(
  INJURY_CATALOG.map((entry) => [entry.catalogKey, entry] as const),
);

export function getInjuryDefinition(
  catalogKey: string,
): InjuryDefinition | undefined {
  return CATALOG_BY_KEY.get(catalogKey);
}

export function listInjuryDefinitionsForExposure(
  source: ExposureSource,
): InjuryDefinition[] {
  return INJURY_CATALOG.filter((entry) =>
    entry.typicalExposure.includes(source),
  );
}

export function pickSeverity(
  definition: InjuryDefinition,
  roll01: number,
): InjurySeverity {
  let cumulative = 0;
  for (const severity of SEVERITIES) {
    cumulative += definition.severityDistribution[severity];
    if (roll01 <= cumulative) {
      return severity;
    }
  }
  return "moderate";
}

export function workloadDefaultsForSeverity(severity: InjurySeverity): {
  recommendedWorkloadMpg: number | null;
  maximumWorkloadMpg: number | null;
  minutesRestriction: number | null;
} {
  switch (severity) {
    case "minor":
      return {
        recommendedWorkloadMpg: 28,
        maximumWorkloadMpg: 34,
        minutesRestriction: 34,
      };
    case "moderate":
      return {
        recommendedWorkloadMpg: 18,
        maximumWorkloadMpg: 24,
        minutesRestriction: 24,
      };
    case "major":
      return {
        recommendedWorkloadMpg: null,
        maximumWorkloadMpg: 0,
        minutesRestriction: 0,
      };
    case "severe":
      return {
        recommendedWorkloadMpg: null,
        maximumWorkloadMpg: 0,
        minutesRestriction: 0,
      };
  }
}

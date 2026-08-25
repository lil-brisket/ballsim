import type {
  PlayerAttributes,
  PlayerPosition,
} from "@/domain/entities/player";
import {
  MENTAL_WEIGHTS,
  PHYSICAL_WEIGHTS,
  SKILL_WEIGHTS,
} from "@/domain/player-overall-rating";

export type EvaluationLevel =
  | "elite"
  | "strong"
  | "average"
  | "weak"
  | "poor";

export type EvaluationCategory =
  | "scoring"
  | "shooting"
  | "playmaking"
  | "rebounding"
  | "defense"
  | "athleticism"
  | "mental";

export type PlayerAttributeEvaluation = {
  category: EvaluationCategory;
  attribute: keyof PlayerAttributes;
  rating: number;
  level: EvaluationLevel;
  label: string;
  polarity: "strength" | "weakness";
};

const ATTRIBUTE_META: Partial<
  Record<
    keyof PlayerAttributes,
    { category: EvaluationCategory; strengthLabel: string; weaknessLabel: string }
  >
> = {
  finishing: {
    category: "scoring",
    strengthLabel: "Elite finisher",
    weaknessLabel: "Poor finishing",
  },
  midRange: {
    category: "scoring",
    strengthLabel: "Strong mid-range scorer",
    weaknessLabel: "Limited mid-range game",
  },
  threePoint: {
    category: "shooting",
    strengthLabel: "Excellent perimeter shooter",
    weaknessLabel: "Poor perimeter shooting",
  },
  freeThrow: {
    category: "shooting",
    strengthLabel: "Excellent free throw shooter",
    weaknessLabel: "Poor free throw shooting",
  },
  ballHandling: {
    category: "playmaking",
    strengthLabel: "Elite ball handler",
    weaknessLabel: "Limited ball handling",
  },
  passing: {
    category: "playmaking",
    strengthLabel: "Playmaker",
    weaknessLabel: "Limited playmaking",
  },
  rebounding: {
    category: "rebounding",
    strengthLabel: "Strong rebounder",
    weaknessLabel: "Weak rebounding",
  },
  perimeterDefense: {
    category: "defense",
    strengthLabel: "High-level perimeter defender",
    weaknessLabel: "Poor perimeter defense",
  },
  interiorDefense: {
    category: "defense",
    strengthLabel: "Interior presence",
    weaknessLabel: "Weak interior defense",
  },
  steal: {
    category: "defense",
    strengthLabel: "Disruptive thief",
    weaknessLabel: "Low steal threat",
  },
  block: {
    category: "defense",
    strengthLabel: "Shot blocker",
    weaknessLabel: "Limited rim protection",
  },
  speed: {
    category: "athleticism",
    strengthLabel: "Elite speed",
    weaknessLabel: "Below-average speed",
  },
  strength: {
    category: "athleticism",
    strengthLabel: "Physical strength",
    weaknessLabel: "Lacks strength",
  },
  athleticism: {
    category: "athleticism",
    strengthLabel: "Explosive athlete",
    weaknessLabel: "Limited athleticism",
  },
  stamina: {
    category: "athleticism",
    strengthLabel: "High stamina",
    weaknessLabel: "Stamina concerns",
  },
  basketballIq: {
    category: "mental",
    strengthLabel: "High basketball IQ",
    weaknessLabel: "Low basketball IQ",
  },
  offensiveIq: {
    category: "mental",
    strengthLabel: "Sharp offensive IQ",
    weaknessLabel: "Limited offensive awareness",
  },
  defensiveIq: {
    category: "mental",
    strengthLabel: "High defensive awareness",
    weaknessLabel: "Low defensive awareness",
  },
  consistency: {
    category: "mental",
    strengthLabel: "Highly consistent",
    weaknessLabel: "Inconsistent performer",
  },
};

function levelForRating(rating: number): EvaluationLevel {
  if (rating >= 88) return "elite";
  if (rating >= 78) return "strong";
  if (rating >= 55) return "average";
  if (rating >= 42) return "weak";
  return "poor";
}

function positionWeight(
  position: PlayerPosition,
  attribute: keyof PlayerAttributes,
): number {
  const skill = SKILL_WEIGHTS[position] as Partial<Record<keyof PlayerAttributes, number>>;
  const physical = PHYSICAL_WEIGHTS[position] as Partial<
    Record<keyof PlayerAttributes, number>
  >;
  const mental = MENTAL_WEIGHTS[position] as Partial<
    Record<keyof PlayerAttributes, number>
  >;
  return skill[attribute] ?? physical[attribute] ?? mental[attribute] ?? 0;
}

/**
 * Derives structured strengths/weaknesses from attributes and position relevance.
 * Only emits non-average evaluations for attributes that matter at the position
 * (weight > 0) or extreme outliers (≥ 85 / ≤ 40).
 */
export function derivePlayerStrengthsWeaknesses(
  position: PlayerPosition,
  attributes: PlayerAttributes,
  maxEach = 4,
): {
  strengths: PlayerAttributeEvaluation[];
  weaknesses: PlayerAttributeEvaluation[];
} {
  const strengths: PlayerAttributeEvaluation[] = [];
  const weaknesses: PlayerAttributeEvaluation[] = [];

  for (const [attribute, meta] of Object.entries(ATTRIBUTE_META) as Array<
    [
      keyof PlayerAttributes,
      NonNullable<(typeof ATTRIBUTE_META)[keyof PlayerAttributes]>,
    ]
  >) {
    const rating = attributes[attribute];
    const weight = positionWeight(position, attribute);
    const level = levelForRating(rating);
    const relevant = weight > 0 || rating >= 85 || rating <= 40;

    if (!relevant || level === "average") {
      continue;
    }

    if (level === "elite" || level === "strong") {
      strengths.push({
        category: meta.category,
        attribute,
        rating,
        level,
        label: meta.strengthLabel,
        polarity: "strength",
      });
    } else {
      weaknesses.push({
        category: meta.category,
        attribute,
        rating,
        level,
        label: meta.weaknessLabel,
        polarity: "weakness",
      });
    }
  }

  strengths.sort((a, b) => {
    const weightDiff =
      positionWeight(position, b.attribute) -
      positionWeight(position, a.attribute);
    if (weightDiff !== 0) return weightDiff;
    return b.rating - a.rating;
  });
  weaknesses.sort((a, b) => {
    const weightDiff =
      positionWeight(position, b.attribute) -
      positionWeight(position, a.attribute);
    if (weightDiff !== 0) return weightDiff;
    return a.rating - b.rating;
  });

  return {
    strengths: strengths.slice(0, maxEach),
    weaknesses: weaknesses.slice(0, maxEach),
  };
}

/** Top N attributes by position skill/physical/mental weight. */
export function topAttributesByPosition(
  position: PlayerPosition,
  attributes: PlayerAttributes,
  count = 5,
): Array<{ attribute: keyof PlayerAttributes; rating: number; weight: number }> {
  const keys = Object.keys(ATTRIBUTE_META) as Array<keyof PlayerAttributes>;
  return keys
    .map((attribute) => ({
      attribute,
      rating: attributes[attribute],
      weight: positionWeight(position, attribute),
    }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || b.rating - a.rating)
    .slice(0, count);
}

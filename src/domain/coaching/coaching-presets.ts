/**
 * Coaching presets: philosophy + rotationStyle applied via separate owners.
 */

import {
  DEFAULT_COACHING_PHILOSOPHY,
  type CoachingPhilosophy,
} from "@/domain/coaching/coaching-philosophy";
import type { RotationStyle } from "@/domain/entities/team-roster-management";

export type CoachingPresetId =
  | "balanced"
  | "fastPace"
  | "defenseFirst"
  | "perimeterHeavy"
  | "insideOut"
  | "development";

export type CoachingPreset = {
  id: CoachingPresetId;
  label: string;
  description: string;
  philosophy: CoachingPhilosophy;
  rotationStyle: RotationStyle;
};

export const COACHING_PRESETS: readonly CoachingPreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Neutral pace, offense, and defense.",
    philosophy: { ...DEFAULT_COACHING_PHILOSOPHY },
    rotationStyle: "balanced",
  },
  {
    id: "fastPace",
    label: "Fast Pace",
    description: "Push the tempo in transition.",
    philosophy: {
      pace: "fast",
      offensiveEmphasis: "balanced",
      defensiveApproach: "balanced",
    },
    rotationStyle: "balanced",
  },
  {
    id: "defenseFirst",
    label: "Defense First",
    description: "Aggressive defense with a tighter rotation.",
    philosophy: {
      pace: "balanced",
      offensiveEmphasis: "balanced",
      defensiveApproach: "aggressive",
    },
    rotationStyle: "tight",
  },
  {
    id: "perimeterHeavy",
    label: "Perimeter Heavy",
    description: "Fast pace with three-point emphasis.",
    philosophy: {
      pace: "fast",
      offensiveEmphasis: "threePointHeavy",
      defensiveApproach: "balanced",
    },
    rotationStyle: "balanced",
  },
  {
    id: "insideOut",
    label: "Inside Out",
    description: "Half-court offense featuring the paint.",
    philosophy: {
      pace: "halfCourt",
      offensiveEmphasis: "inside",
      defensiveApproach: "balanced",
    },
    rotationStyle: "balanced",
  },
  {
    id: "development",
    label: "Development",
    description: "Conservative defense and a deep rotation.",
    philosophy: {
      pace: "balanced",
      offensiveEmphasis: "balanced",
      defensiveApproach: "conservative",
    },
    rotationStyle: "deep",
  },
] as const;

export function getCoachingPreset(
  id: CoachingPresetId,
): CoachingPreset | undefined {
  return COACHING_PRESETS.find((preset) => preset.id === id);
}

export function matchCoachingPreset(
  philosophy: CoachingPhilosophy,
  rotationStyle: RotationStyle,
): CoachingPresetId | "custom" {
  for (const preset of COACHING_PRESETS) {
    if (
      preset.philosophy.pace === philosophy.pace &&
      preset.philosophy.offensiveEmphasis === philosophy.offensiveEmphasis &&
      preset.philosophy.defensiveApproach === philosophy.defensiveApproach &&
      preset.rotationStyle === rotationStyle
    ) {
      return preset.id;
    }
  }
  return "custom";
}

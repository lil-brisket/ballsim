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
  /** Presets never pick a focal player; applying one keeps the current pick. */
  philosophy: Omit<CoachingPhilosophy, "focalPlayerId">;
  rotationStyle: RotationStyle;
};

export const COACHING_PRESETS: readonly CoachingPreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "No tilt anywhere. A safe default while you learn the roster.",
    philosophy: {
      pace: DEFAULT_COACHING_PHILOSOPHY.pace,
      offensiveEmphasis: DEFAULT_COACHING_PHILOSOPHY.offensiveEmphasis,
      defensiveApproach: DEFAULT_COACHING_PHILOSOPHY.defensiveApproach,
    },
    rotationStyle: "balanced",
  },
  {
    id: "fastPace",
    label: "Fast Pace",
    description:
      "Shorter possessions mean more shots for both teams. Suits young, athletic rosters.",
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
    description:
      "More pressure on shooters but more fouls; starters play heavier minutes.",
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
    description:
      "Fast tempo and more three-point attempts. Needs shooters to pay off.",
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
    description:
      "Slow, half-court sets that hunt shots at the rim. Built for strong finishers and bigs.",
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
    description:
      "Safer defense with fewer fouls and a deep bench, so young players get minutes.",
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
  philosophy: Omit<CoachingPhilosophy, "focalPlayerId">,
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

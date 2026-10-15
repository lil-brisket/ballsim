/**
 * 2K-style grouping of the 19 player attributes into seven categories.
 * Shared by the player card and the full profile so both group alike.
 * Pure presentation; never feeds gameplay.
 */

import type { PlayerAttributes } from "@/domain/entities/player";

export type RatingCategoryKey =
  | "insideScoring"
  | "outsideScoring"
  | "playmaking"
  | "athleticism"
  | "defense"
  | "rebounding"
  | "iq";

export type RatingCategoryDefinition = {
  key: RatingCategoryKey;
  label: string;
  attributes: ReadonlyArray<keyof PlayerAttributes>;
};

export const RATING_CATEGORIES: readonly RatingCategoryDefinition[] = [
  { key: "insideScoring", label: "Inside Scoring", attributes: ["finishing"] },
  {
    key: "outsideScoring",
    label: "Outside Scoring",
    attributes: ["midRange", "threePoint", "freeThrow"],
  },
  {
    key: "playmaking",
    label: "Playmaking",
    attributes: ["ballHandling", "passing"],
  },
  {
    key: "athleticism",
    label: "Athleticism",
    attributes: ["speed", "strength", "athleticism", "stamina"],
  },
  {
    key: "defense",
    label: "Defense",
    attributes: ["perimeterDefense", "interiorDefense", "steal", "block"],
  },
  { key: "rebounding", label: "Rebounding", attributes: ["rebounding"] },
  {
    key: "iq",
    label: "IQ",
    attributes: ["basketballIq", "offensiveIq", "defensiveIq", "consistency"],
  },
];

export type CategoryRating = {
  key: RatingCategoryKey;
  label: string;
  /** Rounded mean of the category's attributes. */
  rating: number;
  attributes: Array<{
    key: keyof PlayerAttributes;
    label: string;
    rating: number;
  }>;
};

/** "midRange" -> "Mid Range". */
export function formatAttributeLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** 79 -> 6'7" */
export function formatHeight(inches: number): string {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

export function categoryRatings(
  attributes: PlayerAttributes,
): CategoryRating[] {
  return RATING_CATEGORIES.map((category) => {
    const items = category.attributes.map((key) => ({
      key,
      label: formatAttributeLabel(key),
      rating: attributes[key],
    }));
    const total = items.reduce((sum, item) => sum + item.rating, 0);
    return {
      key: category.key,
      label: category.label,
      rating: Math.round(total / items.length),
      attributes: items,
    };
  });
}

import type {
  PlayerAttributes,
  PlayerPosition,
} from "@/domain/entities/player";

/**
 * The training camp a player attends in the offseason ("balanced" is no
 * camp). Stored as a development focus since schema v77.
 */
export type DevelopmentFocus =
  | "balanced"
  | "shooting"
  | "finishing"
  | "playmaking"
  | "defense"
  | "rebounding"
  | "athleticism"
  | "iq";

export const DEVELOPMENT_FOCUSES: readonly DevelopmentFocus[] = [
  "balanced",
  "shooting",
  "finishing",
  "playmaking",
  "defense",
  "rebounding",
  "athleticism",
  "iq",
];

export function isDevelopmentFocus(value: unknown): value is DevelopmentFocus {
  return (
    typeof value === "string" &&
    (DEVELOPMENT_FOCUSES as readonly string[]).includes(value)
  );
}

/** Attributes each camp works on (balanced: none). */
export const DEVELOPMENT_FOCUS_ATTRIBUTES: Record<
  DevelopmentFocus,
  readonly (keyof PlayerAttributes)[]
> = {
  balanced: [],
  shooting: ["midRange", "threePoint", "freeThrow"],
  finishing: ["finishing", "strength"],
  playmaking: ["ballHandling", "passing", "offensiveIq"],
  defense: ["perimeterDefense", "interiorDefense", "steal", "defensiveIq"],
  rebounding: ["rebounding", "strength", "block"],
  athleticism: ["speed", "athleticism", "stamina"],
  iq: ["basketballIq", "consistency"],
};

/** CPU teams' default focus by position. */
export const DEFAULT_FOCUS_BY_POSITION: Record<
  PlayerPosition,
  DevelopmentFocus
> = {
  PG: "playmaking",
  SG: "shooting",
  SF: "shooting",
  PF: "rebounding",
  C: "defense",
};

/** Owner-chosen camp by player id (schema v77+); missing means balanced. */
export type DevelopmentPlanState = Record<string, DevelopmentFocus>;

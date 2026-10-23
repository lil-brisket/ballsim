import type {
  PlayerAttributes,
  PlayerPosition,
} from "@/domain/entities/player";

/** What a young player works on in the offseason. */
export type DevelopmentFocus =
  | "balanced"
  | "shooting"
  | "playmaking"
  | "defense"
  | "rebounding"
  | "athleticism";

export const DEVELOPMENT_FOCUSES: readonly DevelopmentFocus[] = [
  "balanced",
  "shooting",
  "playmaking",
  "defense",
  "rebounding",
  "athleticism",
];

export function isDevelopmentFocus(value: unknown): value is DevelopmentFocus {
  return (
    typeof value === "string" &&
    (DEVELOPMENT_FOCUSES as readonly string[]).includes(value)
  );
}

/** Attributes each focus works on (balanced: none). */
export const DEVELOPMENT_FOCUS_ATTRIBUTES: Record<
  DevelopmentFocus,
  readonly (keyof PlayerAttributes)[]
> = {
  balanced: [],
  shooting: ["midRange", "threePoint", "freeThrow"],
  playmaking: ["ballHandling", "passing", "offensiveIq"],
  defense: ["perimeterDefense", "interiorDefense", "steal", "defensiveIq"],
  rebounding: ["rebounding", "strength", "block"],
  athleticism: ["speed", "athleticism", "stamina"],
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

/** Owner-chosen focus by player id (schema v77+); missing means balanced. */
export type DevelopmentPlanState = Record<string, DevelopmentFocus>;

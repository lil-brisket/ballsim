/**
 * Derived offensive role for a possession's eligible on-court pool.
 * Ephemeral: never stored on Player.
 */

export type OffensiveRole =
  | "primary_creator"
  | "secondary_creator"
  | "scorer"
  | "role_player"
  | "bench"
  | "low_usage";

export const OFFENSIVE_ROLES: readonly OffensiveRole[] = [
  "primary_creator",
  "secondary_creator",
  "scorer",
  "role_player",
  "bench",
  "low_usage",
] as const;

export const OFFENSIVE_ROLE_LABELS: Record<OffensiveRole, string> = {
  primary_creator: "Primary Creator",
  secondary_creator: "Secondary Creator",
  scorer: "Scorer",
  role_player: "Role Player",
  bench: "Bench",
  low_usage: "Low Usage",
};

export function isOffensiveRole(value: string): value is OffensiveRole {
  return (OFFENSIVE_ROLES as readonly string[]).includes(value);
}

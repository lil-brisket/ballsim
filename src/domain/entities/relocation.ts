import type { TeamId } from "@/domain/ids";

/**
 * Multi-stage relocation process (E11). Not a city field write.
 * Cancellable from explore/negotiate. Cooldown after completion.
 */

export type RelocationStage =
  | "none"
  | "evaluate"
  | "explore"
  | "negotiate"
  | "league_review"
  | "approved"
  | "rejected"
  | "transition"
  | "complete";

export const RELOCATION_STAGES: readonly RelocationStage[] = [
  "none",
  "evaluate",
  "explore",
  "negotiate",
  "league_review",
  "approved",
  "rejected",
  "transition",
  "complete",
] as const;

export type RelocationTarget = {
  city: string;
  name: string;
  abbreviation: string;
  marketSize: number;
};

export type RelocationProcess = {
  teamId: TeamId;
  stage: RelocationStage;
  target: RelocationTarget | null;
  /** Seasons remaining before another relocation may start after complete. */
  cooldownSeasonsRemaining: number;
  /** Fee required at transition (integer dollars). */
  fee: number;
};

export function isRelocationStage(value: unknown): value is RelocationStage {
  return (
    typeof value === "string" &&
    (RELOCATION_STAGES as readonly string[]).includes(value)
  );
}

export function createIdleRelocation(teamId: TeamId): RelocationProcess {
  return {
    teamId,
    stage: "none",
    target: null,
    cooldownSeasonsRemaining: 0,
    fee: 0,
  };
}

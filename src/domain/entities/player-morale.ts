/** Main driver behind a player's mood (for the roster chip). */
export type MoraleReason =
  | "role"
  | "happy_role"
  | "losing"
  | "winning"
  | "underpaid"
  | "extended"
  | "talks_failed"
  | "settled";

export const MORALE_REASONS: readonly MoraleReason[] = [
  "role",
  "happy_role",
  "losing",
  "winning",
  "underpaid",
  "extended",
  "talks_failed",
  "settled",
];

export function isMoraleReason(value: unknown): value is MoraleReason {
  return (
    typeof value === "string" &&
    (MORALE_REASONS as readonly string[]).includes(value)
  );
}

/** One player's mood (schema v76+). Missing entry: 60, settled. */
export type PlayerMorale = {
  /** 0–100; 60 is content. */
  value: number;
  reason: MoraleReason;
  /** Straight weeks under the trade-request line. */
  lowWeeks: number;
  /** Season he last asked for a trade, or null. */
  tradeRequestSeason: number | null;
  /** Season he last complained about minutes, or null. */
  complaintSeason: number | null;
};

/** Morale by player id. */
export type PlayerMoraleState = Record<string, PlayerMorale>;

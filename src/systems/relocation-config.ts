/** Seasons of cooldown after completing a relocation. */
export const RELOCATION_COOLDOWN_SEASONS = 3;

/** Fee charged at transition stage (integer dollars). */
export const RELOCATION_TRANSITION_FEE = 25_000_000;

/** Stage progression order (excluding terminal states). */
export const RELOCATION_STAGE_ORDER = [
  "none",
  "evaluate",
  "explore",
  "negotiate",
  "league_review",
  "approved",
  "transition",
  "complete",
] as const;

export const RELOCATION_CANCELLABLE_STAGES = new Set([
  "explore",
  "negotiate",
]);

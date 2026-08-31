/**
 * Tunable Development League constants.
 */

import { DRAFT_ROOKIE_CONTRACT_YEARS } from "@/systems/draft-config";

export {
  DL_MAX_SEASONS,
  DL_DRAFT_ELIGIBILITY_SEASONS,
  DL_MAX_OPPORTUNITY_BONUS,
} from "@/domain/entities/development-league";

/** Draft eligibility window = rookie contract years + 1. */
export const DL_DRAFT_WINDOW_SEASONS = DRAFT_ROOKIE_CONTRACT_YEARS + 1;

/** Target DL games as a fraction of a typical top-league schedule. */
export const DL_SCHEDULE_FREQUENCY = 0.5;

/** Minimum DL roster size to schedule a game for a team. */
export const DL_MIN_ROSTER_FOR_GAME = 5;

/** Cap on opportunity minutes used in development bonus calc. */
export const DL_MAX_MEANINGFUL_MINUTES_DELTA = 25;

/** Minutes thresholds for auto role labels. */
export const DL_STARTER_TARGET_MPG = 28;
export const DL_ROTATION_TARGET_MPG = 18;

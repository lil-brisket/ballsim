import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { RosterRulesConfigInput } from "@/systems/roster-rules";

/** Default roster bounds for trade validation (signing/waiving/trades). */
export const TRADE_ROSTER_RULES: RosterRulesConfigInput = {
  minRosterSize: 8,
  maxRosterSize: 12,
  startingLineupSize: 5,
  benchSize: 4,
  inactiveSize: 1,
  allowedPositions: [...PLAYER_POSITIONS],
};

/** Over-cap teams may receive at most outgoing * (1 + this percent). */
export const TRADE_SALARY_MATCHING_PERCENT = 0.25;

/** Trade Finder returns at most this many valid candidates. */
export const TRADE_FINDER_MAX_CANDIDATES = 50;

/** Round-1 pick trade value for AI evaluation. */
export const DRAFT_PICK_VALUE_ROUND_1 = 80;

/** Round-2 pick trade value for AI evaluation. */
export const DRAFT_PICK_VALUE_ROUND_2 = 50;

/** Bonus per incoming asset already on the evaluating team's trade block. */
export const TRADE_BLOCK_VALUE_BONUS = 10;

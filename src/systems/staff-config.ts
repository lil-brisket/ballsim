/** Tunable staff economy and Tier 1 modifier constants (Phase E1). */

/** Weeks per salary year for payroll amortization. */
export const STAFF_PAYROLL_WEEKS_PER_YEAR = 52;

/** Buyout fraction of remaining current-year salary when firing mid-contract. */
export const STAFF_BUYOUT_FRACTION = 0.5;

/** Default contract length when hiring. */
export const STAFF_DEFAULT_CONTRACT_YEARS = 3;

/** Base annual salaries by role (scaled by overall later). */
export const STAFF_BASE_SALARY_BY_ROLE: Record<string, number> = {
  general_manager: 2_500_000,
  head_coach: 3_000_000,
  assistant_coach: 800_000,
  scout: 600_000,
  trainer: 700_000,
  medical: 650_000,
  finance: 500_000,
  public_relations: 550_000,
};

/** Quality 50 → 1.0 salary multiplier; ±1% per quality point around 50. */
export const STAFF_SALARY_QUALITY_CENTER = 50;
export const STAFF_SALARY_QUALITY_PCT_PER_POINT = 0.01;

/**
 * GM quality above/below 50 shifts trade acceptance threshold.
 * Positive quality → more willing to accept slightly negative net value.
 */
export const GM_TRADE_THRESHOLD_PER_QUALITY_POINT = 0.02;

/**
 * Scout quality 50 → full draft noise; higher quality reduces noise amplitude.
 * Noise scale = clamp(1 - (quality - 50) * rate, min, max).
 */
export const SCOUT_NOISE_REDUCTION_PER_QUALITY_POINT = 0.012;
export const SCOUT_NOISE_SCALE_MIN = 0.35;
export const SCOUT_NOISE_SCALE_MAX = 1.35;

/**
 * Trainer quality scales development work-ethic / stage magnitude.
 * Multiplier = 1 + (quality - 50) * rate, clamped.
 */
export const TRAINER_DEV_PER_QUALITY_POINT = 0.008;
export const TRAINER_DEV_MULT_MIN = 0.7;
export const TRAINER_DEV_MULT_MAX = 1.3;

/**
 * Head coach quality adds a light tempo/efficiency modifier on top of
 * Team.coachingPhilosophy (not a second philosophy system).
 */
export const HEAD_COACH_TEMPO_PER_QUALITY_POINT = 0.002;
export const HEAD_COACH_EFFICIENCY_PER_QUALITY_POINT = 0.003;

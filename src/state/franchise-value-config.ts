/**
 * Franchise valuation configuration — tuning knobs only.
 * Franchise value is a valuation of durable assets, realized commerce,
 * competitive history, and macro conditions — not an XP score.
 */

/** Dollars of structural potential per marketSize point (1–99). */
export const MARKET_POTENTIAL_PER_POINT = 5_000_000;

/**
 * Share of market potential that is always counted regardless of realization.
 * marketValue = potential × (MARKET_REALIZATION_FLOOR + (1 - floor) × realization)
 */
export const MARKET_REALIZATION_FLOOR = 0.65;

/** Clamp for attendance/capture realization before applying to market. */
export const MARKET_REALIZATION_MIN = 0.45;
export const MARKET_REALIZATION_MAX = 1.05;

/** Mean facility level (1–5) contribution. */
export const FACILITY_MEAN_LEVEL_DOLLARS = 8_000_000;

/** Trailing brand (reputation) dollars per point. Below legacy 3M to avoid double-counting wins. */
export const BRAND_REPUTATION_PER_POINT = 2_000_000;

/** Trailing fan-base (sentiment) dollars per point. */
export const FAN_BASE_SENTIMENT_PER_POINT = 1_000_000;

/**
 * Weight of current reputation/sentiment vs trailing history when history exists.
 * Current state is momentum only.
 */
export const BRAND_CURRENT_MOMENTUM_WEIGHT = 0.2;

/** How many prior seasons feed brand / performance / revenue trailing windows. */
export const HISTORY_TRAIL_SEASONS = 3;

/** Revenue year weights: current, prior, two years ago (renormalized when thin). */
export const REVENUE_YEAR_WEIGHTS = [0.5, 0.3, 0.2] as const;

/**
 * Soft revenue contribution: log1p(normalizedRevenue / scale) × dollars.
 * Caps runaway single-year spikes after weighting.
 */
export const REVENUE_LOG_SCALE = 1_000_000;
export const REVENUE_LOG_DOLLARS = 12_000_000;
export const REVENUE_CONTRIBUTION_CAP = 180_000_000;

/** Profitability: dollars per dollar of trailing net income, then clamp. */
export const PROFIT_PER_DOLLAR = 0.35;
export const PROFIT_CONTRIBUTION_MIN = -50_000_000;
export const PROFIT_CONTRIBUTION_MAX = 90_000_000;

/**
 * Minor cash adjustment: sign(cash) × log1p(|cash|/scale) × dollars.
 * Must stay small so cash hoarding cannot inflate valuation.
 */
export const CASH_LOG_SCALE = 1_000_000;
export const CASH_LOG_DOLLARS = 1_200_000;
export const CASH_CONTRIBUTION_CAP = 12_000_000;

/** Competitive: dollars at 100% trailing win rate. */
export const PERFORMANCE_WIN_PCT_DOLLARS = 45_000_000;

/** Competitive: dollars at 100% playoff appearance rate over trail. */
export const PERFORMANCE_PLAYOFF_RATE_DOLLARS = 35_000_000;

/** Extra dollars scaled by mean playoff depth score (0–1) over trail. */
export const PERFORMANCE_PLAYOFF_DEPTH_DOLLARS = 25_000_000;

/** Current-season win% momentum weight vs trailing (when games played). */
export const PERFORMANCE_CURRENT_MOMENTUM_WEIGHT = 0.25;

/**
 * Championship stock base premium before diminishing returns.
 * effective = sum(decay(age)); premium = BASE × (1 - exp(-k × effective))
 */
export const CHAMPIONSHIP_BASE_PREMIUM = 95_000_000;
export const CHAMPIONSHIP_DIMINISHING_K = 0.45;

/**
 * Exponential recency decay half-life in seasons (≈ weight 0.5 at this age).
 * Age 0 (this season / just won) ≈ 1.0; older titles fade toward ~0.1 by age 20.
 */
export const CHAMPIONSHIP_DECAY_HALF_LIFE_SEASONS = 7;

/** League multiplier bounds (Layer 4). */
export const LEAGUE_MULTIPLIER_MIN = 0.9;
export const LEAGUE_MULTIPLIER_MAX = 1.1;

/** Blend weights for league macro composite before mapping to multiplier. */
export const LEAGUE_POPULARITY_WEIGHT = 0.4;
export const LEAGUE_BROADCAST_WEIGHT = 0.25;
export const LEAGUE_SPONSORSHIP_WEIGHT = 0.25;
export const LEAGUE_CYCLE_WEIGHT = 0.1;

export const LEAGUE_CYCLE_SCORE: Record<"growth" | "stable" | "recession", number> =
  {
    growth: 75,
    stable: 50,
    recession: 25,
  };

/**
 * Inertia: total = (1 - α) × lastSnapshot + α × mark.
 * Mid-season noise only moves the mark.
 */
export const FRANCHISE_VALUE_INERTIA_ALPHA = 0.3;

/**
 * Optional YoY / vs-last-snapshot safety rail.
 * null = disabled (preferred; inertia is the primary stabilizer).
 */
export const FRANCHISE_VALUE_MAX_YOY_CHANGE: number | null = null;

/** Floor for total franchise value. */
export const FRANCHISE_VALUE_FLOOR = 0;

/**
 * Organizational standing thresholds (presentation only — not XP).
 * Calibrated for typical CBL valuations in the hundreds of millions.
 */
export const FRANCHISE_STANDING_THRESHOLDS = {
  emerging: 0,
  established: 380_000_000,
  major: 520_000_000,
  elite: 700_000_000,
  legacy: 900_000_000,
} as const;

/** Default fill-rate realization when no home games have settled yet. */
export const DEFAULT_ATTENDANCE_REALIZATION = 0.75;

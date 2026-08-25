/**
 * Per-team owner operational knobs and slow franchise metrics.
 *
 * Boundary: franchiseOps must not become a miscellaneous bucket.
 * Any new field requires an explicit Phase E subsystem owner and justification
 * (see ARCHITECTURE.md / Phase E plan). Not allowed: contracts, cash/books,
 * relocation process, expansion, league economy, franchise history, mutable
 * franchiseValue.
 *
 * E14 identity fields (aiProfile + ownership axes) are strategy/tendency only —
 * never mirror cash, reputation, payroll, or cap space here.
 */

export type FacilityCategory =
  | "arena"
  | "practice"
  | "training"
  | "medical"
  | "youth"
  | "fan";

export const FACILITY_CATEGORIES: readonly FacilityCategory[] = [
  "arena",
  "practice",
  "training",
  "medical",
  "youth",
  "fan",
] as const;

export const FACILITY_LEVEL_MIN = 1;
export const FACILITY_LEVEL_MAX = 5;

export type FacilityState = {
  level: number;
  /** Remaining weeks until an in-progress upgrade completes; 0 = idle. */
  upgradeWeeksRemaining: number;
};

export type FacilitiesState = Record<FacilityCategory, FacilityState>;

export type MarketingState = {
  /** Annual marketing budget (integer dollars). Weekly burn posts expenses.marketing. */
  budget: number;
  /** Slow demand input 0–100. */
  awareness: number;
};

/** Primary organizational strategy (what the franchise is trying to accomplish). */
export type AiProfile =
  | "conservative"
  | "win_now"
  | "development"
  | "aggressive"
  | "market_growth"
  | "rebuild";

export const AI_PROFILES: readonly AiProfile[] = [
  "conservative",
  "win_now",
  "development",
  "aggressive",
  "market_growth",
  "rebuild",
] as const;

/** Inclusive range for ownership axes (how the org pursues strategy). */
export const OWNERSHIP_AXIS_MIN = 1;
export const OWNERSHIP_AXIS_MAX = 99;

/**
 * Canonical per-team franchise operations record under business.franchiseOps.
 */
export type FranchiseOps = {
  /** E2 — infrastructure levels (not a world arena catalog). */
  facilities: FacilitiesState;
  /** E4 — owner ticket pricing knob (integer dollars). */
  ticketPrice: number;
  /** Premium / club seating price (integer dollars). Own inventory, not a ticket multiplier. */
  premiumTicketPrice: number;
  /** E6 — budget + awareness. */
  marketing: MarketingState;
  /** E5 — fanbase support 0–100. */
  fanSentiment: number;
  /** E8 — visibility 0–100; event-driven bumps + weekly decay. */
  mediaAttention: number;
  /** E3/E11 — demand input 1–99; relocation may change it. */
  marketSize: number;
  /**
   * Season year the franchise entered this league (original clubs = league start;
   * expansion clubs = expansion year). Historical fact for tenure / eras.
   */
  foundedSeasonYear: number;
  /** E14 — primary strategy (immutable during play in this feature). */
  aiProfile: AiProfile;
  /** E14 — spending willingness axis 1–99 (how aggressively it spends). */
  spendingTolerance: number;
  /** E14 — patience axis 1–99 (how long it tolerates poor results). */
  patience: number;
  /** E14 — risk axis 1–99 (how much roster/financial variance it accepts). */
  riskTolerance: number;
};

export function isFacilityCategory(value: unknown): value is FacilityCategory {
  return (
    typeof value === "string" &&
    (FACILITY_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isAiProfile(value: unknown): value is AiProfile {
  return (
    typeof value === "string" &&
    (AI_PROFILES as readonly string[]).includes(value)
  );
}

export function isOwnershipAxis(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= OWNERSHIP_AXIS_MIN &&
    value <= OWNERSHIP_AXIS_MAX
  );
}

export function createDefaultFacilities(): FacilitiesState {
  const facilities = {} as FacilitiesState;
  for (const category of FACILITY_CATEGORIES) {
    facilities[category] = { level: FACILITY_LEVEL_MIN, upgradeWeeksRemaining: 0 };
  }
  return facilities;
}

export function createDefaultFranchiseOps(
  overrides: Partial<FranchiseOps> = {},
): FranchiseOps {
  return {
    facilities: overrides.facilities ?? createDefaultFacilities(),
    ticketPrice: overrides.ticketPrice ?? 45,
    premiumTicketPrice: overrides.premiumTicketPrice ?? 180,
    marketing: overrides.marketing ?? { budget: 2_000_000, awareness: 40 },
    fanSentiment: overrides.fanSentiment ?? 50,
    mediaAttention: overrides.mediaAttention ?? 30,
    marketSize: overrides.marketSize ?? 50,
    foundedSeasonYear: overrides.foundedSeasonYear ?? 2026,
    aiProfile: overrides.aiProfile ?? "conservative",
    spendingTolerance: overrides.spendingTolerance ?? 50,
    patience: overrides.patience ?? 50,
    riskTolerance: overrides.riskTolerance ?? 50,
  };
}

import type { RelationshipExpectation } from "@/simulation/analytics/types";

/**
 * Documented defaults for league sanity diagnostics.
 * Warnings fire on implausible absence / extremes — not "stronger is better."
 */

export const DEFAULT_SANITY_RELATIONSHIPS: Record<
  string,
  RelationshipExpectation
> = {
  "market→franchiseValue": { kind: "directional_positive", minR: 0.15 },
  "market→attendance": { kind: "directional_positive", minR: 0.1 },
  "payroll→winPct": { kind: "weak_positive", minR: 0.05, maxR: 0.75 },
  "winPct→attendance": { kind: "directional_positive", minR: 0.1 },
  "winPct→franchiseValue": { kind: "directional_positive", minR: 0.1 },
  "facilities→franchiseValue": {
    kind: "context_dependent",
    note: "Indirect via development and demand",
  },
  "ticketPrice→attendance": { kind: "directional_negative", maxR: -0.05 },
  "attendance→revenue": { kind: "directional_positive", minR: 0.15 },
};

export const SANITY_WARNING_THRESHOLDS = {
  /** Championship HHI above this is concentrated. */
  championshipHhiHigh: 0.35,
  /** Single-franchise title share. */
  dynastyTitleShare: 0.35,
  /** Rank persistence (autocorrelation) indicating stuck hierarchy. */
  rankPersistenceHigh: 0.75,
  /** Bottom quartile → playoff transition rate floor. */
  bottomToPlayoffFloor: 0.05,
  /** Value rank persistence too high. */
  valueRankPersistenceHigh: 0.85,
  /** Value bottom→top mobility floor. */
  valueBottomToTopFloor: 0.01,
  /** Insolvency rate band (team-seasons). Floor 0 — rare insolvency is informational only via distress. */
  insolvencyRateMin: 0,
  insolvencyRateMax: 0.15,
  /** Financial distress (warning+critical+insolvent) rate max. */
  distressRateMax: 0.4,
  /** Relocation rate (relocated team-seasons / all) band. */
  relocationRateMin: 0,
  relocationRateMax: 0.08,
  /** Warn if zero relocations across large sample and rate would be expected. */
  relocationNeverMinSims: 50,
  /** Facility mean YoY level increase cap. */
  facilityYoYMax: 0.35,
  /** FA / mean salary inflation band. */
  salaryInflationMin: -0.02,
  salaryInflationMax: 0.12,
  /** Franchise value coefficient of variation floor (stdev/mean). */
  valueCvFloor: 0.05,
} as const;

export type SanityWarningThresholds = typeof SANITY_WARNING_THRESHOLDS;

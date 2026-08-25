/**
 * Diagnostic warnings for league sanity reports.
 */

import {
  SANITY_WARNING_THRESHOLDS,
  type SanityWarningThresholds,
} from "@/simulation/league-sanity/config";
import type { LeagueSanityAggregates } from "@/simulation/league-sanity/aggregate";
import type { RelationshipResult } from "@/simulation/league-sanity/correlations";
import type { CausalChainCheck } from "@/simulation/league-sanity/causal-chains";
import type { LeagueSanityWarning } from "@/simulation/league-sanity/types";

export function evaluateSanityWarnings(input: {
  aggregates: LeagueSanityAggregates;
  relationships: RelationshipResult[];
  causalChains: CausalChainCheck[];
  simulations: number;
  thresholds?: SanityWarningThresholds;
}): LeagueSanityWarning[] {
  const t = input.thresholds ?? SANITY_WARNING_THRESHOLDS;
  const a = input.aggregates;
  const warnings: LeagueSanityWarning[] = [];

  if (a.championshipHhi > t.championshipHhiHigh) {
    warnings.push({
      id: "championship_concentration_high",
      severity: "warning",
      message: "Championship concentration (HHI) is high",
      evidence: {
        hhi: a.championshipHhi,
        threshold: t.championshipHhiHigh,
      },
    });
  }

  const maxTitles = a.titlesPerFranchise.max;
  const totalTitles =
    a.titlesPerFranchise.mean * a.titlesPerFranchise.n;
  if (totalTitles > 0 && maxTitles / totalTitles > t.dynastyTitleShare) {
    warnings.push({
      id: "dynasty_lock_in",
      severity: "warning",
      message: "One franchise holds an implausibly large share of titles",
      evidence: {
        maxTitles,
        totalTitles,
        share: maxTitles / totalTitles,
        threshold: t.dynastyTitleShare,
      },
    });
  }

  const rankPersist = a.competitiveMobility.rankPersistence;
  if (rankPersist !== null && rankPersist > t.rankPersistenceHigh) {
    warnings.push({
      id: "competitive_mobility_low",
      severity: "warning",
      message: "Competitive rank persistence is high (stuck hierarchy risk)",
      evidence: {
        rankPersistence: rankPersist,
        bottomToPlayoffRate: a.competitiveMobility.bottomToPlayoffRate,
        threshold: t.rankPersistenceHigh,
      },
    });
  }

  if (a.competitiveMobility.bottomToPlayoffRate < t.bottomToPlayoffFloor) {
    warnings.push({
      id: "bottom_to_playoff_rare",
      severity: "info",
      message: "Bottom-quartile → playoff transitions are rare",
      evidence: {
        rate: a.competitiveMobility.bottomToPlayoffRate,
        floor: t.bottomToPlayoffFloor,
      },
    });
  }

  const valuePersist = a.valueMobility.rankPersistence;
  if (valuePersist !== null && valuePersist > t.valueRankPersistenceHigh) {
    warnings.push({
      id: "value_mobility_low",
      severity: "warning",
      message: "Franchise value ranks are highly persistent",
      evidence: {
        valueRankPersistence: valuePersist,
        bottomToTopRate: a.valueMobility.bottomToTopRate,
        threshold: t.valueRankPersistenceHigh,
      },
    });
  }

  if (a.valueMobility.bottomToTopRate < t.valueBottomToTopFloor) {
    warnings.push({
      id: "value_bottom_to_top_rare",
      severity: "info",
      message: "Bottom→top franchise-value quartile transitions are rare",
      evidence: {
        rate: a.valueMobility.bottomToTopRate,
        floor: t.valueBottomToTopFloor,
      },
    });
  }

  if (
    a.tenure.insolvencyRate < t.insolvencyRateMin ||
    a.tenure.insolvencyRate > t.insolvencyRateMax
  ) {
    warnings.push({
      id: "insolvency_rate_out_of_band",
      severity: "warning",
      message: "Insolvency rate is outside the documented band",
      evidence: {
        rate: a.tenure.insolvencyRate,
        min: t.insolvencyRateMin,
        max: t.insolvencyRateMax,
      },
    });
  }

  if (a.tenure.financialDistressRate > t.distressRateMax) {
    warnings.push({
      id: "distress_rate_high",
      severity: "warning",
      message: "Financial distress rate is high",
      evidence: {
        rate: a.tenure.financialDistressRate,
        max: t.distressRateMax,
      },
    });
  }

  if (
    a.tenure.relocationRate > t.relocationRateMax ||
    (input.simulations >= t.relocationNeverMinSims &&
      a.tenure.relocationRate === 0 &&
      t.relocationRateMin === 0)
  ) {
    const never =
      a.tenure.relocationRate === 0 &&
      input.simulations >= t.relocationNeverMinSims;
    warnings.push({
      id: never ? "relocation_never" : "relocation_rate_high",
      severity: never ? "info" : "warning",
      message: never
        ? "Relocation never occurred across a large sample"
        : "Relocation rate appears high",
      evidence: {
        rate: a.tenure.relocationRate,
        max: t.relocationRateMax,
        simulations: input.simulations,
      },
    });
  }

  if (a.facilityYoYMean !== null && a.facilityYoYMean > t.facilityYoYMax) {
    warnings.push({
      id: "facility_progression_fast",
      severity: "warning",
      message: "Facility progression appears unrealistically fast",
      evidence: {
        meanYoY: a.facilityYoYMean,
        max: t.facilityYoYMax,
      },
    });
  }

  if (a.salaryInflation !== null) {
    if (
      a.salaryInflation < t.salaryInflationMin ||
      a.salaryInflation > t.salaryInflationMax
    ) {
      warnings.push({
        id:
          a.salaryInflation > t.salaryInflationMax
            ? "salary_inflation_explosive"
            : "salary_inflation_stagnant",
        severity: "warning",
        message:
          a.salaryInflation > t.salaryInflationMax
            ? "Free-agent / mean salary inflation appears explosive"
            : "Salary inflation appears stagnant or negative",
        evidence: {
          inflation: a.salaryInflation,
          min: t.salaryInflationMin,
          max: t.salaryInflationMax,
        },
      });
    }
  }

  if (a.franchiseValue.mean > 0) {
    const cv = a.franchiseValue.stdev / a.franchiseValue.mean;
    if (cv < t.valueCvFloor) {
      warnings.push({
        id: "value_convergence",
        severity: "warning",
        message: "Franchise values appear to converge (low CV)",
        evidence: {
          cv,
          floor: t.valueCvFloor,
          mean: a.franchiseValue.mean,
          stdev: a.franchiseValue.stdev,
        },
      });
    }
  }

  for (const rel of input.relationships) {
    if (rel.diagnostic) {
      warnings.push({
        id: `relationship_${rel.expectationKey}`,
        severity: "warning",
        message: `Relationship concern: ${rel.name}`,
        evidence: {
          r: rel.r,
          n: rel.n,
          diagnostic: rel.diagnostic,
        },
      });
    }
  }

  for (const chain of input.causalChains) {
    if (chain.verdict === "fail") {
      warnings.push({
        id: `causal_${chain.id}`,
        severity: "warning",
        message: `Causal chain break: ${chain.description}`,
        evidence: {
          r: chain.observed.r,
          n: chain.observed.n,
          lag: chain.lag,
          note: chain.note,
        },
      });
    }
  }

  return warnings;
}

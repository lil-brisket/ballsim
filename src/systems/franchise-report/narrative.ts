/**
 * Dominant-story narrative for annual franchise reports.
 * Evaluates positive vs negative significance — not first-match-wins.
 */

import type { AnnualFranchiseReport } from "@/domain/entities/annual-franchise-report";

type NarrativeCandidate = {
  weight: number;
  valence: "positive" | "negative" | "mixed";
  text: string;
};

function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

/**
 * Build State of the Franchise narrative from an otherwise-complete report
 * (narrative field may be placeholder).
 */
export function buildFranchiseNarrative(
  report: Omit<AnnualFranchiseReport, "narrative">,
): string {
  const candidates: NarrativeCandidate[] = [];
  const { competitive, financial, franchiseValue, era, eraTransition } = report;

  if (competitive.championship) {
    candidates.push({
      weight: 90,
      valence: "positive",
      text: `A championship season. ${competitive.wins}–${competitive.losses} and a title parade highlight one of the strongest campaigns in franchise history.`,
    });
  }

  if (
    financial.endingCash.value <= 0 ||
    (financial.netIncome.value < -15_000_000 &&
      (financial.endingCash.deltaPct ?? 0) < -0.15)
  ) {
    candidates.push({
      weight: 95,
      valence: "negative",
      text: `Financial pressure defines the year. Cash finished at $${Math.round(financial.endingCash.value / 1e6)}M while payroll and expenses outpaced revenue.`,
    });
  }

  if (
    competitive.championship &&
    (financial.endingCash.value <= 0 || financial.netIncome.value < -20_000_000)
  ) {
    candidates.push({
      weight: 100,
      valence: "mixed",
      text: `Champions — but at a cost. A title run masks serious financial strain as cash and operating income moved the wrong direction.`,
    });
  }

  const winDelta = competitive.winPct.delta;
  if (winDelta !== null && winDelta >= 0.08) {
    candidates.push({
      weight: 70,
      valence: "positive",
      text: `The franchise took a major step forward. A ${competitive.wins}-win campaign marked a clear competitive breakthrough${franchiseValue.deltaPct !== null && franchiseValue.deltaPct > 0 ? ` while franchise value rose ${fmtPct(franchiseValue.deltaPct)}` : ""}.`,
    });
  }

  if (winDelta !== null && winDelta <= -0.08) {
    candidates.push({
      weight: 72,
      valence: "negative",
      text: `The organization appears to be entering a transition period. Winning percentage fell ${fmtPct(winDelta)} and the competitive outlook softened.`,
    });
  }

  if (eraTransition.occurred && eraTransition.message) {
    candidates.push({
      weight: 75,
      valence: "mixed",
      text: `A new era begins. ${eraTransition.message}. ${era?.explanation[0] ?? ""}`.trim(),
    });
  }

  const attDelta = report.commercial.attendance.deltaPct;
  if (
    franchiseValue.deltaPct !== null &&
    franchiseValue.deltaPct >= 0.05 &&
    attDelta !== null &&
    attDelta > 0
  ) {
    candidates.push({
      weight: 60,
      valence: "positive",
      text: `Attendance and franchise value both moved higher, reinforcing commercial momentum around a ${competitive.wins}–${competitive.losses} season.`,
    });
  }

  if (
    financial.payroll.deltaPct !== null &&
    financial.payroll.deltaPct > 0.1 &&
    financial.revenue.deltaPct !== null &&
    financial.revenue.deltaPct < financial.payroll.deltaPct
  ) {
    candidates.push({
      weight: 68,
      valence: "negative",
      text: `The team remains competitive, but financial pressure is increasing. Payroll rose significantly faster than revenue${attDelta !== null && attDelta < 0 ? " while attendance declined" : ""}.`,
    });
  }

  for (const milestone of report.historicalSignificance) {
    if (milestone.status === "achieved" && milestone.kind.includes("first")) {
      candidates.push({
        weight: 65,
        valence: "positive",
        text: milestone.message,
      });
    }
  }

  if (era && era.classification === "golden_era") {
    candidates.push({
      weight: 55,
      valence: "positive",
      text: `Current era: ${era.label}. ${era.explanation.slice(0, 2).join(" ")}`,
    });
  }

  if (candidates.length === 0) {
    const traj =
      report.franchiseTrajectory.overall === "positive"
        ? "The franchise is trending in a healthy direction overall."
        : report.franchiseTrajectory.overall === "negative"
          ? "The franchise faces a challenging stretch across multiple dimensions."
          : "The franchise posted a largely stable season without a single dominant storyline.";
    return `${competitive.wins}–${competitive.losses}. ${traj}`;
  }

  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0]!.text;
}

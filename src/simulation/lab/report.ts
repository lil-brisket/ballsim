import type { CheckResult, MetricSummary } from "@/simulation/validation/types";
import type { LabPowerEstimate } from "@/simulation/lab/confidence";
import type {
  FormatLabReportOptions,
  LabReport,
  SimChannel,
} from "@/simulation/lab/types";

export function labExitCode(report: LabReport, channel: SimChannel): number {
  if (report.hardFailures.length > 0) {
    return 1;
  }
  if (report.ksChecks?.some((check) => check.verdict === "FAIL")) {
    return 1;
  }
  if (report.calibrationChecks?.some((check) => check.verdict === "FAIL")) {
    return 1;
  }
  if (channel === "nightly") {
    const statisticalFail = report.statChecks.some(
      (check) => check.verdict === "FAIL",
    );
    if (statisticalFail) {
      return 1;
    }
  }
  return 0;
}

export function formatLabReport(
  report: LabReport,
  options: FormatLabReportOptions = {},
): string {
  if (options.json) {
    return `${JSON.stringify(report, null, 2)}\n`;
  }
  if (options.quiet) {
    return (
      [
        `games=${report.gamesSimulated}`,
        `hard=${report.hardFailures.length}`,
        `warnings=${report.warnings.length}`,
        `statFail=${countVerdict(report.statChecks, "FAIL")}`,
        `checksum=${report.checksum}`,
      ].join(" ") + "\n"
    );
  }

  const identity = report.engineIdentity;
  const lines = [
    "========================================",
    "BALLSIM SIMULATION LAB",
    "========================================",
    "",
    ...(report.runId != null ? [`Run: ${report.runId}`] : []),
    `Seed: ${report.seed}`,
    `Scenario: ${report.scenarioId}`,
    `Games: ${report.gamesSimulated}`,
    `Rotation: ${report.rotation}`,
    `Repro: ${report.reproCommand}`,
    `Checksum: ${report.checksum}`,
    `Engine: version=${identity.engineVersion} package=${identity.packageVersion} schema=${identity.schemaVersion}`,
    `  gameInvariantsChecksum=${identity.gameInvariantsChecksum}`,
    `  plausibilityChecksum=${identity.plausibilityChecksum}`,
    "",
    "HARD_FAILURES",
    "----------------------------------------",
  ];

  if (report.hardFailures.length === 0) {
    lines.push("(none)");
  } else {
    for (const failure of report.hardFailures) {
      lines.push(
        `${failure.rule} [${failure.scope}] ${failure.detail}`,
        `  seed=${failure.seed} scenario=${failure.scenarioId}`,
        `  ${failure.reproCommand}`,
      );
    }
  }

  lines.push(
    "",
    "STATISTICAL CHECKS (not PR-hard; see --channel)",
    "----------------------------------------",
  );
  if (report.statChecks.length === 0) {
    lines.push("(none)");
  } else {
    for (const check of report.statChecks) {
      lines.push(`${check.verdict.padEnd(7)} ${check.message}`);
    }
  }

  if (report.warnings.length > 0) {
    lines.push("", "WARNINGS", "----------------------------------------");
    for (const warning of report.warnings) {
      lines.push(`${warning.rule}: ${warning.detail}`);
    }
  }

  if (report.overtimeHighCount > 0) {
    lines.push("", `LAB_OT_PERIODS_HIGH games: ${report.overtimeHighCount}`);
  }

  if (report.aggregates != null) {
    const a = report.aggregates;
    lines.push(
      "",
      "AGGREGATES (mean, 95% CI, n)",
      "----------------------------------------",
      formatAggregateLine("team_points", a.teamPoints),
      formatAggregateLine("game_totals", a.gameTotals),
      formatAggregateLine("points_per_possession", a.pointsPerPossession),
      formatAggregateLine("field_goal_pct", a.fieldGoalPct, true),
      formatAggregateLine("abs_differential", a.absoluteDifferentials),
    );
  }

  if (report.powerEstimates != null && report.powerEstimates.length > 0) {
    lines.push(
      "",
      "SAMPLE SIZE (two-sample, 80% power, α=0.05)",
      "----------------------------------------",
    );
    for (const estimate of report.powerEstimates) {
      lines.push(formatPowerLine(estimate));
    }
  }

  if (report.gamesNdjsonPath != null) {
    lines.push("", `games.ndjson: ${report.gamesNdjsonPath}`);
  }

  if (report.checkpointPath != null) {
    lines.push(`checkpoint: ${report.checkpointPath}`);
  }

  if (report.ksChecks != null && report.ksChecks.length > 0) {
    lines.push(
      "",
      "GOLDEN BASELINE (KS)",
      "----------------------------------------",
    );
    for (const check of report.ksChecks) {
      lines.push(`${check.verdict.padEnd(7)} ${check.message}`);
    }
  }

  if (report.calibrationChecks != null && report.calibrationChecks.length > 0) {
    lines.push("", "CALIBRATION", "----------------------------------------");
    for (const check of report.calibrationChecks) {
      lines.push(`${check.verdict.padEnd(7)} ${check.message}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function formatAggregateLine(
  name: string,
  summary: MetricSummary,
  asPct = false,
): string {
  const fmt = (value: number) =>
    asPct ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
  const mean = fmt(summary.mean);
  if (summary.ci95Low == null || summary.ci95High == null) {
    return `${name}: mean=${mean} n=${summary.n}`;
  }
  return `${name}: mean=${mean} 95%CI=[${fmt(summary.ci95Low)}, ${fmt(summary.ci95High)}] n=${summary.n}`;
}

function formatPowerLine(estimate: LabPowerEstimate): string {
  return `${estimate.metric} d=${estimate.d} needs ${estimate.games} ${estimate.design} obs/group (observed n=${estimate.observedN})`;
}

function countVerdict(checks: readonly CheckResult[], verdict: string): number {
  return checks.filter((check) => check.verdict === verdict).length;
}

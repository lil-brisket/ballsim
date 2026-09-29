import type { CheckResult } from "@/simulation/validation/types";
import type {
  FormatLabReportOptions,
  LabReport,
  SimChannel,
} from "@/simulation/lab/types";

export function labExitCode(report: LabReport, channel: SimChannel): number {
  if (report.hardFailures.length > 0) {
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
    `Seed: ${report.seed}`,
    `Scenario: ${report.scenarioId}`,
    `Games: ${report.gamesSimulated}`,
    `Rotation: ${report.rotation}`,
    `Repro: ${report.reproCommand}`,
    `Checksum: ${report.checksum}`,
    `Engine: package=${identity.packageVersion} schema=${identity.schemaVersion}`,
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

  return `${lines.join("\n")}\n`;
}

function countVerdict(checks: readonly CheckResult[], verdict: string): number {
  return checks.filter((check) => check.verdict === verdict).length;
}

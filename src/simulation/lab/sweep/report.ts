import type { SweepResult } from "@/simulation/lab/sweep/run-sweep";
import { LAB_SWEEP_PRIMARY_METRIC } from "@/simulation/lab/sweep/run-sweep";

export function formatSweepReport(result: SweepResult): string {
  const lines = [
    "========================================",
    "BALLSIM LAB PARAMETER SWEEP",
    "========================================",
    "",
    `Sampler: ${result.sampler}`,
    `Points: ${result.rows.length}`,
    ...(result.runId != null ? [`Run: ${result.runId}`] : []),
    ...(result.sweepNdjsonPath != null
      ? [`sweep.ndjson: ${result.sweepNdjsonPath}`]
      : []),
    ...(result.sensitivityPath != null
      ? [`sensitivity: ${result.sensitivityPath}`]
      : []),
    "",
    "SENSITIVITY (Spearman |ρ| vs team_points.mean)",
    "----------------------------------------",
  ];
  const primary = result.sensitivity.ranked.filter(
    (row) => row.metric === LAB_SWEEP_PRIMARY_METRIC,
  );
  if (primary.length === 0) {
    lines.push("(none)");
  } else {
    primary.forEach((row, index) => {
      const rho = row.spearmanRho == null ? "n/a" : row.spearmanRho.toFixed(3);
      lines.push(
        `${index + 1}. ${row.parameter}  ρ=${rho}  |ρ|=${row.absRho.toFixed(3)}`,
      );
    });
  }
  lines.push("", "ROWS", "----------------------------------------");
  for (const row of result.rows) {
    const params = Object.entries(row.params)
      .map(([name, value]) => `${name}=${String(value)}`)
      .join(" ");
    lines.push(
      `#${row.index} ${params} teamPts=${row.metrics.teamPointsMean.toFixed(2)} checksum=${row.metrics.checksum}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

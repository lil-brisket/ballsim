/**
 * CLI: BallSim Simulation Lab
 *
 * Usage:
 *   npm run sim -- --seed=42 --games=100 --format json
 *   npm run sim -- --seed=42 --scenario=superteam --rotation=off --channel=pr
 */

import { writeFileSync } from "node:fs";
import {
  formatDryRunPreview,
  formatLabReport,
  formatLabScenarioList,
  formatSweepReport,
  labExitCode,
  LabRunInterruptedError,
  listLabScenarios,
  loadSweepSpace,
  parseLabArgv,
  previewLabGamesRun,
  previewLabSeasonRun,
  runLabGames,
  runLabGamesAsync,
  runLabSeason,
  runLabSweep,
  type LabReport,
} from "@/simulation/lab";
import { LAB_CLI_USAGE } from "@/simulation/lab/lab-config";

function printReport(
  report: LabReport,
  options: ReturnType<typeof parseLabArgv>,
): void {
  const text = formatLabReport(report, {
    json: options.format === "json",
    quiet: options.quiet && options.format !== "json",
  });
  if (options.out) {
    writeFileSync(options.out, text, "utf8");
  }
  if (report.manifestPath) {
    process.stderr.write(`Wrote ${report.manifestPath}\n`);
  }
  process.stdout.write(text);
  process.exitCode = labExitCode(report, options.channel);
}

async function main(): Promise<void> {
  const options = parseLabArgv(process.argv.slice(2));
  if (options.help) {
    console.log(LAB_CLI_USAGE);
    return;
  }
  if (options.listScenarios) {
    const listings = listLabScenarios();
    const text =
      options.format === "json"
        ? `${JSON.stringify(listings, null, 2)}\n`
        : formatLabScenarioList(listings);
    if (options.out) {
      writeFileSync(options.out, text, "utf8");
    }
    process.stdout.write(text);
    return;
  }
  if (options.mode === "owner-career") {
    if (typeof options.seed !== "number") {
      throw new Error("owner-career mode requires a numeric --seed");
    }
    if (
      options.baseline != null ||
      options.writeBaseline != null ||
      options.calibrate ||
      options.ksAlpha != null
    ) {
      throw new Error(
        "--baseline, --write-baseline, --calibrate, and --ks-alpha apply to game mode only",
      );
    }
    if (options.dryRun) {
      const preview = previewLabSeasonRun({
        seed: options.seed,
        seasons: options.seasons,
        persist: options.persist,
        resultsRoot: options.resultsDir,
        keep: options.keep,
      });
      const text =
        options.format === "json"
          ? `${JSON.stringify(preview, null, 2)}\n`
          : formatDryRunPreview(preview);
      if (options.out) {
        writeFileSync(options.out, text, "utf8");
      }
      process.stdout.write(text);
      return;
    }
    const { report } = runLabSeason({
      seed: options.seed,
      seasons: options.seasons,
      persist: options.persist,
      resultsRoot: options.resultsDir,
      runId: options.runId,
      keep: options.keep,
    });
    printReport(report, options);
    return;
  }
  const abort = new AbortController();
  const onInterrupt = (): void => {
    abort.abort();
  };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);
  try {
    if (options.dryRun) {
      if (options.sweep != null) {
        const space = loadSweepSpace(options.sweep);
        const preview = {
          mode: "sweep" as const,
          sampler: options.sampler,
          samples: options.samples,
          seed: options.seed,
          games: options.games,
          scenario: options.scenario,
          rotation: options.rotation,
          parameters: space.parameters.map((param) => param.name),
        };
        const text =
          options.format === "json"
            ? `${JSON.stringify(preview, null, 2)}\n`
            : [
                "LAB DRY RUN (no simulation)",
                `mode=sweep sampler=${preview.sampler} samples=${preview.samples}`,
                `seed=${preview.seed} games=${preview.games} scenario=${preview.scenario} rotation=${preview.rotation}`,
                `parameters=${preview.parameters.join(",")}`,
                "",
              ].join("\n");
        if (options.out) {
          writeFileSync(options.out, text, "utf8");
        }
        process.stdout.write(text);
        return;
      }
      const preview = previewLabGamesRun({
        seed: options.seed,
        games: options.games,
        scenarioId: options.scenario,
        rotation: options.rotation,
        persist: options.persist,
        resultsRoot: options.resultsDir,
        keep: options.keep,
      });
      const text =
        options.format === "json"
          ? `${JSON.stringify(preview, null, 2)}\n`
          : formatDryRunPreview(preview);
      if (options.out) {
        writeFileSync(options.out, text, "utf8");
      }
      process.stdout.write(text);
      return;
    }
    if (options.sweep != null) {
      if (
        options.baseline != null ||
        options.writeBaseline != null ||
        options.calibrate
      ) {
        throw new Error(
          "--sweep cannot be combined with --baseline, --write-baseline, or --calibrate",
        );
      }
      const result = runLabSweep({
        space: loadSweepSpace(options.sweep),
        sampler: options.sampler,
        sampleCount: options.samples,
        seed: options.seed,
        games: options.games,
        scenarioId: options.scenario,
        rotation: options.rotation,
        channel: options.channel,
        persist: options.persist,
        resultsRoot: options.resultsDir,
        runId: options.runId,
        keep: options.keep,
        signal: abort.signal,
      });
      const text =
        options.format === "json"
          ? `${JSON.stringify(result, null, 2)}\n`
          : formatSweepReport(result);
      if (options.out) {
        writeFileSync(options.out, text, "utf8");
      }
      if (result.manifestPath) {
        process.stderr.write(`Wrote ${result.manifestPath}\n`);
      }
      process.stdout.write(text);
      return;
    }
    const runOptions = {
      seed: options.seed,
      games: options.games,
      scenarioId: options.scenario,
      rotation: options.rotation,
      channel: options.channel,
      persist: options.persist,
      resultsRoot: options.resultsDir,
      runId: options.runId,
      jobs: options.jobs,
      chunkSize: options.chunkSize,
      timeoutMs: options.timeoutMs,
      resume: options.resume,
      signal: abort.signal,
      baselinePath: options.baseline,
      writeBaselinePath: options.writeBaseline,
      calibrate: options.calibrate,
      ksAlpha: options.ksAlpha,
      keep: options.keep,
    };
    const report =
      options.jobs > 1 || options.timeoutMs > 0
        ? await runLabGamesAsync(runOptions)
        : runLabGames(runOptions);
    printReport(report, options);
  } finally {
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onInterrupt);
  }
}

main().catch((error: unknown) => {
  if (error instanceof LabRunInterruptedError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Simulation Lab failed: ${message}`);
  process.exitCode = 1;
});

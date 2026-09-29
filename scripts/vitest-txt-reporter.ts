/**
 * Writes a readable test-results.txt after each Vitest run.
 * Attached from vitest.config.mts. Override path with TEST_RESULTS_FILE.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { Reporter, TestCase, TestModule } from "vitest/reporters";

export const DEFAULT_RESULTS_FILE = "test-results.txt";
const MAX_MESSAGE_CHARS = 2000;
const MAX_STACK_LINES = 12;

export type TxtError = {
  name?: string;
  message?: string;
  expected?: unknown;
  actual?: unknown;
  diff?: string;
  stack?: string;
};

export type TxtFailure = {
  project: string;
  file: string;
  name: string;
  errors: TxtError[];
};

export type TxtReportInput = {
  reason: string;
  durationMs: number;
  filesFailed: number;
  filesPassed: number;
  filesTotal: number;
  testsFailed: number;
  testsPassed: number;
  testsSkipped: number;
  testsTotal: number;
  failures: TxtFailure[];
  unhandledErrors: TxtError[];
};

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, "");
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

export function trimFailureMessage(message: string): string {
  const cleaned = stripAnsi(message).trim();
  const cutMarkers = ["\nIgnored nodes:", "\n<body>", "\n<html>"];
  let cut = cleaned;
  for (const marker of cutMarkers) {
    const index = cleaned.indexOf(marker);
    if (index > 0) {
      cut = cleaned.slice(0, index).trim();
      break;
    }
  }
  if (cut.length <= MAX_MESSAGE_CHARS) {
    return cut;
  }
  return `${cut.slice(0, MAX_MESSAGE_CHARS)}\n… (truncated)`;
}

function usefulStackLines(stack: string | undefined): string[] {
  if (!stack) {
    return [];
  }
  const lines = stripAnsi(stack)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const relevant = lines.filter(
    (line) =>
      line.includes("tests/") ||
      line.includes("tests\\") ||
      line.includes("src/") ||
      line.includes("src\\") ||
      line.includes("scripts/") ||
      line.includes("scripts\\"),
  );
  const chosen = (relevant.length > 0 ? relevant : lines.slice(1)).slice(
    0,
    MAX_STACK_LINES,
  );
  return chosen;
}

function formatErrorBlock(error: TxtError, indent: string): string {
  const lines: string[] = [];
  const title = [error.name, trimFailureMessage(error.message ?? "")]
    .filter((part) => part && part.length > 0)
    .join(": ");
  if (title.length > 0) {
    lines.push(`${indent}${title}`);
  }
  if (error.expected !== undefined) {
    lines.push(`${indent}Expected: ${stringifyValue(error.expected)}`);
  }
  if (error.actual !== undefined) {
    lines.push(`${indent}Received: ${stringifyValue(error.actual)}`);
  }
  if (error.diff && error.diff.trim().length > 0) {
    for (const diffLine of stripAnsi(error.diff).trim().split("\n")) {
      lines.push(`${indent}${diffLine}`);
    }
  }
  for (const stackLine of usefulStackLines(error.stack)) {
    lines.push(`${indent}${stackLine}`);
  }
  return lines.join("\n");
}

export function formatTxtReport(input: TxtReportInput): string {
  const lines: string[] = [
    "Vitest results",
    `Outcome: ${input.reason}`,
    `Duration: ${(input.durationMs / 1000).toFixed(2)}s`,
    `Files: ${input.filesFailed} failed | ${input.filesPassed} passed (${input.filesTotal})`,
    `Tests: ${input.testsFailed} failed | ${input.testsPassed} passed | ${input.testsSkipped} skipped (${input.testsTotal})`,
    "",
  ];

  if (input.unhandledErrors.length > 0) {
    lines.push("Unhandled errors", "----------------");
    for (const [index, error] of input.unhandledErrors.entries()) {
      lines.push(`${index + 1})`);
      lines.push(formatErrorBlock(error, "   "));
      lines.push("");
    }
  }

  if (input.failures.length === 0) {
    lines.push("No failing tests.");
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  lines.push(`Failures (${input.failures.length})`, "----------------");
  for (const [index, failure] of input.failures.entries()) {
    const project = failure.project.length > 0 ? ` [${failure.project}]` : "";
    lines.push(`${index + 1})${project} ${failure.file}`);
    lines.push(`   ${failure.name}`);
    for (const error of failure.errors) {
      lines.push(formatErrorBlock(error, "   "));
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function asTxtError(error: {
  name?: string;
  message?: string;
  expected?: unknown;
  actual?: unknown;
  diff?: string;
  stack?: string;
}): TxtError {
  return {
    name: error.name,
    message: error.message,
    expected: error.expected,
    actual: error.actual,
    diff: error.diff,
    stack: error.stack,
  };
}

function collectFailures(testModules: ReadonlyArray<TestModule>): {
  filesFailed: number;
  filesPassed: number;
  testsFailed: number;
  testsPassed: number;
  testsSkipped: number;
  failures: TxtFailure[];
} {
  const failures: TxtFailure[] = [];
  let filesFailed = 0;
  let filesPassed = 0;
  let testsFailed = 0;
  let testsPassed = 0;
  let testsSkipped = 0;

  for (const testModule of testModules) {
    let moduleFailed = testModule.errors().length > 0;
    for (const collectionError of testModule.errors()) {
      failures.push({
        project: testModule.project.name,
        file: testModule.relativeModuleId,
        name: "(module collection)",
        errors: [asTxtError(collectionError)],
      });
    }
    for (const testCase of testModule.children.allTests()) {
      const result = testCase.result();
      if (result.state === "failed") {
        moduleFailed = true;
        testsFailed += 1;
        failures.push(failureFromCase(testCase, result.errors));
      } else if (result.state === "passed") {
        testsPassed += 1;
      } else if (result.state === "skipped") {
        testsSkipped += 1;
      }
    }
    if (moduleFailed) {
      filesFailed += 1;
    } else {
      filesPassed += 1;
    }
  }

  return {
    filesFailed,
    filesPassed,
    testsFailed,
    testsPassed,
    testsSkipped,
    failures,
  };
}

function failureFromCase(
  testCase: TestCase,
  errors: ReadonlyArray<{
    name?: string;
    message?: string;
    expected?: unknown;
    actual?: unknown;
    diff?: string;
    stack?: string;
  }>,
): TxtFailure {
  return {
    project: testCase.project.name,
    file: testCase.module.relativeModuleId,
    name: testCase.fullName,
    errors: errors.map(asTxtError),
  };
}

export function resolveResultsPath(
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env.TEST_RESULTS_FILE?.trim();
  if (override && override.length > 0) {
    return path.isAbsolute(override) ? override : path.join(cwd, override);
  }
  return path.join(cwd, DEFAULT_RESULTS_FILE);
}

export default class TxtReporter implements Reporter {
  private startedAt = Date.now();

  onInit(): void {
    this.startedAt = Date.now();
  }

  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<{
      name?: string;
      message?: string;
      stack?: string;
    }>,
    reason: string,
  ): void {
    const counts = collectFailures(testModules);
    const testsTotal =
      counts.testsFailed + counts.testsPassed + counts.testsSkipped;
    const text = formatTxtReport({
      reason,
      durationMs: Date.now() - this.startedAt,
      filesFailed: counts.filesFailed,
      filesPassed: counts.filesPassed,
      filesTotal: counts.filesFailed + counts.filesPassed,
      testsFailed: counts.testsFailed,
      testsPassed: counts.testsPassed,
      testsSkipped: counts.testsSkipped,
      testsTotal,
      failures: counts.failures,
      unhandledErrors: unhandledErrors.map(asTxtError),
    });
    const outPath = resolveResultsPath();
    writeFileSync(outPath, text, "utf8");
    process.stderr.write(`Wrote ${path.relative(process.cwd(), outPath)}\n`);
  }
}

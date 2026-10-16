import { describe, expect, it } from "vitest";
import {
  COLLECTION_FAILURE_NAME,
  DEFAULT_RESULTS_FILE,
  formatTxtReport,
  lastFailurePath,
  resolveResultsPath,
  trimFailureMessage,
  usefulStackLines,
} from "../../scripts/vitest-txt-reporter";

const TOOLING_STACK = [
  "TypeError: Cannot read properties of undefined (reading 'config')",
  "    at fetchModule (C:/repo/node_modules/vite/dist/node/chunks/node.js:100:20)",
  "    at C:/repo/node_modules/vitest/dist/chunks/cli-api.js:200:5",
  "    at src/application/game-service.ts:1:1",
].join("\n");

describe("trimFailureMessage", () => {
  it("drops testing-library HTML dumps after Ignored nodes", () => {
    const message = [
      "Unable to find an element with the text: /Trade offer/",
      "",
      "Ignored nodes: comments, script, style",
      "<body>",
      "  <div>huge dump</div>",
      "</body>",
    ].join("\n");
    expect(trimFailureMessage(message)).toBe(
      "Unable to find an element with the text: /Trade offer/",
    );
  });
});

describe("formatTxtReport", () => {
  it("lists failed tests with expected, received, and location", () => {
    const text = formatTxtReport({
      reason: "failed",
      durationMs: 12340,
      filesFailed: 1,
      filesPassed: 2,
      filesTotal: 3,
      testsFailed: 1,
      testsPassed: 4,
      testsSkipped: 0,
      testsTotal: 5,
      unhandledErrors: [],
      failures: [
        {
          project: "unit",
          file: "tests/systems/simulation/scheduled-events.test.ts",
          name: "scheduled events > survives save/load with executed status preserved",
          errors: [
            {
              name: "AssertionError",
              message: "expected 'pending' to be 'executed'",
              expected: "executed",
              actual: "pending",
              stack:
                "AssertionError: expected 'pending' to be 'executed'\n    at tests/systems/simulation/scheduled-events.test.ts:108:63",
            },
          ],
        },
      ],
    });
    expect(text).toContain("Outcome: failed");
    expect(text).toContain("Files: 1 failed | 2 passed (3)");
    expect(text).toContain("Tests: 1 failed | 4 passed | 0 skipped (5)");
    expect(text).toContain(
      "1) [unit] tests/systems/simulation/scheduled-events.test.ts",
    );
    expect(text).toContain("Expected: executed");
    expect(text).toContain("Received: pending");
    expect(text).toContain("scheduled-events.test.ts:108:63");
  });

  it("keeps tooling frames for module collection failures", () => {
    const text = formatTxtReport({
      reason: "failed",
      durationMs: 1000,
      filesFailed: 1,
      filesPassed: 0,
      filesTotal: 1,
      testsFailed: 0,
      testsPassed: 0,
      testsSkipped: 0,
      testsTotal: 0,
      unhandledErrors: [],
      failures: [
        {
          project: "unit",
          file: "tests/application/save-lifecycle.test.ts",
          name: COLLECTION_FAILURE_NAME,
          errors: [
            {
              name: "TypeError",
              message: "Cannot read properties of undefined (reading 'config')",
              stack: TOOLING_STACK,
            },
          ],
        },
      ],
    });
    expect(text).toContain("node_modules/vite/dist/node/chunks/node.js:100:20");
    expect(text).toContain("node_modules/vitest/dist/chunks/cli-api.js:200:5");
  });
});

describe("usefulStackLines", () => {
  it("keeps only project frames by default", () => {
    expect(usefulStackLines(TOOLING_STACK)).toEqual([
      "at src/application/game-service.ts:1:1",
    ]);
  });

  it("keeps every frame in full mode, without the message line", () => {
    const lines = usefulStackLines(TOOLING_STACK, true);
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.startsWith("at "))).toBe(true);
  });
});

describe("lastFailurePath", () => {
  it("adds .last-failure before the extension", () => {
    expect(lastFailurePath("/repo/test-results.txt")).toMatch(
      /repo[\\/]test-results\.last-failure\.txt$/,
    );
  });
});

describe("resolveResultsPath", () => {
  it("defaults to test-results.txt in cwd", () => {
    expect(resolveResultsPath("/repo", {})).toMatch(
      new RegExp(`${DEFAULT_RESULTS_FILE}$`),
    );
  });

  it("honors TEST_RESULTS_FILE", () => {
    expect(
      resolveResultsPath("/repo", { TEST_RESULTS_FILE: "tmp/out.txt" }),
    ).toMatch(/tmp[\\/]out\.txt$/);
  });
});

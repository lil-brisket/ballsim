import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESULTS_FILE,
  formatTxtReport,
  resolveResultsPath,
  trimFailureMessage,
} from "../../scripts/vitest-txt-reporter";

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

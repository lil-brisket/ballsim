import { describe, expect, it } from "vitest";
import { situationText } from "@/state/situation-text";

const STORED = {
  detectorKey: "objective_progress",
  summary: "Keep payroll at or below 98750000",
  body: "Progress is 36100000 against a target of 98750000. The gap is large enough to put the mandate at risk.",
  evidence: {
    objectiveType: "payroll_limit",
    target: 98_750_000,
    progress: 36_100_000,
  },
};

describe("situationText", () => {
  it("rewrites stored money objective situations from their evidence", () => {
    expect(situationText(STORED)).toEqual({
      summary: "Keep payroll at or below $98.8M",
      body: "Progress is $36.1M against a target of $98.8M. The gap is large enough to put the mandate at risk.",
    });
  });

  it("leaves non-money objectives and other situations unchanged", () => {
    const wins = {
      ...STORED,
      summary: "Win at least 40 games",
      body: "Progress is 10 toward 40.",
      evidence: {
        objectiveType: "minimum_win_total",
        target: 40,
        progress: 10,
      },
    };
    expect(situationText(wins)).toEqual({
      summary: wins.summary,
      body: wins.body,
    });
    const other = { ...STORED, detectorKey: "sponsor_interest" };
    expect(situationText(other)).toEqual({
      summary: STORED.summary,
      body: STORED.body,
    });
  });
});

import { describe, expect, it } from "vitest";
import { evaluatePortraitCoverage } from "@/systems/portraits/library-coverage";
import { planLibraryTargets } from "@/systems/portraits/plan-library-targets";
import { libraryEntry } from "../../factories/portrait-library";

const planned = (count: number) =>
  planLibraryTargets(count).map((t) => libraryEntry(t.id, t.traits));

describe("evaluatePortraitCoverage", () => {
  it("passes the planned 800-entry library", () => {
    const report = evaluatePortraitCoverage(planned(800));
    expect(report.problems).toEqual([]);
    expect(report.gaps).toEqual([]);
    expect(report.entries).toBe(800);
  });

  it("is deterministic", () => {
    const library = planned(300);
    expect(evaluatePortraitCoverage(library)).toEqual(
      evaluatePortraitCoverage(library),
    );
  });

  it("flags a library that under-represents beards and mustaches", () => {
    const skewed = planLibraryTargets(800)
      .filter(
        (target, index) =>
          ![2, 4, 5, 6].includes(target.traits.facialHair) || index % 4 === 0,
      )
      .map((target) => libraryEntry(target.id, target.traits));
    const report = evaluatePortraitCoverage(skewed);
    expect(report.gaps.some((gap) => gap.trait === "facialHair")).toBe(true);
    expect(
      report.problems.some((problem) => problem.includes("facialHair")),
    ).toBe(true);
    expect(report.mismatchRate.facialHair).toBeGreaterThan(
      evaluatePortraitCoverage(planned(800)).mismatchRate.facialHair,
    );
  });

  it("flags a library missing an entire skin tone", () => {
    const library = planned(800).filter((entry) => entry.traits.skinTone !== 9);
    const report = evaluatePortraitCoverage(library);
    expect(
      report.gaps.some((gap) => gap.trait === "skinTone" && gap.value === 9),
    ).toBe(true);
    expect(report.problems.length).toBeGreaterThan(0);
  });

  it("reports an empty library as a problem", () => {
    expect(evaluatePortraitCoverage([]).problems).toContain(
      "library is empty.",
    );
  });
});

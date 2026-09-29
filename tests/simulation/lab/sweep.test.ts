import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { decodeSweepUnit } from "@/simulation/lab/sweep/decode";
import { gridSamples } from "@/simulation/lab/sweep/grid";
import { latinHypercubeUnits } from "@/simulation/lab/sweep/latin-hypercube";
import { parseSweepSpace } from "@/simulation/lab/sweep/parse-space";
import { formatSweepReport } from "@/simulation/lab/sweep/report";
import { runLabSweep } from "@/simulation/lab/sweep/run-sweep";
import { sampleSweepSpace } from "@/simulation/lab/sweep/sample";
import {
  rankSensitivity,
  spearmanRho,
} from "@/simulation/lab/sweep/sensitivity";
import { sobolUnits } from "@/simulation/lab/sweep/sobol";
import {
  LAB_DEFAULT_SWEEP_SPACE,
  type LabSweepSpace,
} from "@/simulation/lab/sweep/space";

const tinySpace: LabSweepSpace = {
  parameters: [
    { name: "rosterSize", kind: "integer", min: 8, max: 11 },
    { name: "rotation", kind: "enum", values: ["off", "on"] },
  ],
};

describe("latinHypercubeUnits", () => {
  it("places one sample in each stratum per dimension", () => {
    const points = latinHypercubeUnits(8, 2, 99);
    expect(points).toHaveLength(8);
    for (let dim = 0; dim < 2; dim += 1) {
      const strata = points.map((point) => Math.floor(point[dim]! * 8)).sort();
      expect(strata).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    }
  });
});

describe("sobolUnits", () => {
  it("matches the standard first-dimension Gray-code prefix", () => {
    const points = sobolUnits(4, 1);
    expect(points.map((point) => point[0])).toEqual([0.5, 0.75, 0.25, 0.375]);
  });

  it("stays in [0, 1) for 2D samples", () => {
    const points = sobolUnits(16, 2);
    expect(points).toHaveLength(16);
    for (const point of points) {
      expect(point[0]).toBeGreaterThanOrEqual(0);
      expect(point[0]).toBeLessThan(1);
      expect(point[1]).toBeGreaterThanOrEqual(0);
      expect(point[1]).toBeLessThan(1);
    }
  });
});

describe("gridSamples", () => {
  it("emits the cartesian product", () => {
    const rows = gridSamples(tinySpace);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({ rosterSize: 8, rotation: "off" });
    expect(rows[rows.length - 1]).toEqual({ rosterSize: 11, rotation: "on" });
  });
});

describe("decodeSweepUnit", () => {
  it("maps unit coordinates onto integer and enum params", () => {
    const decoded = decodeSweepUnit(tinySpace, [0, 0.9]);
    expect(decoded.rosterSize).toBe(8);
    expect(decoded.rotation).toBe("on");
  });
});

describe("spearmanRho / rankSensitivity", () => {
  it("ranks the parameter that actually moves the output first", () => {
    const x1 = [1, 2, 3, 4, 5, 6];
    const noise = [3, 1, 4, 2, 6, 5];
    const y = x1.map((value) => value * 10);
    expect(spearmanRho(x1, y)).toBeCloseTo(1);
    const ranking = rankSensitivity({
      parameters: ["rosterSize", "seed"],
      paramRows: x1.map((value, index) => ({
        rosterSize: value,
        seed: noise[index]!,
      })),
      metrics: { "team_points.mean": y },
      primaryMetric: "team_points.mean",
    });
    expect(ranking.ranked[0]?.parameter).toBe("rosterSize");
    expect(ranking.ranked[0]?.absRho).toBeGreaterThan(
      ranking.ranked[1]?.absRho ?? 0,
    );
  });
});

describe("parseSweepSpace", () => {
  it("loads a JSON space from disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "lab-space-"));
    const filePath = join(dir, "space.json");
    writeFileSync(
      filePath,
      JSON.stringify({
        parameters: [{ name: "rosterSize", kind: "integer", min: 8, max: 10 }],
      }),
      "utf8",
    );
    try {
      const space = parseSweepSpace(
        JSON.parse(readFileSync(filePath, "utf8")) as unknown,
      );
      expect(space.parameters).toHaveLength(1);
      expect(space.parameters[0]?.name).toBe("rosterSize");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runLabSweep", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits one row per config and a ranked sensitivity table", () => {
    const resultsRoot = mkdtempSync(join(tmpdir(), "lab-sweep-"));
    dirs.push(resultsRoot);
    const result = runLabSweep({
      space: tinySpace,
      sampler: "lhs",
      sampleCount: 6,
      seed: 7,
      games: 1,
      persist: true,
      resultsRoot,
      runId: "phase5-sweep",
      runPoint: (params) => ({
        teamPointsMean: Number(params.rosterSize) * 10,
        gameTotalsMean: Number(params.rosterSize) * 20,
        absDifferentialMean: params.rotation === "on" ? 4 : 1,
        fieldGoalPctMean: 0.45,
        checksum: "stub",
        gamesSimulated: 1,
      }),
    });
    expect(result.rows).toHaveLength(6);
    expect(result.sensitivity.ranked[0]?.parameter).toBe("rosterSize");
    const text = formatSweepReport(result);
    expect(text).toContain("SENSITIVITY");
    expect(text).toContain("rosterSize");
    const ndjson = readFileSync(result.sweepNdjsonPath!, "utf8")
      .trim()
      .split("\n");
    expect(ndjson).toHaveLength(6);
    expect(result.sensitivityPath).toContain("sensitivity.json");
  });

  it("runs a small live lhs sweep", () => {
    const result = runLabSweep({
      space: {
        parameters: [{ name: "rosterSize", kind: "integer", min: 8, max: 10 }],
      },
      sampler: "sobol",
      sampleCount: 3,
      seed: 42,
      games: 1,
      rotation: "off",
      persist: false,
    });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]?.metrics.gamesSimulated).toBe(1);
    expect(
      result.sensitivity.ranked.some((row) => row.parameter === "rosterSize"),
    ).toBe(true);
  });
});

describe("sampleSweepSpace", () => {
  it("uses the default space with lhs", () => {
    const rows = sampleSweepSpace({
      space: LAB_DEFAULT_SWEEP_SPACE,
      sampler: "lhs",
      sampleCount: 4,
      seed: 1,
    });
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveProperty("rosterSize");
    expect(rows[0]).toHaveProperty("rotation");
  });
});

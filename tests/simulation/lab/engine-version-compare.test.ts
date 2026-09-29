import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "@/simulation/lab/engine-version";
import {
  compareEngineVersions,
  compareLabManifests,
  compareLabPayloads,
  engineVersionFromPayload,
} from "@/simulation/lab/manifest";
import { compareScenarioVersions } from "@/simulation/lab/scenario-version";
import { readEngineIdentity } from "@/simulation/lab/engine-identity";
import type { LabRunManifest } from "@/simulation/lab/manifest";

function stubManifest(engineVersion: number): LabRunManifest {
  return {
    runId: "run-a",
    startedAt: "2026-09-29T00:00:00.000Z",
    gitSha: "abc",
    dirty: false,
    nodeVersion: "v20.0.0",
    engineVersion,
    scenarioName: "normal",
    scenarioVersion: 1,
    config: {
      mode: "game",
      seed: 1,
      games: 1,
      scenarioId: "normal",
      rotation: "off",
    },
    seedList: [],
    engineIdentity: readEngineIdentity(),
  };
}

describe("compareEngineVersions", () => {
  it("refuses mismatched engineVersion", () => {
    expect(() => compareEngineVersions(1, 2)).toThrow(/engineVersion 1 !== 2/);
    expect(() => compareLabManifests(stubManifest(1), stubManifest(2))).toThrow(
      /engineVersion/,
    );
    expect(() =>
      compareLabPayloads(
        stubManifest(ENGINE_VERSION),
        stubManifest(ENGINE_VERSION + 1),
      ),
    ).toThrow(/Cannot compare Lab runs/);
  });

  it("allows matching engineVersion", () => {
    expect(() =>
      compareEngineVersions(ENGINE_VERSION, ENGINE_VERSION),
    ).not.toThrow();
    expect(() =>
      compareLabManifests(
        stubManifest(ENGINE_VERSION),
        stubManifest(ENGINE_VERSION),
      ),
    ).not.toThrow();
    expect(
      engineVersionFromPayload({ engineIdentity: readEngineIdentity() }),
    ).toBe(ENGINE_VERSION);
  });
});

describe("compareScenarioVersions", () => {
  it("refuses mismatched scenarioVersion for the same scenario", () => {
    expect(() => compareScenarioVersions(1, 2)).toThrow(
      /scenarioVersion 1 !== 2/,
    );
    const left = stubManifest(ENGINE_VERSION);
    const right = { ...stubManifest(ENGINE_VERSION), scenarioVersion: 2 };
    expect(() => compareLabManifests(left, right)).toThrow(/scenarioVersion/);
  });
});

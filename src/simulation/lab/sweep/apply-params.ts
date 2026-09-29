import { isLabScenarioId } from "@/simulation/lab/scenarios";
import type { LabRotationMode } from "@/simulation/lab/types";
import type { RunLabGamesOptions } from "@/simulation/lab/run-lab-games";
import {
  isLabSweepableParamName,
  type LabSweepableParamName,
} from "@/simulation/lab/sweep/space";

export function applySweepParams(
  base: RunLabGamesOptions,
  params: Record<string, string | number>,
): RunLabGamesOptions {
  const next: RunLabGamesOptions = { ...base };
  for (const [name, value] of Object.entries(params)) {
    if (!isLabSweepableParamName(name)) {
      throw new Error(`Unknown Lab sweep parameter: ${name}`);
    }
    assignParam(next, name, value);
  }
  return next;
}

function assignParam(
  options: RunLabGamesOptions,
  name: LabSweepableParamName,
  value: string | number,
): void {
  if (name === "rosterSize") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error("sweep parameter rosterSize must be an integer.");
    }
    options.rosterSize = value;
    return;
  }
  if (name === "seed") {
    options.seed = value;
    return;
  }
  if (name === "rotation") {
    if (value !== "on" && value !== "off") {
      throw new Error("sweep parameter rotation must be on or off.");
    }
    options.rotation = value as LabRotationMode;
    return;
  }
  if (typeof value !== "string" || !isLabScenarioId(value)) {
    throw new Error(`sweep parameter scenarioId is unknown: ${String(value)}`);
  }
  options.scenarioId = value;
}

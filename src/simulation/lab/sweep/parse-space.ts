import { readFileSync } from "node:fs";
import {
  isLabSweepableParamName,
  LAB_DEFAULT_SWEEP_SPACE,
  type LabSweepParam,
  type LabSweepSpace,
} from "@/simulation/lab/sweep/space";

export function parseSweepSpace(raw: unknown): LabSweepSpace {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Sweep space must be an object.");
  }
  const record = raw as { parameters?: unknown };
  if (!Array.isArray(record.parameters) || record.parameters.length < 1) {
    throw new Error("Sweep space.parameters must be a non-empty array.");
  }
  const parameters = record.parameters.map((item, index) =>
    parseParam(item, index),
  );
  const names = new Set<string>();
  for (const param of parameters) {
    if (names.has(param.name)) {
      throw new Error(`Sweep space has duplicate parameter ${param.name}.`);
    }
    names.add(param.name);
  }
  return { parameters };
}

function parseParam(raw: unknown, index: number): LabSweepParam {
  if (raw == null || typeof raw !== "object") {
    throw new Error(`Sweep parameter ${index} must be an object.`);
  }
  const record = raw as Record<string, unknown>;
  if (
    typeof record.name !== "string" ||
    !isLabSweepableParamName(record.name)
  ) {
    throw new Error(
      `Sweep parameter ${index} name must be rosterSize, rotation, scenarioId, or seed.`,
    );
  }
  if (record.kind === "integer") {
    if (typeof record.min !== "number" || typeof record.max !== "number") {
      throw new Error(
        `Sweep parameter ${record.name} needs integer min and max.`,
      );
    }
    return {
      name: record.name,
      kind: "integer",
      min: record.min,
      max: record.max,
    };
  }
  if (record.kind === "number") {
    if (typeof record.min !== "number" || typeof record.max !== "number") {
      throw new Error(
        `Sweep parameter ${record.name} needs number min and max.`,
      );
    }
    return {
      name: record.name,
      kind: "number",
      min: record.min,
      max: record.max,
    };
  }
  if (record.kind === "enum") {
    if (!Array.isArray(record.values) || record.values.length < 1) {
      throw new Error(`Sweep parameter ${record.name} needs non-empty values.`);
    }
    if (record.values.some((value) => typeof value !== "string")) {
      throw new Error(
        `Sweep parameter ${record.name} enum values must be strings.`,
      );
    }
    return {
      name: record.name,
      kind: "enum",
      values: record.values as string[],
    };
  }
  throw new Error(
    `Sweep parameter ${record.name} kind must be integer, number, or enum.`,
  );
}

export function loadSweepSpace(filePath: string): LabSweepSpace {
  if (filePath === "default") {
    return LAB_DEFAULT_SWEEP_SPACE;
  }
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  return parseSweepSpace(parsed);
}

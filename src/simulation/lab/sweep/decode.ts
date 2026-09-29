import type {
  LabSweepParam,
  LabSweepSpace,
} from "@/simulation/lab/sweep/space";

export function decodeSweepUnit(
  space: LabSweepSpace,
  unit: readonly number[],
): Record<string, string | number> {
  if (unit.length !== space.parameters.length) {
    throw new Error(
      `decodeSweepUnit: expected ${space.parameters.length} coordinates, got ${unit.length}.`,
    );
  }
  const decoded: Record<string, string | number> = {};
  for (let index = 0; index < space.parameters.length; index += 1) {
    const param = space.parameters[index]!;
    decoded[param.name] = decodeParam(param, unit[index]!);
  }
  return decoded;
}

export function decodeParam(
  param: LabSweepParam,
  unit: number,
): string | number {
  if (!Number.isFinite(unit) || unit < 0 || unit > 1) {
    throw new Error(
      `decodeParam: unit coordinate for ${param.name} must be in [0, 1].`,
    );
  }
  const u = unit === 1 ? 0.999999999999 : unit;
  if (param.kind === "integer") {
    if (!Number.isInteger(param.min) || !Number.isInteger(param.max)) {
      throw new Error(
        `decodeParam: ${param.name} integer bounds must be integers.`,
      );
    }
    if (param.max < param.min) {
      throw new Error(`decodeParam: ${param.name} max must be >= min.`);
    }
    const span = param.max - param.min + 1;
    return param.min + Math.min(span - 1, Math.floor(u * span));
  }
  if (param.kind === "number") {
    if (param.max < param.min) {
      throw new Error(`decodeParam: ${param.name} max must be >= min.`);
    }
    return param.min + u * (param.max - param.min);
  }
  if (param.values.length === 0) {
    throw new Error(
      `decodeParam: ${param.name} enum values must be non-empty.`,
    );
  }
  const index = Math.min(
    param.values.length - 1,
    Math.floor(u * param.values.length),
  );
  return param.values[index]!;
}

import { decodeParam } from "@/simulation/lab/sweep/decode";
import {
  LAB_MAX_SWEEP_POINTS,
  type LabSweepSpace,
} from "@/simulation/lab/sweep/space";

export function gridLevels(space: LabSweepSpace): (string | number)[][] {
  return space.parameters.map((param) => {
    if (param.kind === "enum") {
      return [...param.values];
    }
    if (param.kind === "integer") {
      const values: number[] = [];
      for (let value = param.min; value <= param.max; value += 1) {
        values.push(value);
      }
      return values;
    }
    const levels = 5;
    const values: number[] = [];
    for (let index = 0; index < levels; index += 1) {
      const unit = levels === 1 ? 0 : index / (levels - 1);
      values.push(decodeParam(param, unit) as number);
    }
    return values;
  });
}

export function cartesianProduct(
  levels: readonly (readonly (string | number)[])[],
): (string | number)[][] {
  let rows: (string | number)[][] = [[]];
  for (const dim of levels) {
    if (dim.length === 0) {
      throw new Error(
        "cartesianProduct: each dimension must have at least one level.",
      );
    }
    const next: (string | number)[][] = [];
    for (const row of rows) {
      for (const value of dim) {
        next.push([...row, value]);
      }
    }
    rows = next;
    if (rows.length > LAB_MAX_SWEEP_POINTS) {
      throw new Error(
        `gridSamples: cartesian product exceeds ${LAB_MAX_SWEEP_POINTS} points.`,
      );
    }
  }
  return rows;
}

export function gridSamples(
  space: LabSweepSpace,
): Record<string, string | number>[] {
  const product = cartesianProduct(gridLevels(space));
  return product.map((row) => {
    const decoded: Record<string, string | number> = {};
    for (let index = 0; index < space.parameters.length; index += 1) {
      decoded[space.parameters[index]!.name] = row[index]!;
    }
    return decoded;
  });
}

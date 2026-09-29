import { createSeededRng, deriveSeed } from "@/domain/rng";
import type { LabSweepSpace } from "@/simulation/lab/sweep/space";
import { decodeSweepUnit } from "@/simulation/lab/sweep/decode";

export function latinHypercubeUnits(
  sampleCount: number,
  dimensions: number,
  seed: number | string,
): number[][] {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error(
      "latinHypercubeUnits: sampleCount must be a positive integer.",
    );
  }
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new Error(
      "latinHypercubeUnits: dimensions must be a positive integer.",
    );
  }
  const rng = createSeededRng(deriveSeed(seed, "lab-sweep-lhs"));
  const columns: number[][] = [];
  for (let dim = 0; dim < dimensions; dim += 1) {
    const strata = Array.from({ length: sampleCount }, (_, index) => index);
    for (let i = sampleCount - 1; i > 0; i -= 1) {
      const j = rng.nextInt(0, i);
      const swap = strata[i]!;
      strata[i] = strata[j]!;
      strata[j] = swap;
    }
    columns.push(strata.map((stratum) => (stratum + 0.5) / sampleCount));
  }
  const points: number[][] = [];
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const point: number[] = [];
    for (let dim = 0; dim < dimensions; dim += 1) {
      point.push(columns[dim]![sample]!);
    }
    points.push(point);
  }
  return points;
}

export function latinHypercubeSamples(
  space: LabSweepSpace,
  sampleCount: number,
  seed: number | string,
): Record<string, string | number>[] {
  const units = latinHypercubeUnits(sampleCount, space.parameters.length, seed);
  return units.map((unit) => decodeSweepUnit(space, unit));
}

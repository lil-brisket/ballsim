import { decodeSweepUnit } from "@/simulation/lab/sweep/decode";
import { gridSamples } from "@/simulation/lab/sweep/grid";
import { latinHypercubeUnits } from "@/simulation/lab/sweep/latin-hypercube";
import { sobolUnits } from "@/simulation/lab/sweep/sobol";
import {
  LAB_MAX_SWEEP_DIMS,
  LAB_MAX_SWEEP_POINTS,
  type LabSweepSampler,
  type LabSweepSpace,
} from "@/simulation/lab/sweep/space";

export function sampleSweepSpace(input: {
  space: LabSweepSpace;
  sampler: LabSweepSampler;
  sampleCount: number;
  seed: number | string;
}): Record<string, string | number>[] {
  const dimensions = input.space.parameters.length;
  if (dimensions < 1) {
    throw new Error(
      "sampleSweepSpace: space must have at least one parameter.",
    );
  }
  if (dimensions > LAB_MAX_SWEEP_DIMS) {
    throw new Error(
      `sampleSweepSpace: at most ${LAB_MAX_SWEEP_DIMS} parameters are supported.`,
    );
  }
  if (input.sampler === "grid") {
    return gridSamples(input.space);
  }
  if (!Number.isInteger(input.sampleCount) || input.sampleCount < 1) {
    throw new Error(
      "sampleSweepSpace: sampleCount must be a positive integer.",
    );
  }
  if (input.sampleCount > LAB_MAX_SWEEP_POINTS) {
    throw new Error(
      `sampleSweepSpace: sampleCount cannot exceed ${LAB_MAX_SWEEP_POINTS}.`,
    );
  }
  const units =
    input.sampler === "lhs"
      ? latinHypercubeUnits(input.sampleCount, dimensions, input.seed)
      : sobolUnits(input.sampleCount, dimensions);
  return units.map((unit) => decodeSweepUnit(input.space, unit));
}

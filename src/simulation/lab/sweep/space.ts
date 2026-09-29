export const LAB_MAX_SWEEP_POINTS = 256;
export const LAB_MAX_SWEEP_DIMS = 8;
export const LAB_DEFAULT_SWEEP_SAMPLES = 16;
export const LAB_SWEEP_NDJSON_FILENAME = "sweep.ndjson";
export const LAB_SENSITIVITY_FILENAME = "sensitivity.json";

export const LAB_SWEEP_SAMPLERS = ["grid", "lhs", "sobol"] as const;
export type LabSweepSampler = (typeof LAB_SWEEP_SAMPLERS)[number];

export const LAB_SWEEPABLE_PARAM_NAMES = [
  "rosterSize",
  "rotation",
  "scenarioId",
  "seed",
] as const;
export type LabSweepableParamName = (typeof LAB_SWEEPABLE_PARAM_NAMES)[number];

export type LabSweepIntegerParam = {
  name: LabSweepableParamName;
  kind: "integer";
  min: number;
  max: number;
};

export type LabSweepNumberParam = {
  name: LabSweepableParamName;
  kind: "number";
  min: number;
  max: number;
};

export type LabSweepEnumParam = {
  name: LabSweepableParamName;
  kind: "enum";
  values: readonly string[];
};

export type LabSweepParam =
  LabSweepIntegerParam | LabSweepNumberParam | LabSweepEnumParam;

export type LabSweepSpace = {
  parameters: LabSweepParam[];
};

export const LAB_DEFAULT_SWEEP_SPACE: LabSweepSpace = {
  parameters: [
    { name: "rosterSize", kind: "integer", min: 8, max: 15 },
    { name: "rotation", kind: "enum", values: ["off", "on"] },
  ],
};

export function isLabSweepSampler(value: string): value is LabSweepSampler {
  return (LAB_SWEEP_SAMPLERS as readonly string[]).includes(value);
}

export function isLabSweepableParamName(
  value: string,
): value is LabSweepableParamName {
  return (LAB_SWEEPABLE_PARAM_NAMES as readonly string[]).includes(value);
}

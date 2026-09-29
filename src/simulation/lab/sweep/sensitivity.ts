import { pearsonCorrelation } from "@/simulation/validation/correlations";

export type SensitivityRow = {
  parameter: string;
  metric: string;
  spearmanRho: number | null;
  absRho: number;
};

export type SensitivityRanking = {
  primaryMetric: string;
  ranked: SensitivityRow[];
};

function averageRanks(values: readonly number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < indexed.length) {
    let end = start;
    while (
      end + 1 < indexed.length &&
      indexed[end + 1]!.value === indexed[start]!.value
    ) {
      end += 1;
    }
    const average = (start + end) / 2 + 1;
    for (let i = start; i <= end; i += 1) {
      ranks[indexed[i]!.index] = average;
    }
    start = end + 1;
  }
  return ranks;
}

export function spearmanRho(
  xs: readonly number[],
  ys: readonly number[],
): number | null {
  if (xs.length !== ys.length) {
    throw new Error("spearmanRho: xs and ys must have the same length.");
  }
  return pearsonCorrelation(averageRanks(xs), averageRanks(ys));
}

export function encodeParamForSensitivity(
  values: readonly (string | number)[],
): number[] {
  if (values.every((value) => typeof value === "number")) {
    return values as number[];
  }
  const unique = [...new Set(values.map((value) => String(value)))].sort();
  return values.map((value) => unique.indexOf(String(value)));
}

export function rankSensitivity(input: {
  parameters: readonly string[];
  paramRows: readonly Record<string, string | number>[];
  metrics: Readonly<Record<string, number[]>>;
  primaryMetric: string;
}): SensitivityRanking {
  const ranked: SensitivityRow[] = [];
  for (const parameter of input.parameters) {
    const raw = input.paramRows.map((row) => row[parameter]);
    if (raw.some((value) => value == null)) {
      throw new Error(`rankSensitivity: missing parameter ${parameter}.`);
    }
    const xs = encodeParamForSensitivity(raw as (string | number)[]);
    for (const [metric, ys] of Object.entries(input.metrics)) {
      const rho = spearmanRho(xs, ys);
      ranked.push({
        parameter,
        metric,
        spearmanRho: rho,
        absRho: rho == null ? 0 : Math.abs(rho),
      });
    }
  }
  const primary = ranked.filter((row) => row.metric === input.primaryMetric);
  primary.sort((left, right) => right.absRho - left.absRho);
  const order = new Map(primary.map((row, index) => [row.parameter, index]));
  ranked.sort((left, right) => {
    const leftOrder = order.get(left.parameter) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.parameter) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.metric.localeCompare(right.metric);
  });
  return { primaryMetric: input.primaryMetric, ranked };
}

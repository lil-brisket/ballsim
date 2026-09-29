/**
 * Gray-code Sobol sequence. Dimension 0 uses the standard dyadic direction
 * numbers. Dimensions 1..7 use a compact Bratley–Fox / Joe–Kuo table.
 * Point 0 is omitted so samples are not clustered at the origin.
 */
const SOBOL_BITS = 32;
const SCALE = 2 ** SOBOL_BITS;

type SobolDimInit = {
  degree: number;
  coefficient: number;
  m: readonly number[];
};

/** Initial m_i and primitive polynomial data for dimensions 2..8 (1-based). */
const SOBOL_INIT: readonly SobolDimInit[] = [
  { degree: 1, coefficient: 0, m: [1] },
  { degree: 2, coefficient: 1, m: [1, 3] },
  { degree: 3, coefficient: 1, m: [1, 3, 1] },
  { degree: 3, coefficient: 2, m: [1, 1, 1] },
  { degree: 4, coefficient: 1, m: [1, 1, 3, 3] },
  { degree: 4, coefficient: 4, m: [1, 3, 5, 13] },
  { degree: 5, coefficient: 2, m: [1, 1, 5, 5, 17] },
];

function trailingZeroCount(value: number): number {
  if (value === 0) {
    return SOBOL_BITS;
  }
  let count = 0;
  let remaining = value;
  while ((remaining & 1) === 0) {
    remaining >>= 1;
    count += 1;
  }
  return count;
}

function directionNumbers(dimensions: number): number[][] {
  const V: number[][] = [];
  const dim0: number[] = [];
  for (let bit = 0; bit < SOBOL_BITS; bit += 1) {
    dim0.push(1 << (SOBOL_BITS - 1 - bit));
  }
  V.push(dim0);
  for (let dim = 1; dim < dimensions; dim += 1) {
    const init = SOBOL_INIT[dim - 1];
    if (init == null) {
      throw new Error(
        `sobolUnits: only ${SOBOL_INIT.length + 1} dimensions are implemented.`,
      );
    }
    const m = new Array<number>(SOBOL_BITS);
    for (let i = 0; i < init.degree; i += 1) {
      const mi = init.m[i];
      if (mi == null) {
        throw new Error("sobolUnits: incomplete direction numbers.");
      }
      m[i] = mi;
    }
    for (let i = init.degree; i < SOBOL_BITS; i += 1) {
      let next = m[i - init.degree]! ^ (m[i - init.degree]! << init.degree);
      for (let k = 1; k < init.degree; k += 1) {
        if ((init.coefficient >>> (init.degree - 1 - k)) & 1) {
          next ^= m[i - k]! << k;
        }
      }
      m[i] = next >>> 0;
    }
    const row: number[] = [];
    for (let bit = 0; bit < SOBOL_BITS; bit += 1) {
      row.push(m[bit]! << (SOBOL_BITS - 1 - bit));
    }
    V.push(row);
  }
  return V;
}

export function sobolUnits(
  sampleCount: number,
  dimensions: number,
): number[][] {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) {
    throw new Error("sobolUnits: sampleCount must be a positive integer.");
  }
  if (!Number.isInteger(dimensions) || dimensions < 1) {
    throw new Error("sobolUnits: dimensions must be a positive integer.");
  }
  const V = directionNumbers(dimensions);
  const state = new Array<number>(dimensions).fill(0);
  const points: number[][] = [];
  for (let n = 1; n <= sampleCount; n += 1) {
    const bit = trailingZeroCount(n);
    const point: number[] = [];
    for (let dim = 0; dim < dimensions; dim += 1) {
      state[dim] = (state[dim]! ^ V[dim]![bit]!) >>> 0;
      point.push(state[dim]! / SCALE);
    }
    points.push(point);
  }
  return points;
}

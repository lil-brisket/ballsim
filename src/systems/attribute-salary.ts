import type { PlayerAttributes } from "@/domain/entities/player";

/** Base annual salary before attribute-mean scaling (roster gen / rookies). */
export const ATTRIBUTE_SALARY_BASE = 500_000;

/** Dollars per point of mean attributes in annual salary. */
export const ATTRIBUTE_SALARY_PER_MEAN_POINT = 80_000;

/**
 * Attribute-mean annual salary used by roster generation and draft rookies.
 * Deterministic; no RNG.
 */
export function attributeBasedAnnualSalary(
  attributes: PlayerAttributes,
): number {
  const values = Object.values(attributes);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const mean = Math.round(sum / values.length);
  return ATTRIBUTE_SALARY_BASE + mean * ATTRIBUTE_SALARY_PER_MEAN_POINT;
}

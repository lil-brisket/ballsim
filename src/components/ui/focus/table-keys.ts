export const ROW_CONTROL_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Row/control to move to when stepping `step` (+1/-1) rows from `row`.
 * `counts[i]` is how many focusable controls row `i` has; rows with none are
 * skipped, and the move stops at the ends (no wrap). The control keeps its
 * index when the target row has it, otherwise falls back to the first.
 */
export function nextRowControlIndex(
  counts: readonly number[],
  row: number,
  control: number,
  step: 1 | -1,
): { row: number; control: number } | null {
  for (let i = row + step; i >= 0 && i < counts.length; i += step) {
    const count = counts[i] ?? 0;
    if (count > 0) return { row: i, control: control < count ? control : 0 };
  }
  return null;
}

/**
 * Sort header to activate when stepping `step` from the sorted one. `sorted`
 * is the index among sortable headers, or -1 when none is sorted (then both
 * directions start from the first). Clamps at the ends (no wrap); null when
 * nothing would change.
 */
export function nextSortIndex(
  count: number,
  sorted: number,
  step: 1 | -1,
): number | null {
  if (count <= 0) return null;
  if (sorted < 0) return 0;
  const next = Math.min(count - 1, Math.max(0, sorted + step));
  return next === sorted ? null : next;
}

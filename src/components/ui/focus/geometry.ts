export type FocusDirection = "up" | "down" | "left" | "right";

export type FocusRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const KEY_DIRECTION: Record<string, FocusDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

export function directionForKey(key: string): FocusDirection | undefined {
  return KEY_DIRECTION[key];
}

/**
 * Index of the rect to move to from `from` in `direction`, by on-screen
 * position, so grids with mixed tile sizes behave like a controller cursor:
 * candidates must lie in that direction; the closest wins, with sideways
 * offset weighted so a tile straight ahead beats a nearer diagonal one.
 * Undefined at the edge (no wrapping).
 */
export function nearestInDirection(
  rects: readonly FocusRect[],
  from: number,
  direction: FocusDirection,
): number | undefined {
  const origin = rects[from];
  if (!origin) return undefined;
  const ox = (origin.left + origin.right) / 2;
  const oy = (origin.top + origin.bottom) / 2;
  let best: { index: number; score: number } | undefined;

  rects.forEach((rect, index) => {
    if (index === from) return;
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    let along: number;
    let across: number;
    switch (direction) {
      case "up":
        if (rect.bottom > origin.top + 1) return;
        along = oy - cy;
        across = overlapGap(origin.left, origin.right, rect.left, rect.right);
        break;
      case "down":
        if (rect.top < origin.bottom - 1) return;
        along = cy - oy;
        across = overlapGap(origin.left, origin.right, rect.left, rect.right);
        break;
      case "left":
        if (rect.right > origin.left + 1) return;
        along = ox - cx;
        across = overlapGap(origin.top, origin.bottom, rect.top, rect.bottom);
        break;
      case "right":
        if (rect.left < origin.right - 1) return;
        along = cx - ox;
        across = overlapGap(origin.top, origin.bottom, rect.top, rect.bottom);
        break;
    }
    const score = along + across * 3;
    if (!best || score < best.score) best = { index, score };
  });

  return best?.index;
}

/** 0 when two spans overlap, else the gap between them. */
function overlapGap(a1: number, a2: number, b1: number, b2: number): number {
  if (b2 < a1) return a1 - b2;
  if (b1 > a2) return b1 - a2;
  return 0;
}

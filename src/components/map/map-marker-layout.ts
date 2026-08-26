import type { MapCityStatus } from "@/components/map/map-city";

export const MARKER_MIN_SEPARATION = 14;
export const MARKER_MAX_OFFSET = 12;
export const MARKER_LEADER_THRESHOLD = 6;

export type MarkerLayoutInput = {
  id: string;
  x: number;
  y: number;
  status: MapCityStatus;
};

export type MarkerLayoutResult = {
  id: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
  offset: number;
};

function statusPriority(status: MapCityStatus): number {
  if (status === "selected") {
    return 3;
  }
  if (status === "available") {
    return 2;
  }
  return 1;
}

function clampOffset(
  originX: number,
  originY: number,
  x: number,
  y: number,
  maxOffset: number,
): { x: number; y: number } {
  const dx = x - originX;
  const dy = y - originY;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxOffset || dist === 0) {
    return { x, y };
  }
  const scale = maxOffset / dist;
  return { x: originX + dx * scale, y: originY + dy * scale };
}

/**
 * Separates overlapping markers with a small visual offset.
 * Geographic origin never changes; display coordinates may move up to MARKER_MAX_OFFSET.
 */
export function layoutMapMarkers(
  points: readonly MarkerLayoutInput[],
): MarkerLayoutResult[] {
  const laidOut: MarkerLayoutResult[] = points.map((point) => ({
    id: point.id,
    x: point.x,
    y: point.y,
    originX: point.x,
    originY: point.y,
    offset: 0,
  }));
  const priorities = new Map(
    points.map((point) => [point.id, statusPriority(point.status)]),
  );

  for (let pass = 0; pass < 8; pass += 1) {
    let moved = false;
    for (let i = 0; i < laidOut.length; i += 1) {
      for (let j = i + 1; j < laidOut.length; j += 1) {
        const a = laidOut[i]!;
        const b = laidOut[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= MARKER_MIN_SEPARATION || dist === 0) {
          continue;
        }
        const overlap = (MARKER_MIN_SEPARATION - dist) / 2;
        const ux = dist === 0 ? 1 : dx / dist;
        const uy = dist === 0 ? 0 : dy / dist;
        const priorityA = priorities.get(a.id) ?? 0;
        const priorityB = priorities.get(b.id) ?? 0;
        const pushA = priorityA >= priorityB ? 0.15 : 1;
        const pushB = priorityB >= priorityA ? 0.15 : 1;
        const nextA = clampOffset(
          a.originX,
          a.originY,
          a.x - ux * overlap * pushA,
          a.y - uy * overlap * pushA,
          MARKER_MAX_OFFSET,
        );
        const nextB = clampOffset(
          b.originX,
          b.originY,
          b.x + ux * overlap * pushB,
          b.y + uy * overlap * pushB,
          MARKER_MAX_OFFSET,
        );
        if (nextA.x !== a.x || nextA.y !== a.y) {
          a.x = nextA.x;
          a.y = nextA.y;
          moved = true;
        }
        if (nextB.x !== b.x || nextB.y !== b.y) {
          b.x = nextB.x;
          b.y = nextB.y;
          moved = true;
        }
      }
    }
    if (!moved) {
      break;
    }
  }

  for (const point of laidOut) {
    point.offset = Math.hypot(point.x - point.originX, point.y - point.originY);
  }
  return laidOut;
}

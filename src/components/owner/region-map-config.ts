/**
 * Presentation-only map config per league area.
 * Domain city pools remain authoritative in team-cities-by-area.ts.
 */
import type { LeagueArea } from "@/domain/game-settings";

export type RegionMapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type RegionMapConfig = {
  viewBox: string;
  bounds: RegionMapBounds;
  /** Optional simple background silhouette path (SVG path `d`). */
  silhouette?: string;
};

export const REGION_MAP_CONFIG: Record<LeagueArea, RegionMapConfig> = {
  north_america: {
    viewBox: "0 0 800 520",
    bounds: { minLat: 14, maxLat: 62, minLng: -130, maxLng: -60 },
  },
  europe: {
    viewBox: "0 0 800 520",
    bounds: { minLat: 34, maxLat: 62, minLng: -12, maxLng: 40 },
  },
  africa: {
    viewBox: "0 0 800 520",
    bounds: { minLat: -36, maxLat: 38, minLng: -20, maxLng: 60 },
  },
  asia: {
    viewBox: "0 0 800 520",
    bounds: { minLat: -10, maxLat: 50, minLng: 30, maxLng: 150 },
  },
  south_america: {
    viewBox: "0 0 800 520",
    bounds: { minLat: -40, maxLat: 14, minLng: -85, maxLng: -30 },
  },
  global: {
    viewBox: "0 0 800 420",
    bounds: { minLat: -45, maxLat: 65, minLng: -170, maxLng: 180 },
  },
};

export type ProjectedPoint = { x: number; y: number };

/**
 * Equirectangular projection into the region viewBox.
 * Clamps to the drawable area so markers stay inside the SVG.
 */
export function projectCityToMap(
  lat: number,
  lng: number,
  config: RegionMapConfig,
): ProjectedPoint {
  const [vbX, vbY, vbW, vbH] = config.viewBox.split(" ").map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const { minLat, maxLat, minLng, maxLng } = config.bounds;
  const xNorm = (lng - minLng) / (maxLng - minLng);
  const yNorm = (maxLat - lat) / (maxLat - minLat);
  const pad = 24;
  const x = vbX + pad + xNorm * (vbW - pad * 2);
  const y = vbY + pad + yNorm * (vbH - pad * 2);
  return {
    x: Math.min(vbX + vbW - 4, Math.max(vbX + 4, x)),
    y: Math.min(vbY + vbH - 4, Math.max(vbY + 4, y)),
  };
}

/** True when unclamped projection lands inside the padded viewBox. */
export function cityProjectsInsideViewport(
  lat: number,
  lng: number,
  config: RegionMapConfig,
): boolean {
  const [vbX, vbY, vbW, vbH] = config.viewBox.split(" ").map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const { minLat, maxLat, minLng, maxLng } = config.bounds;
  const xNorm = (lng - minLng) / (maxLng - minLng);
  const yNorm = (maxLat - lat) / (maxLat - minLat);
  if (xNorm < 0 || xNorm > 1 || yNorm < 0 || yNorm > 1) {
    return false;
  }
  const pad = 24;
  const x = vbX + pad + xNorm * (vbW - pad * 2);
  const y = vbY + pad + yNorm * (vbH - pad * 2);
  return x >= vbX && x <= vbX + vbW && y >= vbY && y <= vbY + vbH;
}

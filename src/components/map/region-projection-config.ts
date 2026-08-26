/**
 * Per-league-area geographic projection and country filtering.
 * Domain city pools remain authoritative in team-cities-by-area.ts.
 *
 * Geometry source: Natural Earth 50m (world-atlas countries-50m).
 * 110m is too coarse at Europe / North America franchise-picker zoom.
 */
import {
  geoAlbers,
  geoCentroid,
  geoMercator,
  geoNaturalEarth1,
  type GeoProjection,
} from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { LeagueArea } from "@/domain/game-settings";
import worldAtlas from "@/data/geo/countries-50m.json";

export type RegionMapBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type RegionViewport = {
  width: number;
  height: number;
  pad: number;
};

export type RegionMapConfig = {
  bounds: RegionMapBounds;
  viewport: RegionViewport;
  projectionKind: "albers" | "mercator" | "naturalEarth";
};

export const REGION_MAP_CONFIG: Record<LeagueArea, RegionMapConfig> = {
  north_america: {
    bounds: { minLat: 14, maxLat: 62, minLng: -130, maxLng: -52 },
    viewport: { width: 800, height: 520, pad: 20 },
    projectionKind: "albers",
  },
  europe: {
    bounds: { minLat: 35, maxLat: 71, minLng: -11, maxLng: 42 },
    viewport: { width: 800, height: 560, pad: 18 },
    projectionKind: "mercator",
  },
  africa: {
    bounds: { minLat: -36, maxLat: 38, minLng: -20, maxLng: 52 },
    viewport: { width: 720, height: 780, pad: 18 },
    projectionKind: "mercator",
  },
  asia: {
    bounds: { minLat: -12, maxLat: 55, minLng: 32, maxLng: 150 },
    viewport: { width: 900, height: 560, pad: 18 },
    projectionKind: "mercator",
  },
  south_america: {
    bounds: { minLat: -56, maxLat: 14, minLng: -82, maxLng: -34 },
    viewport: { width: 640, height: 780, pad: 18 },
    projectionKind: "mercator",
  },
  global: {
    bounds: { minLat: -56, maxLat: 72, minLng: -170, maxLng: 180 },
    viewport: { width: 960, height: 500, pad: 12 },
    projectionKind: "naturalEarth",
  },
};

type CountryProperties = { name?: string };

type WorldTopology = Topology<{
  countries: GeometryCollection<CountryProperties>;
}>;

const world = worldAtlas as unknown as WorldTopology;

const countriesCollection = feature(
  world,
  world.objects.countries,
) as FeatureCollection<Geometry, CountryProperties>;

let cachedFeatures: Partial<Record<LeagueArea, Feature<Geometry, CountryProperties>[]>> =
  {};

function createBaseProjection(kind: RegionMapConfig["projectionKind"]): GeoProjection {
  if (kind === "albers") {
    return geoAlbers().parallels([29.5, 45.5]).rotate([96, 0]).center([0, 38]);
  }
  if (kind === "naturalEarth") {
    return geoNaturalEarth1();
  }
  return geoMercator();
}

function centroidInBounds(
  geometry: Geometry,
  bounds: RegionMapBounds,
): boolean {
  const [lng, lat] = geoCentroid(geometry);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  );
}

export function getRegionGeoFeatures(
  area: LeagueArea,
): Feature<Geometry, CountryProperties>[] {
  const cached = cachedFeatures[area];
  if (cached) {
    return cached;
  }
  if (area === "global") {
    cachedFeatures[area] = countriesCollection.features;
    return countriesCollection.features;
  }
  const bounds = REGION_MAP_CONFIG[area].bounds;
  const extras =
    area === "europe"
      ? new Set(["Turkey", "Cyprus", "Iceland"])
      : new Set<string>();
  const filtered = countriesCollection.features.filter((entry) => {
    const name = entry.properties?.name ?? "";
    if (extras.has(name)) {
      return true;
    }
    return centroidInBounds(entry.geometry, bounds);
  });
  cachedFeatures[area] = filtered;
  return filtered;
}

function boundsAsFeature(bounds: RegionMapBounds): Feature<Geometry> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
          [bounds.minLng, bounds.maxLat],
          [bounds.minLng, bounds.minLat],
        ],
      ],
    },
  };
}

export function createRegionProjection(
  area: LeagueArea,
  width: number,
  height: number,
): GeoProjection {
  const config = REGION_MAP_CONFIG[area];
  const projection = createBaseProjection(config.projectionKind);
  const pad = config.viewport.pad;
  projection.fitExtent(
    [
      [pad, pad],
      [width - pad, height - pad],
    ],
    boundsAsFeature(config.bounds),
  );
  return projection;
}

export type ProjectedPoint = { x: number; y: number };

export function projectPoint(
  projection: GeoProjection,
  lat: number,
  lng: number,
): ProjectedPoint | null {
  const result = projection([lng, lat]);
  if (!result) {
    return null;
  }
  const [x, y] = result;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

export function projectCityToMap(
  lat: number,
  lng: number,
  area: LeagueArea,
  width?: number,
  height?: number,
): ProjectedPoint {
  const viewport = REGION_MAP_CONFIG[area].viewport;
  const projection = createRegionProjection(
    area,
    width ?? viewport.width,
    height ?? viewport.height,
  );
  return projectPoint(projection, lat, lng) ?? { x: -1, y: -1 };
}

export function cityProjectsInsideViewport(
  lat: number,
  lng: number,
  area: LeagueArea,
): boolean {
  const { width, height } = REGION_MAP_CONFIG[area].viewport;
  const point = projectCityToMap(lat, lng, area, width, height);
  const margin = 8;
  return (
    point.x >= -margin &&
    point.x <= width + margin &&
    point.y >= -margin &&
    point.y <= height + margin
  );
}

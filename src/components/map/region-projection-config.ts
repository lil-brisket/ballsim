/**
 * Per-league-area geographic projection and country filtering.
 * Domain city pools remain authoritative in team-cities-by-area.ts.
 *
 * Geometry source: Natural Earth 50m countries (world-atlas) plus interior
 * admin-1 state/province lines.
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
import { getCitiesForArea } from "@/data/league/city-locations";
import type { LeagueArea } from "@/domain/game-settings";
import worldAtlas from "@/data/geo/countries-50m.json";
import admin1Lines from "@/data/geo/admin1-lines-50m.json";

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
    viewport: { width: 680, height: 620, pad: 24 },
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

type CountryProperties = { name?: string; adm0?: string };

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
let cachedAdmin1: Partial<Record<LeagueArea, Feature<Geometry, CountryProperties>[]>> =
  {};

function forEachPosition(
  coords: unknown,
  visit: (lng: number, lat: number) => boolean,
): boolean {
  if (!Array.isArray(coords) || coords.length === 0) {
    return false;
  }
  if (typeof coords[0] === "number") {
    return visit(Number(coords[0]), Number(coords[1]));
  }
  for (const child of coords) {
    if (forEachPosition(child, visit)) {
      return true;
    }
  }
  return false;
}

function geometryIntersectsBounds(
  geometry: Geometry,
  bounds: RegionMapBounds,
): boolean {
  if (!("coordinates" in geometry)) {
    return false;
  }
  return forEachPosition(geometry.coordinates, (lng, lat) => {
    return (
      lat >= bounds.minLat &&
      lat <= bounds.maxLat &&
      lng >= bounds.minLng &&
      lng <= bounds.maxLng
    );
  });
}

const admin1Collection = admin1Lines as FeatureCollection<
  Geometry,
  { adm0?: string }
>;

export function getRegionAdmin1LineFeatures(
  area: LeagueArea,
): Feature<Geometry, CountryProperties>[] {
  const cached = cachedAdmin1[area];
  if (cached) {
    return cached;
  }
  if (area === "global") {
    cachedAdmin1[area] = [];
    return [];
  }
  const bounds = REGION_MAP_CONFIG[area].bounds;
  const filtered = admin1Collection.features.filter((entry) =>
    geometryIntersectsBounds(entry.geometry, bounds),
  );
  cachedAdmin1[area] = filtered;
  return filtered;
}

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

function regionFitCollection(area: LeagueArea): FeatureCollection<Geometry> {
  const cities = getCitiesForArea(area);
  if (cities.length > 0) {
    return {
      type: "FeatureCollection",
      features: cities.map((city) => ({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [city.lng, city.lat],
        },
      })),
    };
  }
  return {
    type: "FeatureCollection",
    features: getRegionGeoFeatures(area),
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
    regionFitCollection(area),
  );
  projection.clipExtent([
    [0, 0],
    [width, height],
  ]);
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

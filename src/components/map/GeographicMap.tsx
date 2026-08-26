"use client";

import { geoPath } from "d3-geo";
import { useMemo, type CSSProperties } from "react";
import { MapCityMarker } from "@/components/map/MapCityMarker";
import { MapLegend } from "@/components/map/MapLegend";
import type { MapCity } from "@/components/map/map-city";
import {
  layoutMapMarkers,
  MARKER_LEADER_THRESHOLD,
} from "@/components/map/map-marker-layout";
import {
  createRegionProjection,
  getRegionGeoFeatures,
  getRegionAdmin1LineFeatures,
  projectPoint,
  REGION_MAP_CONFIG,
} from "@/components/map/region-projection-config";
import {
  LEAGUE_AREA_LABELS,
  type LeagueArea,
} from "@/domain/game-settings";

const HIT_RADIUS = 8;

export function GeographicMap(props: {
  area: LeagueArea;
  cities: readonly MapCity[];
  onSelectCity: (id: string) => void;
  selectedCityId?: string | null;
  ariaLabel?: string;
  fill?: boolean;
}) {
  const viewport = REGION_MAP_CONFIG[props.area].viewport;

  const projection = useMemo(
    () => createRegionProjection(props.area, viewport.width, viewport.height),
    [props.area, viewport.height, viewport.width],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const features = useMemo(
    () => getRegionGeoFeatures(props.area),
    [props.area],
  );
  const admin1Features = useMemo(
    () => getRegionAdmin1LineFeatures(props.area),
    [props.area],
  );
  const landPaths = useMemo(
    () =>
      features.map((entry, index) => ({
        key: String(entry.properties?.name ?? index),
        d: path(entry) ?? "",
      })),
    [features, path],
  );
  const subdivisionPaths = useMemo(
    () =>
      admin1Features.map((entry, index) => ({
        key: `admin1-${entry.properties?.adm0 ?? "x"}-${index}`,
        d: path(entry) ?? "",
      })),
    [admin1Features, path],
  );

  const projected = useMemo(() => {
    const points = props.cities.flatMap((city) => {
      const point = projectPoint(projection, city.latitude, city.longitude);
      if (!point) {
        return [];
      }
      return [
        {
          city,
          x: Math.round(point.x * 10) / 10,
          y: Math.round(point.y * 10) / 10,
        },
      ];
    });
    const laidOut = layoutMapMarkers(
      points.map((entry) => ({
        id: entry.city.id,
        x: entry.x,
        y: entry.y,
        status: entry.city.status === "occupied" ? "occupied" : "available",
      })),
    );
    const byId = new Map(points.map((entry) => [entry.city.id, entry.city]));
    return laidOut.map((entry) => ({
      ...entry,
      city: byId.get(entry.id)!,
    }));
  }, [projection, props.cities]);

  const selectedId = props.selectedCityId ?? null;
  const markers = useMemo(() => {
    const rank = (entry: (typeof projected)[number]) =>
      entry.city.id === selectedId
        ? 2
        : entry.city.status === "available"
          ? 1
          : 0;
    return [...projected].sort((a, b) => rank(a) - rank(b));
  }, [projected, selectedId]);

  const fill = props.fill === true;

  return (
    <div
      className={
        fill ? "flex h-full min-h-0 flex-col gap-2" : "space-y-3"
      }
    >
      <div
        className={
          fill
            ? "min-h-0 w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 max-lg:aspect-[var(--map-ar)] lg:h-full lg:min-h-0 lg:flex-1 lg:aspect-auto"
            : "overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
        }
        style={
          fill
            ? ({
                ["--map-ar"]: `${viewport.width} / ${viewport.height}`,
              } as CSSProperties)
            : undefined
        }
      >
        <svg
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          preserveAspectRatio="xMidYMid meet"
          className={fill ? "h-full w-full" : "h-auto w-full"}
          style={
            fill
              ? undefined
              : { aspectRatio: `${viewport.width} / ${viewport.height}` }
          }
          role="img"
          suppressHydrationWarning
          aria-label={
            props.ariaLabel ?? `${LEAGUE_AREA_LABELS[props.area]} city map`
          }
        >
          <defs>
            <clipPath id="geo-map-frame">
              <rect
                x={0}
                y={0}
                width={viewport.width}
                height={viewport.height}
              />
            </clipPath>
          </defs>
          <rect
            x={0}
            y={0}
            width={viewport.width}
            height={viewport.height}
            className="fill-zinc-950"
          />
          <g clipPath="url(#geo-map-frame)">
            {landPaths.map((entry) => (
              <path
                key={entry.key}
                d={entry.d}
                className="pointer-events-none fill-zinc-800/80 stroke-zinc-400/80"
                strokeWidth={0.85}
              />
            ))}
            {subdivisionPaths.map((entry) => (
              <path
                key={entry.key}
                d={entry.d}
                className="pointer-events-none fill-none stroke-zinc-400/75"
                strokeWidth={0.55}
              />
            ))}
            {markers
              .filter((entry) => entry.offset >= MARKER_LEADER_THRESHOLD)
              .map((entry) => (
                <line
                  key={`${entry.city.id}-leader`}
                  x1={entry.originX}
                  y1={entry.originY}
                  x2={entry.x}
                  y2={entry.y}
                  className="pointer-events-none stroke-zinc-500/80"
                  strokeWidth={1}
                />
              ))}
            {markers.map((entry) => (
              <MapCityMarker
                key={entry.city.id}
                city={entry.city}
                x={entry.x}
                y={entry.y}
                selected={entry.city.id === selectedId}
                hitRadius={HIT_RADIUS}
                onSelect={props.onSelectCity}
              />
            ))}
          </g>
        </svg>
      </div>
      <MapLegend
        showOccupied={props.cities.some((city) => city.status === "occupied")}
      />
    </div>
  );
}

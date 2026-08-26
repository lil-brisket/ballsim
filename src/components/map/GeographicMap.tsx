"use client";

import { geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
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
  projectPoint,
  REGION_MAP_CONFIG,
} from "@/components/map/region-projection-config";
import {
  LEAGUE_AREA_LABELS,
  type LeagueArea,
} from "@/domain/game-settings";

const HIT_RADIUS = 22;
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const ZOOM_STEP = 1.25;

type ViewTransform = {
  scale: number;
  x: number;
  y: number;
};

const IDENTITY: ViewTransform = { scale: 1, x: 0, y: 0 };

export function GeographicMap(props: {
  area: LeagueArea;
  cities: readonly MapCity[];
  onSelectCity: (id: string) => void;
  centerOnCityId?: string | null;
  ariaLabel?: string;
}) {
  const viewport = REGION_MAP_CONFIG[props.area].viewport;
  const [view, setView] = useState<ViewTransform>(IDENTITY);

  const projection = useMemo(
    () => createRegionProjection(props.area, viewport.width, viewport.height),
    [props.area, viewport.height, viewport.width],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const features = useMemo(
    () => getRegionGeoFeatures(props.area),
    [props.area],
  );

  const projected = useMemo(() => {
    const rank = (status: MapCity["status"]) =>
      status === "selected" ? 2 : status === "available" ? 1 : 0;
    const points = props.cities.flatMap((city) => {
      const point = projectPoint(projection, city.latitude, city.longitude);
      if (!point) {
        return [];
      }
      return [{ city, ...point }];
    });
    const laidOut = layoutMapMarkers(
      points.map((entry) => ({
        id: entry.city.id,
        x: entry.x,
        y: entry.y,
        status: entry.city.status,
      })),
    );
    const byId = new Map(points.map((entry) => [entry.city.id, entry.city]));
    return laidOut
      .map((entry) => ({
        ...entry,
        city: byId.get(entry.id)!,
      }))
      .sort((a, b) => rank(a.city.status) - rank(b.city.status));
  }, [projection, props.cities]);

  useEffect(() => {
    setView(IDENTITY);
  }, [props.area]);

  useEffect(() => {
    if (!props.centerOnCityId) {
      return;
    }
    const target = projected.find((entry) => entry.city.id === props.centerOnCityId);
    if (!target) {
      return;
    }
    setView((current) => ({
      scale: current.scale,
      x: viewport.width / 2 - target.x * current.scale,
      y: viewport.height / 2 - target.y * current.scale,
    }));
  }, [projected, props.centerOnCityId, viewport.height, viewport.width]);

  const zoomAt = (nextScale: number) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    setView((current) => {
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      const worldX = (cx - current.x) / current.scale;
      const worldY = (cy - current.y) / current.scale;
      return {
        scale: clamped,
        x: cx - worldX * clamped,
        y: cy - worldY * clamped,
      };
    });
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        <svg
          viewBox={`0 0 ${viewport.width} ${viewport.height}`}
          className="h-auto w-full min-h-[280px]"
          role="img"
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
            <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            {features.map((entry, index) => (
              <path
                key={entry.properties?.name ?? index}
                d={path(entry) ?? ""}
                className="fill-zinc-800/70 stroke-zinc-600/50"
                strokeWidth={0.6}
              />
            ))}
            {projected
              .filter((entry) => entry.offset >= MARKER_LEADER_THRESHOLD)
              .map((entry) => (
                <line
                  key={`${entry.city.id}-leader`}
                  x1={entry.originX}
                  y1={entry.originY}
                  x2={entry.x}
                  y2={entry.y}
                  className="stroke-zinc-500/80"
                  strokeWidth={1}
                />
              ))}
            {projected.map((entry) => (
              <MapCityMarker
                key={entry.city.id}
                city={entry.city}
                x={entry.x}
                y={entry.y}
                hitRadius={HIT_RADIUS / view.scale}
                onSelect={props.onSelectCity}
              />
            ))}
            </g>
          </g>
        </svg>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MapLegend />
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            onClick={() => zoomAt(view.scale * ZOOM_STEP)}
          >
            Zoom in
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            onClick={() => zoomAt(view.scale / ZOOM_STEP)}
          >
            Zoom out
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            onClick={() => setView(IDENTITY)}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

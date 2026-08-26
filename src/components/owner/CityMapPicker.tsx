"use client";

import { useMemo, useState } from "react";
import { selectCityAction } from "@/application/actions";
import type { CityPickOption } from "@/state/selectors";
import {
  LEAGUE_AREA_LABELS,
  type LeagueArea,
} from "@/domain/game-settings";
import {
  projectCityToMap,
  REGION_MAP_CONFIG,
} from "@/components/owner/region-map-config";

export function CityMapPicker(props: {
  saveId: string;
  area: LeagueArea;
  cities: readonly CityPickOption[];
}) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const config = REGION_MAP_CONFIG[props.area];
  const selected = props.cities.find((city) => city.city === selectedCity) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return props.cities;
    }
    return props.cities.filter((city) => {
      const hay = `${city.city} ${city.nickname ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [props.cities, query]);

  const ctaLabel = selected
    ? selected.occupied
      ? `Control ${selected.nickname ?? selected.city}`
      : `Move franchise to ${selected.city}`
    : "Select a city";

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-amber-500">
        {LEAGUE_AREA_LABELS[props.area]}
      </p>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/80">
        <svg
          viewBox={config.viewBox}
          className="h-auto w-full"
          role="img"
          aria-label={`${LEAGUE_AREA_LABELS[props.area]} city map`}
        >
          <rect
            x={0}
            y={0}
            width={Number(config.viewBox.split(" ")[2])}
            height={Number(config.viewBox.split(" ")[3])}
            className="fill-zinc-900"
          />
          {config.silhouette ? (
            <path
              d={config.silhouette}
              className="fill-zinc-800/80 stroke-zinc-700"
              strokeWidth={1}
            />
          ) : null}
          {props.cities.map((city) => {
            const point = projectCityToMap(city.lat, city.lng, config);
            const isSelected = city.city === selectedCity;
            return (
              <g key={city.city}>
                <title>
                  {city.occupied
                    ? `${city.city} — ${city.nickname}`
                    : `${city.city} — Available`}
                </title>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 8 : 5}
                  className={
                    isSelected
                      ? "fill-amber-500 stroke-amber-200"
                      : city.occupied
                        ? "fill-amber-700/80 stroke-amber-500/60 cursor-pointer"
                        : "fill-zinc-500 stroke-zinc-300/40 cursor-pointer"
                  }
                  strokeWidth={isSelected ? 2 : 1}
                  onClick={() => setSelectedCity(city.city)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedCity(city.city);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
        {selected ? (
          <div className="space-y-1">
            <p className="text-lg font-medium text-zinc-100">{selected.city}</p>
            {selected.occupied ? (
              <p className="text-sm text-zinc-400">
                {selected.nickname} · Existing franchise
              </p>
            ) : (
              <p className="text-sm text-zinc-400">Available market</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            Select a city on the map or from the list below.
          </p>
        )}

        <form action={selectCityAction} className="mt-3">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="city" value={selected?.city ?? ""} />
          <button
            type="submit"
            disabled={!selected}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {ctaLabel}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <label className="block text-sm text-zinc-400">
          Search cities
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cities..."
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          />
        </label>

        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-zinc-800">
          {filtered.map((city) => {
            const isSelected = city.city === selectedCity;
            return (
              <li key={city.city}>
                <button
                  type="button"
                  onClick={() => setSelectedCity(city.city)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500 ${
                    isSelected
                      ? "bg-amber-600/20 text-zinc-100"
                      : "bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/80"
                  }`}
                >
                  <span className="font-medium">{city.city}</span>
                  <span className="text-xs text-zinc-500">
                    {city.occupied ? city.nickname : "Available"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";
import { selectCityAction } from "@/application/actions";
import { GeographicMap } from "@/components/map/GeographicMap";
import type { MapCity } from "@/components/map/map-city";
import {
  LEAGUE_AREA_LABELS,
  type LeagueArea,
} from "@/domain/game-settings";
import type { CityPickOption } from "@/state/selectors";

export function CityMapPicker(props: {
  saveId: string;
  area: LeagueArea;
  cities: readonly CityPickOption[];
}) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selected =
    props.cities.find((city) => city.city === selectedCity) ?? null;

  const mapCities: MapCity[] = useMemo(
    () =>
      props.cities.map((city) => ({
        id: city.city,
        latitude: city.lat,
        longitude: city.lng,
        label: city.city,
        locationLabel: city.locationLabel,
        status: "available",
        detail: city.nickname,
      })),
    [props.cities],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return props.cities;
    }
    return props.cities.filter((city) => {
      const hay =
        `${city.city} ${city.locationLabel} ${city.nickname ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [props.cities, query]);

  const selectCity = useCallback(
    (cityName: string) => {
      const next = props.cities.find((city) => city.city === cityName);
      if (!next) {
        return;
      }
      setSelectedCity(cityName);
    },
    [props.cities],
  );

  const ctaLabel = selected
    ? `Continue with ${selected.city}`
    : "Select a city";
  const submitDisabled = !selected;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <header className="flex shrink-0 items-baseline gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
          {LEAGUE_AREA_LABELS[props.area]}
        </p>
        <p className="text-sm text-zinc-400">
          {props.cities.length} cities
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1 lg:items-stretch">
        <GeographicMap
          area={props.area}
          cities={mapCities}
          onSelectCity={selectCity}
          selectedCityId={selectedCity}
          fill
        />

        <aside className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4 lg:h-full">
          <div className="space-y-2">
            <label className="block text-sm text-zinc-400" htmlFor="city-search">
              Search cities
            </label>
            <input
              id="city-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cities..."
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            />
          </div>

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-zinc-800">
            {filtered.map((city) => {
              const isSelected = city.city === selectedCity;
              return (
                <li key={city.city}>
                  <button
                    type="button"
                    onClick={() => selectCity(city.city)}
                    className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500 ${
                      isSelected
                        ? "bg-amber-600/20 text-zinc-100"
                        : "bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/80"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{city.city}</span>
                      <span className="block text-xs text-zinc-500">
                        {city.locationLabel}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <div className="shrink-0 space-y-3 border-t border-zinc-800 pt-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">
                  Selected market
                </p>
                <p className="text-lg font-medium text-zinc-100">{selected.city}</p>
                <p className="text-sm text-zinc-400">{selected.locationLabel}</p>
              </div>
              <form action={selectCityAction}>
                <input type="hidden" name="saveId" value={props.saveId} />
                <input type="hidden" name="city" value={selected.city} />
                <button
                  type="submit"
                  disabled={submitDisabled}
                  className="w-full rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {ctaLabel}
                </button>
              </form>
            </div>
          ) : (
            <p className="shrink-0 text-sm text-zinc-500">
              Select a city on the map or from the list to continue.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

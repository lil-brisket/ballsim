"use client";

import { Button } from "@/components/ui/Button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { selectCityAction } from "@/application/actions";
import { GeographicMap } from "@/components/map/GeographicMap";
import type { MapCity } from "@/components/map/map-city";
import { LEAGUE_AREA_LABELS, type LeagueArea } from "@/domain/game-settings";
import type { CityPickOption } from "@/state/selectors";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink";

function formatCoordinates(lat: number, lng: number): string {
  const latPart = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}`;
  const lngPart = `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? "E" : "W"}`;
  return `${latPart}, ${lngPart}`;
}

function SubmitButton(props: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={pending}
      className="w-full"
    >
      {pending ? "Founding franchise…" : props.label}
    </Button>
  );
}

export function CityMapPicker(props: {
  saveId: string;
  area: LeagueArea;
  cities: readonly CityPickOption[];
}) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const itemRefs = useRef(new Map<string, HTMLLIElement>());

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

  // Keep the list in sync when a city is picked on the map. Only items in the
  // filtered list have a registered node, so hidden cities are skipped.
  useEffect(() => {
    if (!selectedCity) {
      return;
    }
    const node = itemRefs.current.get(selectedCity);
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [selectedCity]);

  const trimmedQuery = query.trim();
  const countLabel =
    filtered.length === 0
      ? `No cities match “${trimmedQuery}”`
      : `${filtered.length} ${filtered.length === 1 ? "city" : "cities"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <header className="flex shrink-0 items-baseline gap-3">
        <p className="text-sm font-medium text-zinc-300">
          {LEAGUE_AREA_LABELS[props.area]}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1 lg:items-stretch">
        <GeographicMap
          area={props.area}
          cities={mapCities}
          onSelectCity={selectCity}
          selectedCityId={selectedCity}
          fill
        />

        <aside className="flex min-h-[24rem] flex-1 flex-col gap-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4 lg:h-full lg:min-h-0">
          <div className="space-y-2">
            <label
              className="block text-sm text-zinc-400"
              htmlFor="city-search"
            >
              Search cities
            </label>
            <input
              id="city-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cities..."
              className={`min-h-[44px] w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 ${FOCUS_RING}`}
            />
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-zinc-400"
            >
              {countLabel}
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-start justify-center gap-3 rounded-lg border border-zinc-800 px-3 py-4">
              <p className="text-sm text-zinc-400">
                No cities match your search.
              </p>
              <Button variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </div>
          ) : (
            <ul
              aria-label="Cities"
              className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-zinc-800"
            >
              {filtered.map((city) => {
                const isSelected = city.city === selectedCity;
                return (
                  <li
                    key={city.city}
                    ref={(node) => {
                      if (node) {
                        itemRefs.current.set(city.city, node);
                      } else {
                        itemRefs.current.delete(city.city);
                      }
                    }}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => selectCity(city.city)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-3 border-l-4 px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-team-ink ${
                        isSelected
                          ? "border-team-ink bg-team/20 text-zinc-100"
                          : "border-transparent bg-zinc-900/40 text-zinc-200 hover:bg-zinc-800/80"
                      }`}
                    >
                      <span>
                        <span className="block font-medium">{city.city}</span>
                        <span className="block text-sm text-zinc-500">
                          {city.locationLabel}
                        </span>
                      </span>
                      {isSelected ? (
                        <span className="shrink-0 text-sm font-semibold text-team-ink">
                          <span aria-hidden="true">✓ </span>Selected
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selected ? (
            <div className="sticky bottom-0 z-10 shrink-0 space-y-3 border-t border-zinc-800 bg-zinc-900/95 pt-3">
              <section aria-labelledby="selected-market-heading">
                <h2
                  id="selected-market-heading"
                  className="text-sm font-medium text-zinc-300"
                >
                  Selected market
                </h2>
                <p className="text-lg font-medium text-zinc-100">
                  {selected.city}
                </p>
                <p className="text-sm text-zinc-400">
                  {selected.locationLabel}
                </p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm text-zinc-400">
                  <dt className="text-zinc-500">League area</dt>
                  <dd>{LEAGUE_AREA_LABELS[props.area]}</dd>
                  <dt className="text-zinc-500">Coordinates</dt>
                  <dd>{formatCoordinates(selected.lat, selected.lng)}</dd>
                </dl>
                <p className="mt-2 text-sm text-zinc-400">
                  Your franchise relocates here. If another team already plays
                  in this city, it moves to your franchise&apos;s previous city.
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Market size and starting facilities are set by the league, not
                  by the city you choose.
                </p>
              </section>
              <form action={selectCityAction}>
                <input type="hidden" name="saveId" value={props.saveId} />
                <input type="hidden" name="city" value={selected.city} />
                <SubmitButton label={`Continue with ${selected.city}`} />
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

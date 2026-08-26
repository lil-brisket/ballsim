"use client";

import { useMemo, useState } from "react";
import { selectCityAction } from "@/application/actions";
import { GeographicMap } from "@/components/map/GeographicMap";
import type { MapCity } from "@/components/map/map-city";
import { TeamNicknameField } from "@/components/team/TeamNicknameField";
import { TEAM_NICKNAMES } from "@/data/league/team-nicknames";
import {
  LEAGUE_AREA_LABELS,
  type LeagueArea,
} from "@/domain/game-settings";
import {
  nextNicknameFromPool,
  validateTeamNickname,
} from "@/domain/team-nickname";
import type { CityPickOption } from "@/state/selectors";

export function CityMapPicker(props: {
  saveId: string;
  area: LeagueArea;
  cities: readonly CityPickOption[];
  placeholderNickname: string;
  placeholderTeamId?: string;
}) {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [nickname, setNickname] = useState(props.placeholderNickname);
  const [nicknameDirty, setNicknameDirty] = useState(false);
  const [query, setQuery] = useState("");

  const selected =
    props.cities.find((city) => city.city === selectedCity) ?? null;

  const existingTeams = useMemo(
    () =>
      props.cities
        .filter((city) => city.occupied && city.teamId && city.nickname)
        .map((city) => ({
          id: city.teamId!,
          city: city.city,
          name: city.nickname!,
        })),
    [props.cities],
  );

  const usedNicknames = useMemo(
    () => existingTeams.map((team) => team.name),
    [existingTeams],
  );

  const availableCount = props.cities.filter((city) => !city.occupied).length;
  const occupiedCount = props.cities.length - availableCount;

  const nicknameCheck =
    selected && !selected.occupied
      ? validateTeamNickname(nickname, {
          city: selected.city,
          existingTeams,
          excludeTeamId: props.placeholderTeamId,
        })
      : { ok: true as const, value: nickname };

  const mapCities: MapCity[] = useMemo(
    () =>
      props.cities.map((city) => ({
        id: city.city,
        latitude: city.lat,
        longitude: city.lng,
        label: city.city,
        locationLabel: city.locationLabel,
        status:
          city.city === selectedCity
            ? "selected"
            : city.occupied
              ? "occupied"
              : "available",
        detail: city.nickname,
      })),
    [props.cities, selectedCity],
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

  function selectCity(cityName: string) {
    const next = props.cities.find((city) => city.city === cityName);
    if (!next) {
      return;
    }
    setSelectedCity(cityName);
    if (next.occupied) {
      return;
    }
    if (!nicknameDirty) {
      setNickname(props.placeholderNickname);
    }
  }

  function onNicknameChange(value: string) {
    setNickname(value);
    setNicknameDirty(true);
  }

  function onRandomize() {
    const next = nextNicknameFromPool(nickname, TEAM_NICKNAMES, usedNicknames);
    if (next) {
      setNickname(next);
      setNicknameDirty(true);
    }
  }

  const previewName =
    selected && !selected.occupied
      ? `${selected.city} ${nicknameCheck.ok ? nicknameCheck.value : nickname}`
      : null;

  const ctaLabel = selected
    ? selected.occupied
      ? `Control ${selected.nickname ?? selected.city}`
      : `Select ${selected.city}`
    : "Select a city";

  const submitDisabled =
    !selected || (selected && !selected.occupied && !nicknameCheck.ok);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">
          {LEAGUE_AREA_LABELS[props.area]}
        </p>
        <p className="text-sm text-zinc-400">
          {availableCount} available · {occupiedCount} occupied
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <GeographicMap
          area={props.area}
          cities={mapCities}
          onSelectCity={selectCity}
          centerOnCityId={selectedCity}
        />

        <aside className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4 lg:sticky lg:top-6">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-medium text-zinc-100">{selected.city}</p>
                <p className="text-sm text-zinc-400">{selected.locationLabel}</p>
              </div>
              {selected.occupied ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Existing franchise
                  </p>
                  <p className="text-base text-zinc-100">
                    {selected.city} {selected.nickname}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-500/90">
                      Your franchise
                    </p>
                    <p className="text-base text-zinc-100">{previewName}</p>
                  </div>
                  <TeamNicknameField
                    id="franchise-nickname"
                    value={nickname}
                    onChange={onNicknameChange}
                    onRandomize={onRandomize}
                    error={nicknameCheck.ok ? null : nicknameCheck.error}
                    helperText="You can customize your team name."
                  />
                </div>
              )}
              <form action={selectCityAction}>
                <input type="hidden" name="saveId" value={props.saveId} />
                <input type="hidden" name="city" value={selected.city} />
                {!selected.occupied ? (
                  <input
                    type="hidden"
                    name="nickname"
                    value={nicknameCheck.ok ? nicknameCheck.value : nickname}
                  />
                ) : null}
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
            <p className="text-sm text-zinc-500">
              Select a city on the map or from the list below.
            </p>
          )}
        </aside>
      </div>

      <div className="space-y-3">
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

        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-zinc-800">
          {filtered.map((city) => {
            const isSelected = city.city === selectedCity;
            return (
              <li key={city.city}>
                <button
                  type="button"
                  onClick={() => selectCity(city.city)}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-amber-500 ${
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
                  <span className="shrink-0 text-xs text-zinc-500">
                    {city.occupied
                      ? `Occupied — ${city.nickname}`
                      : "Available"}
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

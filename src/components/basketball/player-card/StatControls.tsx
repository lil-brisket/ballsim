"use client";

import { Select } from "@/components/ui/Select";
import type { PlayerSeasonStatsView } from "@/state/player-profile-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";
import {
  SPLIT_LABELS,
  seasonOptionLabel,
  type StatMode,
  type StatScope,
  type StatSplit,
} from "./stat-view";

function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={props.label} className="flex flex-col gap-1">
      <span className="text-sm text-muted">{props.label}</span>
      <div className="flex overflow-hidden rounded-md border border-line-strong">
        {props.options.map((option) => {
          const pressed = option.value === props.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => props.onChange(option.value)}
              className={cn(
                "min-h-11 px-3 text-sm",
                pressed
                  ? "bg-team font-medium text-on-team"
                  : "text-soft hover:bg-surface-high",
                focusRingClass,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StatControls(props: {
  baseId: string;
  scope: StatScope;
  onScope: (scope: StatScope) => void;
  seasons: PlayerSeasonStatsView[];
  seasonId: string | null;
  onSeason: (seasonId: string) => void;
  splits: StatSplit[];
  split: StatSplit;
  onSplit: (split: StatSplit) => void;
  mode: StatMode;
  onMode: (mode: StatMode) => void;
}) {
  const newestFirst = [...props.seasons].reverse();
  const seasonSelectId = `${props.baseId}-season`;
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <Segmented
        label="Scope"
        value={props.scope}
        onChange={props.onScope}
        options={[
          { value: "season", label: "Season" },
          { value: "career", label: "Career" },
        ]}
      />
      {props.scope === "season" && newestFirst.length > 0 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={seasonSelectId} className="text-sm text-muted">
            Season
          </label>
          <Select
            id={seasonSelectId}
            value={props.seasonId ?? ""}
            onChange={(event) => props.onSeason(event.target.value)}
          >
            {newestFirst.map((season) => (
              <option key={season.seasonId} value={season.seasonId}>
                {seasonOptionLabel(season)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <Segmented
        label="Split"
        value={props.split}
        onChange={props.onSplit}
        options={props.splits.map((split) => ({
          value: split,
          label: SPLIT_LABELS[split],
        }))}
      />
      <Segmented
        label="View"
        value={props.mode}
        onChange={props.onMode}
        options={[
          { value: "perGame", label: "Per game" },
          { value: "totals", label: "Totals" },
        ]}
      />
    </div>
  );
}

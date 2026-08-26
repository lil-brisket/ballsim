"use client";

import { memo } from "react";
import type { MapCity } from "@/components/map/map-city";

export const MapCityMarker = memo(function MapCityMarker(props: {
  city: MapCity;
  x: number;
  y: number;
  selected: boolean;
  hitRadius: number;
  onSelect: (id: string) => void;
}) {
  const status = props.selected ? "selected" : props.city.status;
  const visualRadius =
    status === "selected" ? 7 : status === "occupied" ? 4 : 5;
  const fill = status === "occupied" ? "fill-zinc-500" : "fill-amber-500";
  const statusText =
    props.city.status === "occupied"
      ? `${props.city.detail ?? "Existing franchise"}`
      : "Available";
  const label = `${props.city.label}. ${props.city.locationLabel ?? ""}. ${
    status === "selected" ? "Selected. " : ""
  }${statusText}`.replace(/\s+/g, " ").trim();

  return (
    <g transform={`translate(${props.x} ${props.y})`} className="cursor-pointer">
      <title>{`${props.city.label} — ${props.city.locationLabel ?? ""} — ${
        props.city.status === "occupied"
          ? `${props.city.detail ?? ""} existing franchise`
          : "Available"
      }`}</title>
      <circle
        r={props.hitRadius}
        className="fill-transparent stroke-transparent outline-none focus-visible:stroke-amber-300"
        strokeWidth={2}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={status === "selected"}
        onClick={(event) => {
          event.stopPropagation();
          props.onSelect(props.city.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onSelect(props.city.id);
          }
        }}
      />
      {status === "selected" ? (
        <circle
          r={visualRadius + 5}
          className="pointer-events-none fill-none stroke-amber-300/80"
          strokeWidth={2}
        />
      ) : null}
      {status === "selected" ? (
        <circle
          r={visualRadius + 8}
          className="pointer-events-none fill-amber-500/20"
        />
      ) : null}
      <circle
        r={visualRadius}
        className={`pointer-events-none ${fill} ${
          status === "occupied" ? "stroke-zinc-400/50" : "stroke-amber-200/70"
        }`}
        strokeWidth={status === "selected" ? 1.5 : 1}
      />
    </g>
  );
});

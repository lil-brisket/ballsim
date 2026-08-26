"use client";

import type { MapCity } from "@/components/map/map-city";

export function MapCityMarker(props: {
  city: MapCity;
  x: number;
  y: number;
  hitRadius: number;
  onSelect: (id: string) => void;
}) {
  const visualRadius =
    props.city.status === "selected" ? 7 : props.city.status === "occupied" ? 4 : 5;
  const fill =
    props.city.status === "occupied"
      ? "fill-zinc-500"
      : "fill-amber-500";
  const statusText =
    props.city.status === "occupied"
      ? `${props.city.detail ?? "Existing franchise"}`
      : "Available";
  const label = `${props.city.label}. ${props.city.locationLabel ?? ""}. ${
    props.city.status === "selected" ? "Selected. " : ""
  }${statusText}`.replace(/\s+/g, " ").trim();

  return (
    <g transform={`translate(${props.x} ${props.y})`} className="cursor-pointer">
      <title>{`${props.city.label}\n${props.city.locationLabel ?? ""}\n${
        props.city.status === "occupied"
          ? `${props.city.detail ?? ""}\nExisting franchise`
          : "Available"
      }`}</title>
      <circle
        r={props.hitRadius}
        className="fill-transparent stroke-transparent outline-none focus-visible:stroke-amber-300"
        strokeWidth={2}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={props.city.status === "selected"}
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
      {props.city.status === "selected" ? (
        <circle
          r={visualRadius + 5}
          className="fill-none stroke-amber-300/80"
          strokeWidth={2}
        />
      ) : null}
      {props.city.status === "selected" ? (
        <circle r={visualRadius + 8} className="fill-amber-500/20" />
      ) : null}
      <circle
        r={visualRadius}
        className={`${fill} ${
          props.city.status === "occupied" ? "stroke-zinc-400/50" : "stroke-amber-200/70"
        }`}
        strokeWidth={props.city.status === "selected" ? 1.5 : 1}
      />
    </g>
  );
}

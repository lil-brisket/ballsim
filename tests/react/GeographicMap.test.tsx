import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GeographicMap } from "@/components/map/GeographicMap";
import type { MapCity } from "@/components/map/map-city";

const CITIES: MapCity[] = [
  {
    id: "Atlanta",
    latitude: 33.75,
    longitude: -84.39,
    label: "Atlanta",
    locationLabel: "Georgia, United States",
    status: "available",
  },
  {
    id: "Toronto",
    latitude: 43.65,
    longitude: -79.38,
    label: "Toronto",
    locationLabel: "Ontario, Canada",
    status: "occupied",
    detail: "Huskies",
  },
];

describe("GeographicMap", () => {
  it("renders a North America map with legend and city markers", () => {
    const { unmount } = render(
      <GeographicMap
        area="north_america"
        cities={CITIES}
        onSelectCity={() => {}}
        selectedCityId="Atlanta"
      />,
    );
    expect(screen.getByRole("img", { name: /North America city map/ })).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getByText("Occupied")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Atlanta/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Zoom out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Atlanta/ }));
    unmount();
  });

  it("fills a bounded parent instead of growing with aspect ratio", () => {
    const { container, unmount } = render(
      <div style={{ height: 240 }}>
        <GeographicMap
          area="north_america"
          cities={CITIES}
          onSelectCity={() => {}}
          fill
        />
      </div>,
    );
    const svg = container.querySelector("svg");
    expect(svg?.className.baseVal ?? svg?.getAttribute("class") ?? "").toContain(
      "h-full",
    );
    unmount();
  });
});

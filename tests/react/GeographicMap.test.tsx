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
  it("renders a North America map with legend, markers, and zoom controls", () => {
    const { unmount } = render(
      <GeographicMap
        area="north_america"
        cities={CITIES}
        onSelectCity={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: /North America city map/ })).toBeTruthy();
    expect(screen.getByText("Available")).toBeTruthy();
    expect(screen.getByText("Occupied")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Atlanta/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    unmount();
  });
});

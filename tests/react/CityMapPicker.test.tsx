import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  selectCityAction: vi.fn(),
}));

vi.mock("@/components/map/GeographicMap", () => ({
  GeographicMap: (props: {
    cities: readonly { id: string; label: string; status: string }[];
    onSelectCity: (id: string) => void;
  }) => (
    <div>
      {props.cities.map((city) => (
        <button
          key={city.id}
          type="button"
          onClick={() => props.onSelectCity(city.id)}
        >
          {city.label}
        </button>
      ))}
    </div>
  ),
}));

import { CityMapPicker } from "@/components/owner/CityMapPicker";
import type { CityPickOption } from "@/state/selectors";

const CITIES: CityPickOption[] = [
  {
    city: "Toronto",
    lat: 43.65,
    lng: -79.38,
    country: "Canada",
    subdivision: "Ontario",
    locationLabel: "Ontario, Canada",
    occupied: true,
    teamId: "team_tor",
    nickname: "Huskies",
  },
  {
    city: "Monterrey",
    lat: 25.67,
    lng: -100.31,
    country: "Mexico",
    subdivision: "Nuevo León",
    locationLabel: "Nuevo León, Mexico",
    occupied: false,
  },
];

describe("CityMapPicker", () => {
  it("treats every city as open for founding before confirmation", () => {
    const { unmount } = render(
      <CityMapPicker saveId="save_1" area="north_america" cities={CITIES} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toronto" }));
    expect(screen.getByText("Selected market")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Continue with Toronto" }),
    ).toBeTruthy();
    expect(screen.queryByText("Existing franchise")).toBeNull();
    unmount();
  });

  it("updates CTA for available cities", () => {
    const { unmount } = render(
      <CityMapPicker saveId="save_1" area="north_america" cities={CITIES} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Monterrey" }));
    expect(
      screen.getByRole("button", { name: "Continue with Monterrey" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Team name")).toBeNull();
    unmount();
  });

  it("submits city only without nickname field", () => {
    const { container, unmount } = render(
      <CityMapPicker saveId="save_1" area="north_america" cities={CITIES} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toronto" }));
    expect(container.querySelector('input[name="city"]')).toBeTruthy();
    expect(container.querySelector('input[name="nickname"]')).toBeNull();
    unmount();
  });
});

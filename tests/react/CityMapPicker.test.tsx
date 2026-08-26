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
  it("updates selection panel and CTA for occupied cities", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={CITIES}
        placeholderNickname="Knights"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Toronto" }));
    expect(screen.getByText("Existing franchise")).toBeTruthy();
    expect(screen.getByText("Toronto Huskies")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Control Huskies" }),
    ).toBeTruthy();
    unmount();
  });

  it("updates CTA and live preview for available cities", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={CITIES}
        placeholderNickname="Knights"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Monterrey" }));
    expect(screen.getByText("Your franchise")).toBeTruthy();
    expect(screen.getByText("Monterrey Knights")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select Monterrey" }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Suns" },
    });
    expect(screen.getByText("Monterrey Suns")).toBeTruthy();

    const hiddenCity = document.querySelector(
      'input[name="city"]',
    ) as HTMLInputElement | null;
    const hiddenNickname = document.querySelector(
      'input[name="nickname"]',
    ) as HTMLInputElement | null;
    expect(hiddenCity?.value).toBe("Monterrey");
    expect(hiddenNickname?.value).toBe("Suns");
    unmount();
  });

  it("preserves a dirty nickname when switching available cities", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={[
          ...CITIES,
          {
            city: "Austin",
            lat: 30.27,
            lng: -97.74,
            country: "United States",
            subdivision: "Texas",
            locationLabel: "Texas, United States",
            occupied: false,
          },
        ]}
        placeholderNickname="Knights"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Monterrey" }));
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Suns" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Austin" }));
    expect(screen.getByText("Austin Suns")).toBeTruthy();
    expect((screen.getByLabelText("Team name") as HTMLInputElement).value).toBe(
      "Suns",
    );
    unmount();
  });

  it("rejects an empty nickname inline", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={CITIES}
        placeholderNickname="Knights"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Monterrey" }));
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "   " },
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "Team name cannot be empty.",
    );
    expect(
      (screen.getByRole("button", { name: "Select Monterrey" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    unmount();
  });

  it("filters the search list and selects a city from it", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={[
          ...CITIES,
          {
            city: "Austin",
            lat: 30.27,
            lng: -97.74,
            country: "United States",
            subdivision: "Texas",
            locationLabel: "Texas, United States",
            occupied: false,
          },
        ]}
        placeholderNickname="Knights"
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search cities..."), {
      target: { value: "Austin" },
    });
    expect(screen.queryByText("Ontario, Canada")).toBeNull();
    fireEvent.click(screen.getByText("Texas, United States").closest("button")!);
    expect(screen.getByRole("button", { name: "Select Austin" })).toBeTruthy();
    unmount();
  });

  it("shows available and occupied counts", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={CITIES}
        placeholderNickname="Knights"
      />,
    );
    expect(screen.getByText("1 available · 1 occupied")).toBeTruthy();
    expect(screen.getByText("North America")).toBeTruthy();
    unmount();
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  selectCityAction: vi.fn(),
}));

import { CityMapPicker } from "@/components/owner/CityMapPicker";
import type { CityPickOption } from "@/state/selectors";

const CITIES: CityPickOption[] = [
  {
    city: "Toronto",
    lat: 43.65,
    lng: -79.38,
    occupied: true,
    teamId: "team_tor",
    nickname: "Huskies",
  },
  {
    city: "Monterrey",
    lat: 25.67,
    lng: -100.31,
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
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Toronto/i }));
    expect(screen.getByText("Huskies · Existing franchise")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Control Huskies" }),
    ).toBeTruthy();
    unmount();
  });

  it("updates CTA for available cities", () => {
    const { unmount } = render(
      <CityMapPicker
        saveId="save_1"
        area="north_america"
        cities={CITIES}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Monterrey/i }));
    expect(screen.getByText("Available market")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Move franchise to Monterrey" }),
    ).toBeTruthy();

    const hiddenCity = document.querySelector(
      'input[name="city"]',
    ) as HTMLInputElement | null;
    expect(hiddenCity?.value).toBe("Monterrey");
    unmount();
  });
});

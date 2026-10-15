import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  selectCityAction: vi.fn(),
}));

vi.mock("@/components/map/GeographicMap", () => ({
  GeographicMap: (props: {
    cities: readonly { id: string; label: string; status: string }[];
    onSelectCity: (id: string) => void;
    selectedCityId?: string | null;
  }) => (
    <div>
      {props.cities.map((city) => (
        <button
          key={city.id}
          type="button"
          aria-pressed={props.selectedCityId === city.id}
          onClick={() => props.onSelectCity(city.id)}
        >
          {city.label}
        </button>
      ))}
    </div>
  ),
}));

import { LEAGUE_AREA_LABELS } from "@/domain/game-settings";
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

  it("keeps the city list in a bounded scrolling region and pins Continue", () => {
    const { container, unmount } = render(
      <CityMapPicker saveId="save_1" area="north_america" cities={CITIES} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toronto" }));
    const list = container.querySelector("ul");
    expect(list?.className).toContain("overflow-y-auto");
    const continueButton = screen.getByRole("button", {
      name: "Continue with Toronto",
    });
    expect(continueButton.closest("div")?.className).toContain("sticky");
    unmount();
  });

  function renderPicker() {
    return render(
      <CityMapPicker saveId="save_1" area="north_america" cities={CITIES} />,
    );
  }

  it("keeps map and list selection in sync both ways", () => {
    const { unmount } = renderPicker();
    const list = screen.getByRole("list", { name: "Cities" });
    const listToronto = within(list).getByRole("button", {
      name: /^Toronto/,
    });
    const mapToronto = screen.getByRole("button", { name: "Toronto" });
    expect(listToronto.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(mapToronto);
    expect(listToronto.getAttribute("aria-pressed")).toBe("true");
    expect(within(list).getByText("Selected")).toBeTruthy();

    fireEvent.click(within(list).getByRole("button", { name: /^Monterrey/ }));
    expect(
      screen
        .getByRole("button", { name: "Monterrey" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(mapToronto.getAttribute("aria-pressed")).toBe("false");
    unmount();
  });

  it("filters the list and offers Clear search when nothing matches", () => {
    const { unmount } = renderPicker();
    const search = screen.getByLabelText("Search cities");
    const list = () => screen.getByRole("list", { name: "Cities" });

    expect(screen.getByRole("status").textContent).toBe("2 cities");
    fireEvent.change(search, { target: { value: "mont" } });
    expect(within(list()).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("1 city");

    fireEvent.change(search, { target: { value: "xyz" } });
    expect(screen.queryByRole("list", { name: "Cities" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "No cities match “xyz”",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(within(list()).getAllByRole("button")).toHaveLength(2);
    expect((search as HTMLInputElement).value).toBe("");
    unmount();
  });

  it("shows location details and the relocation note without market numbers", () => {
    const { unmount } = renderPicker();
    expect(
      screen.getByText(
        "Select a city on the map or from the list to continue.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Toronto" }));
    const panel = screen
      .getByRole("heading", { name: "Selected market" })
      .closest("section")!;
    expect(within(panel).getByText("Toronto")).toBeTruthy();
    expect(within(panel).getByText("Ontario, Canada")).toBeTruthy();
    expect(
      within(panel).getByText(LEAGUE_AREA_LABELS.north_america),
    ).toBeTruthy();
    expect(within(panel).getByText("43.65° N, 79.38° W")).toBeTruthy();
    expect(
      within(panel).getByText(/Your franchise relocates here/),
    ).toBeTruthy();
    expect(
      within(panel).getByText(/Market size and starting facilities are set by/),
    ).toBeTruthy();
    expect(panel.textContent).not.toMatch(/\$|revenue/i);
    unmount();
  });

  it("submits hidden saveId and city", () => {
    const { container, unmount } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Monterrey" }));
    const form = container.querySelector("form")!;
    const data = new FormData(form);
    expect(data.get("saveId")).toBe("save_1");
    expect(data.get("city")).toBe("Monterrey");
    unmount();
  });
});

import { describe, expect, it } from "vitest";
import { applyOwnerCitySelection } from "@/systems/owner-city-selection";
import { uniqueTeamAbbreviation } from "@/systems/team-abbreviation";
import {
  CBL_GAME_SETTINGS,
  cloneGameSettings,
} from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { listCitiesForTeamPick } from "@/state/selectors";
import { TEST_RNG_SEED } from "../helpers/determinism";

function createNaState() {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  return createInitialGameState({
    saveId: "city_sel_test",
    rngSeed: TEST_RNG_SEED,
    settings,
  });
}

describe("applyOwnerCitySelection", () => {
  it("keeps teamCount unchanged for occupied and available paths", () => {
    const state = createNaState();
    const teamCount = Object.keys(state.world.teams).length;
    expect(teamCount).toBe(settingsTeamCount(state));

    const cities = listCitiesForTeamPick(state);
    expect(cities.every((city) => city.occupied === false)).toBe(true);
    const occupiedCity = otherTeamCity(state).city;
    const available = cities.find((c) => c.city !== occupiedCity) ?? cities[0]!;

    const afterOccupied = applyOwnerCitySelection(state, occupiedCity);
    expect(afterOccupied.ok).toBe(true);
    if (afterOccupied.ok) {
      expect(Object.keys(afterOccupied.state.world.teams).length).toBe(teamCount);
    }

    const afterAvailable = applyOwnerCitySelection(state, available.city);
    expect(afterAvailable.ok).toBe(true);
    if (afterAvailable.ok) {
      expect(Object.keys(afterAvailable.state.world.teams).length).toBe(teamCount);
    }
  });

  it("relocates the placeholder into a city that already has a team", () => {
    const state = createNaState();
    const target = otherTeamCity(state);
    const placeholderId = state.user.controlledTeamId;
    const placeholderCity = state.world.teams[placeholderId]!.city;
    const targetBefore = { ...state.world.teams[target.teamId]! };

    const result = applyOwnerCitySelection(state, target.city);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.user.controlledTeamId).toBe(placeholderId);
    expect(result.state.user.citySelectionConfirmed).toBe(true);
    expect(result.state.world.teams[placeholderId]!.city).toBe(target.city);
    expect(result.state.world.teams[target.teamId]!.city).toBe(placeholderCity);
    expect(result.state.world.teams[target.teamId]!.name).toBe(targetBefore.name);
  });

  it("available city relocates only the placeholder franchise", () => {
    const state = createNaState();
    const cities = listCitiesForTeamPick(state);
    const available = openCity(state);
    const placeholderId = state.user.controlledTeamId;
    const otherIds = Object.keys(state.world.teams).filter(
      (id) => id !== placeholderId,
    );
    const othersBefore = Object.fromEntries(
      otherIds.map((id) => [id, { ...state.world.teams[id]! }]),
    );

    const used = new Set(
      otherIds.map((id) => state.world.teams[id]!.abbreviation),
    );
    const expectedAbbr = uniqueTeamAbbreviation(available.city, used);

    const result = applyOwnerCitySelection(state, available.city);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.state.user.controlledTeamId).toBe(placeholderId);
    expect(result.state.user.citySelectionConfirmed).toBe(true);
    expect(result.state.world.teams[placeholderId]!.city).toBe(available.city);
    expect(result.state.world.teams[placeholderId]!.abbreviation).toBe(
      expectedAbbr,
    );
    for (const id of otherIds) {
      expect(result.state.world.teams[id]).toEqual(othersBefore[id]);
    }
    expect(Object.keys(result.state.world.teams).length).toBe(
      Object.keys(state.world.teams).length,
    );

    const cityNames = Object.values(result.state.world.teams).map((t) => t.city);
    expect(new Set(cityNames).size).toBe(cityNames.length);
  });

  it("rejects cities outside the saved area pool", () => {
    const state = createNaState();
    const result = applyOwnerCitySelection(state, "Tokyo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not in the north_america/);
    }
  });

  it("rejects after citySelectionConfirmed", () => {
    const state = createNaState();
    const cities = listCitiesForTeamPick(state);
    const first = applyOwnerCitySelection(state, cities[0]!.city);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const second = applyOwnerCitySelection(first.state, cities[1]!.city);
    expect(second.ok).toBe(false);
  });

  it("rejects unknown city strings", () => {
    const state = createNaState();
    const result = applyOwnerCitySelection(state, "Atlantis");
    expect(result.ok).toBe(false);
  });

  it("rejects after first time advance", () => {
    const state = createNaState();
    const locked = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          lastSimulatedDate: state.world.calendar.currentDate,
        },
      },
    };
    const cities = listCitiesForTeamPick(locked);
    const result = applyOwnerCitySelection(locked, cities[0]!.city);
    expect(result.ok).toBe(false);
  });

  it("preserves generated nickname when selecting a city", () => {
    const state = createNaState();
    const available = openCity(state);
    const placeholderId = state.user.controlledTeamId;
    const beforeName = state.world.teams[placeholderId]!.name;
    const beforeBranding = state.world.teams[placeholderId]!.branding;
    const result = applyOwnerCitySelection(state, available.city);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.world.teams[placeholderId]!.city).toBe(available.city);
    expect(result.state.world.teams[placeholderId]!.name).toBe(beforeName);
    expect(result.state.world.teams[placeholderId]!.branding).toEqual(
      beforeBranding,
    );
    expect(result.state.user.franchiseIdentityConfirmed).toBe(false);
  });

  it("preserves branding when taking a city that already has a team", () => {
    const state = createNaState();
    const target = otherTeamCity(state);
    const placeholderId = state.user.controlledTeamId;
    const beforeName = state.world.teams[placeholderId]!.name;
    const beforeBranding = state.world.teams[placeholderId]!.branding;
    const result = applyOwnerCitySelection(state, target.city);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.world.teams[placeholderId]!.city).toBe(target.city);
    expect(result.state.world.teams[placeholderId]!.name).toBe(beforeName);
    expect(result.state.world.teams[placeholderId]!.branding).toEqual(
      beforeBranding,
    );
  });
});

function otherTeamCity(state: ReturnType<typeof createNaState>): {
  teamId: string;
  city: string;
} {
  const placeholderId = state.user.controlledTeamId;
  const other = Object.values(state.world.teams).find(
    (team) => team.id !== placeholderId,
  )!;
  return { teamId: other.id, city: other.city };
}

function openCity(state: ReturnType<typeof createNaState>) {
  const taken = new Set(
    Object.values(state.world.teams).map((team) => team.city),
  );
  return listCitiesForTeamPick(state).find((city) => !taken.has(city.city))!;
}

function settingsTeamCount(state: ReturnType<typeof createNaState>): number {
  return state.settings.league.teamCount;
}

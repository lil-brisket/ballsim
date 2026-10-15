import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  confirmControlledFranchises,
  createNewOwnerSave,
  loadOwnerSaveView,
  selectOwnerCity,
} from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { TEAM_LOGO_CATALOG } from "@/data/team-branding/logo-catalog";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { TEST_RNG_SEED } from "../helpers/determinism";

type Dashboard = NonNullable<
  Awaited<ReturnType<typeof loadOwnerSaveView>>
>["dashboard"];

function routeFor(saveId: string, dashboard: Dashboard) {
  return resolveOnboardingRoute(saveId, {
    citySelectionConfirmed: dashboard.citySelectionConfirmed,
    franchiseIdentityConfirmed: dashboard.franchiseIdentityConfirmed,
    fantasyDraftMode: dashboard.fantasyDraftMode,
    fantasyDraftStatus: dashboard.fantasyDraftStatus,
  });
}

async function runOnboarding(mode: "standard" | "fantasy") {
  const store = createMemorySaveGameStore();
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  settings.draft.mode = mode;

  const created = await createNewOwnerSave(
    { settings, name: `Onboarding ${mode}`, rngSeed: TEST_RNG_SEED },
    store,
  );
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error("create failed");
  }
  const saveId = created.save.id;
  expect(routeFor(saveId, created.dashboard).kind).toBe("city");

  // Recovery: reloading mid-onboarding lands on the same step.
  const reloaded = await loadOwnerSaveView(saveId, store);
  expect(reloaded).not.toBeNull();
  expect(routeFor(saveId, reloaded!.dashboard)).toEqual({
    kind: "city",
    path: `/new/${saveId}/team`,
  });

  const city = reloaded!.cities[0]!;
  const selected = await selectOwnerCity(saveId, city.city, store);
  expect(selected.ok).toBe(true);
  if (!selected.ok) {
    throw new Error("city failed");
  }
  expect(routeFor(saveId, selected.dashboard).kind).toBe("franchises");

  const again = await selectOwnerCity(saveId, city.city, store);
  expect(again.ok).toBe(false);
  if (!again.ok) {
    expect(again.error).toMatch(/already confirmed/i);
  }

  const team = selected.dashboard.controlledTeam;
  const confirmed = await confirmControlledFranchises(
    saveId,
    [
      {
        teamId: team.id,
        nickname: "Falcons",
        primaryColor: "#112233",
        secondaryColor: "#ffffff",
        accentColor: "#f59e0b",
        logoId: TEAM_LOGO_CATALOG[0]!.id,
      },
    ],
    store,
  );
  expect(confirmed.ok).toBe(true);
  if (!confirmed.ok) {
    throw new Error(confirmed.error);
  }
  return { saveId, dashboard: confirmed.dashboard, team };
}

describe("onboarding flow", () => {
  it("walks city -> franchises -> dashboard for a standard league", async () => {
    const { saveId, dashboard, team } = await runOnboarding("standard");
    expect(dashboard.controlledTeam.name).toBe("Falcons");
    expect(dashboard.controlledTeam.id).toBe(team.id);
    expect(routeFor(saveId, dashboard)).toEqual({
      kind: "dashboard",
      path: `/dashboard/${saveId}`,
    });
  });

  it("routes a fantasy-draft league to fantasy setup after confirmation", async () => {
    const { saveId, dashboard } = await runOnboarding("fantasy");
    expect(routeFor(saveId, dashboard).kind).toBe("fantasy_setup");
  });
});

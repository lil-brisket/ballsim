import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveOwnedFranchise } from "@/state/owner-context";

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
  advanceOwnerTime,
  advanceLeaguePhaseCommand,
  beginOffseason,
  createNewOwnerSave,
  executeOwnerTrade,
  finishFreeAgency,
  loadOwnerSave,
  loadOwnerSaveView,
  selectOwnerCity,
  confirmOwnerTeamIdentity,
  selectOwnerDraftProspect,
  selectOwnerTeam,
  signOwnerFreeAgent,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import { getTeamCitiesForArea } from "@/data/league/team-cities-by-area";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { isUserOnDraftClock } from "@/systems/draft";
import { listFreeAgents } from "@/systems/free-agency";
import { getActivePhaseId } from "@/systems/phase-engine";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

async function ensureRegularSeason(
  saveId: string,
  store: ReturnType<typeof createMemorySaveGameStore>,
): Promise<void> {
  const current = await store.load(saveId);
  if (!current) {
    throw new Error("Save missing");
  }
  if (getActivePhaseId(current.state) === "preseason.preparation") {
    const advanced = await advanceLeaguePhaseCommand(saveId, store);
    if (!advanced.ok) {
      throw new Error(advanced.error);
    }
  }
}

async function advanceUntilSeasonPhase(
  saveId: string,
  store: ReturnType<typeof createMemorySaveGameStore>,
  targetPhase: string,
  maxAttempts = 40,
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await loadOwnerSave(saveId, store);
    expect(current).not.toBeNull();
    if (current!.dashboard.seasonPhase === targetPhase) {
      return;
    }
    if (current!.dashboard.seasonPhase === "postseason") {
      const began = await beginOffseason(saveId, store);
      if (!began.ok) {
        throw new Error(began.error);
      }
      continue;
    }
    if (current!.dashboard.seasonPhase === "preseason") {
      await ensureRegularSeason(saveId, store);
      continue;
    }
    const snap = await store.load(saveId);
    if (snap && isUserOnDraftClock(snap.state)) {
      const board = (await loadOwnerSaveView(saveId, store))!.draftBoard;
      const prospect = board?.eligibleProspects[0];
      if (!prospect) {
        throw new Error("On draft clock with no prospects");
      }
      const drafted = await selectOwnerDraftProspect(
        saveId,
        prospect.playerId,
        store,
      );
      if (!drafted.ok) {
        throw new Error(drafted.error);
      }
      continue;
    }
    const phaseId = snap ? getActivePhaseId(snap.state) : null;
    if (
      phaseId === "offseason.roster_decisions" ||
      phaseId === "offseason.draft_preparation" ||
      phaseId === "offseason.draft" ||
      phaseId === "offseason.free_agency" ||
      phaseId === "offseason.staff_development"
    ) {
      const advanced = await advanceLeaguePhaseCommand(saveId, store);
      if (!advanced.ok) {
        throw new Error(advanced.error);
      }
      continue;
    }
    const result = await advanceOwnerTime(
      saveId,
      { days: 400, stopOnPhaseChange: true },
      store,
    );
    if (!result.ok) {
      throw new Error(result.error);
    }
  }
  const final = await loadOwnerSave(saveId, store);
  throw new Error(
    `Did not reach phase ${targetPhase}; stuck at ${final?.dashboard.seasonPhase}/${final?.dashboard.offseasonStage}`,
  );
}

describe("Owner Mode vertical slice", () => {
  let store: ReturnType<typeof createMemorySaveGameStore>;

  beforeEach(() => {
    store = createMemorySaveGameStore();
  });

  it(
    "new game + team selection survive save/load smoke test",
    async () => {
      const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Smoke Franchise", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      expect(created.dashboard.teamCount).toBe(12);
      expect(created.dashboard.playerCount).toBeGreaterThan(0);
      expect(created.dashboard.teamSelectionLocked).toBe(false);

      const teamIds = Object.keys(
        (await store.load(created.save.id))!.state.world.teams,
      ).sort();
      const pickId = teamIds[1]!;
      const selected = await selectOwnerTeam(created.save.id, pickId, store);
      expect(selected.ok).toBe(true);
      if (!selected.ok) {
        return;
      }
      expect(selected.dashboard.controlledTeam.id).toBe(pickId);

      const loaded = await loadOwnerSave(created.save.id, store);
      expect(loaded).not.toBeNull();
      expect(loaded!.dashboard.controlledTeam.id).toBe(pickId);
      expect(loaded!.dashboard.teamSelectionLocked).toBe(false);

      const again = await selectOwnerTeam(created.save.id, pickId, store);
      expect(again.ok).toBe(true);

      const lockedAttempt = await advanceOwnerTime(
        created.save.id,
        { days: 1 },
        store,
      );
      expect(lockedAttempt.ok).toBe(true);

      const afterAdvance = await selectOwnerTeam(
        created.save.id,
        teamIds[2]!,
        store,
      );
      expect(afterAdvance.ok).toBe(false);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "city pick: unused city relocates placeholder and preserves teamCount",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "north_america";
      const created = await createNewOwnerSave(
        { settings, name: "City Unused", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const view = await loadOwnerSaveView(created.save.id, store);
      expect(view).not.toBeNull();
      const pool = getTeamCitiesForArea("north_america");
      expect(view!.cities.length).toBe(pool.length);
      expect(view!.cities.every((c) => pool.includes(c.city))).toBe(true);

      expect(view!.cities.every((c) => c.occupied === false)).toBe(true);

      const available = view!.cities[0];
      expect(available).toBeDefined();
      const before = await store.load(created.save.id);
      const teamCount = Object.keys(before!.state.world.teams).length;
      const placeholderId = before!.state.user.activeOwnerTeamId;

      const selected = await selectOwnerCity(
        created.save.id,
        available!.city,
        store,
      );
      expect(selected.ok).toBe(true);
      if (!selected.ok) {
        return;
      }

      const after = await store.load(created.save.id);
      expect(Object.keys(after!.state.world.teams).length).toBe(teamCount);
      expect(after!.state.user.activeOwnerTeamId).toBe(placeholderId);
      expect(after!.state.world.teams[placeholderId]!.city).toBe(
        available!.city,
      );
      expect(getActiveOwnedFranchise(after!.state).citySelectionConfirmed).toBe(true);
      expect(selected.dashboard.controlledTeam.city).toBe(available!.city);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "city pick then team identity confirm customizes nickname and branding",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "north_america";
      const created = await createNewOwnerSave(
        { settings, name: "City Nickname", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      const view = await loadOwnerSaveView(created.save.id, store);
      const available = view!.cities[0]!;
      const selected = await selectOwnerCity(
        created.save.id,
        available.city,
        store,
      );
      expect(selected.ok).toBe(true);
      if (!selected.ok) {
        return;
      }
      expect(selected.dashboard.controlledTeam.city).toBe(available.city);
      expect(selected.dashboard.franchiseIdentityConfirmed).toBe(false);

      const confirmed = await confirmOwnerTeamIdentity(
        created.save.id,
        {
          nickname: "Falcons",
          paletteId: "crimson_gold",
          logoId: "eagle",
        },
        store,
      );
      expect(confirmed.ok).toBe(true);
      if (!confirmed.ok) {
        return;
      }
      expect(confirmed.dashboard.controlledTeam.name).toBe("Falcons");
      expect(confirmed.dashboard.controlledTeam.branding.logoId).toBe("eagle");
      expect(confirmed.dashboard.franchiseIdentityConfirmed).toBe(true);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "custom hex branding survives save reload without palette reconstruction",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "north_america";
      const created = await createNewOwnerSave(
        { settings, name: "Custom Hex", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      const view = await loadOwnerSaveView(created.save.id, store);
      const available = view!.cities[0]!;
      const selected = await selectOwnerCity(
        created.save.id,
        available.city,
        store,
      );
      expect(selected.ok).toBe(true);
      if (!selected.ok) {
        return;
      }

      const confirmed = await confirmOwnerTeamIdentity(
        created.save.id,
        {
          nickname: "Comets",
          logoId: "star",
          primaryColor: "#123456",
          secondaryColor: "#F5F5F5",
          accentColor: "#FFB000",
        },
        store,
      );
      expect(confirmed.ok).toBe(true);
      if (!confirmed.ok) {
        return;
      }

      const reloaded = await store.load(created.save.id);
      expect(reloaded).toBeTruthy();
      const team =
        reloaded!.state.world.teams[reloaded!.state.user.activeOwnerTeamId]!;
      expect(team.city).toBe(available.city);
      expect(team.name).toBe("Comets");
      expect(team.branding).toEqual({
        primaryColor: "#123456",
        secondaryColor: "#F5F5F5",
        accentColor: "#FFB000",
        logoId: "star",
      });
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "city pick: taking a generated-team city relocates the placeholder and swaps the occupant",
    async () => {
      const settings = cloneGameSettings(CBL_GAME_SETTINGS);
      settings.league.area = "north_america";
      const created = await createNewOwnerSave(
        { settings, name: "City Occupied", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }

      const view = await loadOwnerSaveView(created.save.id, store);
      expect(view!.cities.every((c) => c.occupied === false)).toBe(true);

      const before = await store.load(created.save.id);
      const placeholderId = before!.state.user.activeOwnerTeamId;
      const placeholderCity = before!.state.world.teams[placeholderId]!.city;
      const occupant = Object.values(before!.state.world.teams).find(
        (team) => team.id !== placeholderId,
      )!;
      const occupantName = occupant.name;

      const selected = await selectOwnerCity(
        created.save.id,
        occupant.city,
        store,
      );
      expect(selected.ok).toBe(true);
      if (!selected.ok) {
        return;
      }

      const confirmed = await confirmOwnerTeamIdentity(
        created.save.id,
        {
          nickname: "Intruders",
          paletteId: "scarlet_black",
          logoId: "wolf",
        },
        store,
      );
      expect(confirmed.ok).toBe(true);
      if (!confirmed.ok) {
        return;
      }

      const after = await store.load(created.save.id);
      expect(after!.state.user.activeOwnerTeamId).toBe(placeholderId);
      expect(after!.state.world.teams[placeholderId]!.city).toBe(occupant.city);
      expect(after!.state.world.teams[placeholderId]!.name).toBe("Intruders");
      expect(after!.state.world.teams[occupant.id]!.city).toBe(placeholderCity);
      expect(after!.state.world.teams[occupant.id]!.name).toBe(occupantName);
      expect(getActiveOwnedFranchise(after!.state).citySelectionConfirmed).toBe(true);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "rejects invalid free agency and draft actions in preseason",
    async () => {
      const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Guard Franchise", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      const fa = await signOwnerFreeAgent(
        created.save.id,
        { playerId: "player_missing" },
        store,
      );
      expect(fa.ok).toBe(false);

      const draft = await selectOwnerDraftProspect(
        created.save.id,
        "prospect_missing",
        store,
      );
      expect(draft.ok).toBe(false);

      const finish = await finishFreeAgency(created.save.id, store);
      expect(finish.ok).toBe(false);
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "final acceptance: Season 1 through Season 2 with save/load",
    async () => {
      const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: "Vertical Slice", rngSeed: TEST_RNG_SEED },
        store,
      );
      expect(created.ok).toBe(true);
      if (!created.ok) {
        return;
      }
      const saveId = created.save.id;
      const loaded0 = await store.load(saveId);
      expect(loaded0).not.toBeNull();
      const teamIds = Object.keys(loaded0!.state.world.teams).sort();
      const controlledTeamId = teamIds[0]!;

      const selected = await selectOwnerTeam(saveId, controlledTeamId, store);
      expect(selected.ok).toBe(true);

      const view = await loadOwnerSaveView(saveId, store);
      expect(view).not.toBeNull();
      expect(view!.roster.length).toBeGreaterThan(0);

      const outgoing = view!.roster[0]!;
      const traded = await executeOwnerTrade(
        saveId,
        { outgoingPlayerId: outgoing.playerId },
        store,
      );
      expect(traded.ok).toBe(true);
      if (!traded.ok) {
        throw new Error(traded.error);
      }

      const midSeasonSave = await store.load(saveId);
      expect(midSeasonSave).not.toBeNull();
      expect(() => validateGameState(midSeasonSave!.state)).not.toThrow();
      const midRoundTrip = deserializeGameState(
        serializeGameState(midSeasonSave!.state),
      );
      expect(midRoundTrip.user.activeOwnerTeamId).toBe(controlledTeamId);

      // Advance through preseason → regular
      await ensureRegularSeason(saveId, store);
      let phaseResult = await advanceOwnerTime(
        saveId,
        { days: 10, stopOnPhaseChange: true },
        store,
      );
      expect(phaseResult.ok).toBe(true);
      if (!phaseResult.ok) {
        throw new Error(phaseResult.error);
      }
      expect(phaseResult.dashboard.seasonPhase).toBe("regular");

      // Complete regular season → playoffs (may stop at calendar segments first)
      await advanceUntilSeasonPhase(saveId, store, "playoffs");
      const phaseAtPlayoffs = await loadOwnerSave(saveId, store);
      expect(phaseAtPlayoffs!.dashboard.seasonPhase).toBe("playoffs");

      const atPlayoffs = await store.load(saveId);
      expect(atPlayoffs).not.toBeNull();
      expect(() => validateGameState(atPlayoffs!.state)).not.toThrow();
      const userQualified = atPlayoffs!.state.competition.playoffs.qualifiedTeams.some(
        (entry) => entry.teamId === controlledTeamId,
      );

      // Finish playoffs → Season Review (postseason checkpoint)
      await advanceUntilSeasonPhase(saveId, store, "postseason");

      // Begin offseason (player-paced): transition → roster → draft prep → draft
      const began = await beginOffseason(saveId, store);
      expect(began.ok).toBe(true);
      if (!began.ok) {
        throw new Error(began.error);
      }

      let guard = 0;
      while (guard < 20) {
        const current = await store.load(saveId);
        expect(current).not.toBeNull();
        const phaseId = getActivePhaseId(current!.state);
        if (phaseId === "offseason.draft") {
          break;
        }
        if (phaseId === "postseason.season_review") {
          const again = await beginOffseason(saveId, store);
          if (!again.ok) {
            throw new Error(again.error);
          }
          guard += 1;
          continue;
        }
        const advanced = await advanceLeaguePhaseCommand(saveId, store);
        if (!advanced.ok) {
          throw new Error(
            `to draft guard=${guard} phase=${phaseId}: ${advanced.error}`,
          );
        }
        guard += 1;
      }

      // Draft: pick whenever on the clock until draft completes / we leave draft
      guard = 0;
      while (guard < 40) {
        const snap = await store.load(saveId);
        expect(snap).not.toBeNull();
        const phaseId = getActivePhaseId(snap!.state);

        if (phaseId !== "offseason.draft") {
          break;
        }

        if (isUserOnDraftClock(snap!.state)) {
          const board = (await loadOwnerSaveView(saveId, store))!.draftBoard;
          expect(board).not.toBeNull();
          const prospect = board!.eligibleProspects[0];
          expect(prospect).toBeDefined();
          const drafted = await selectOwnerDraftProspect(
            saveId,
            prospect!.playerId,
            store,
          );
          expect(drafted.ok).toBe(true);
          if (!drafted.ok) {
            throw new Error(drafted.error);
          }
        } else {
          const advanced = await advanceOwnerTime(
            saveId,
            { days: 5, stopOnPhaseChange: true },
            store,
          );
          if (!advanced.ok) {
            expect(advanced.error).toMatch(/draft clock/i);
          }
        }
        guard += 1;
      }

      // Advance draft → free agency
      guard = 0;
      while (guard < 10) {
        const snap = await store.load(saveId);
        expect(snap).not.toBeNull();
        if (getActivePhaseId(snap!.state) === "offseason.free_agency") {
          break;
        }
        const advanced = await advanceLeaguePhaseCommand(saveId, store);
        if (!advanced.ok) {
          throw new Error(advanced.error);
        }
        guard += 1;
      }

      const atFa = await store.load(saveId);
      expect(atFa).not.toBeNull();
      expect(getActivePhaseId(atFa!.state)).toBe("offseason.free_agency");
      const faPool = listFreeAgents(atFa!.state);
      expect(faPool.playerIds.length).toBeGreaterThan(0);

      const signTarget = faPool.playerIds[0]!;
      const signed = await signOwnerFreeAgent(
        saveId,
        { playerId: signTarget, salary: 1_500_000, years: 1 },
        store,
      );
      expect(signed.ok).toBe(true);
      if (!signed.ok) {
        throw new Error(signed.error);
      }

      const finishedFa = await finishFreeAgency(saveId, store);
      expect(finishedFa.ok).toBe(true);
      if (!finishedFa.ok) {
        throw new Error(finishedFa.error);
      }

      // Advance staff → preseason (season 2)
      guard = 0;
      while (guard < 30) {
        const snap = await store.load(saveId);
        expect(snap).not.toBeNull();
        if (snap!.state.competition.season.year === 2027) {
          break;
        }
        if (isUserOnDraftClock(snap!.state)) {
          const board = (await loadOwnerSaveView(saveId, store))!.draftBoard;
          const prospect = board!.eligibleProspects[0]!;
          const drafted = await selectOwnerDraftProspect(
            saveId,
            prospect.playerId,
            store,
          );
          expect(drafted.ok).toBe(true);
        } else {
          const phaseId = getActivePhaseId(snap!.state);
          if (
            phaseId === "offseason.staff_development" ||
            phaseId === "offseason.free_agency" ||
            phaseId === "preseason.preparation"
          ) {
            const advanced = await advanceLeaguePhaseCommand(saveId, store);
            if (!advanced.ok) {
              throw new Error(advanced.error);
            }
          } else {
            const advanced = await advanceOwnerTime(
              saveId,
              { days: 20, stopOnPhaseChange: true },
              store,
            );
            if (!advanced.ok && /draft clock/i.test(advanced.error)) {
              continue;
            }
            expect(advanced.ok).toBe(true);
          }
        }
        guard += 1;
      }

      const season2 = await store.load(saveId);
      expect(season2).not.toBeNull();
      expect(season2!.state.competition.season.year).toBe(2027);
      expect(season2!.state.user.activeOwnerTeamId).toBe(controlledTeamId);
      expect(() => validateGameState(season2!.state)).not.toThrow();

      const json = serializeGameState(season2!.state);
      const restored = deserializeGameState(json);
      expect(restored.competition.season.year).toBe(2027);
      expect(restored.user.activeOwnerTeamId).toBe(controlledTeamId);
      expect(Object.keys(restored.world.players).length).toBe(
        Object.keys(season2!.state.world.players).length,
      );

      // Document qualify outcome for this controlled team (either is valid).
      expect(typeof userQualified).toBe("boolean");
    },
    LONG_TIMEOUT_MS,
  );

  it(
    "proves both playoff qualification and miss without forcing ownership",
    async () => {
      const outcomes = { qualify: false, miss: false };

      for (const teamIndex of [0, 1, 2, 3, 8, 9, 10, 11]) {
        if (outcomes.qualify && outcomes.miss) {
          break;
        }
        const created = await createNewOwnerSave({ settings: CBL_GAME_SETTINGS, name: `PlayoffOutcome ${teamIndex}`,
            rngSeed: TEST_RNG_SEED + teamIndex,
          },
          store,
        );
        expect(created.ok).toBe(true);
        if (!created.ok) {
          return;
        }
        const loaded = await store.load(created.save.id);
        const teamIds = Object.keys(loaded!.state.world.teams).sort();
        const teamId = teamIds[teamIndex % teamIds.length]!;
        const selected = await selectOwnerTeam(
          created.save.id,
          teamId,
          store,
        );
        expect(selected.ok).toBe(true);

        await ensureRegularSeason(created.save.id, store);
        let result = await advanceOwnerTime(
          created.save.id,
          { days: 10, stopOnPhaseChange: true },
          store,
        );
        expect(result.ok).toBe(true);

        await advanceUntilSeasonPhase(created.save.id, store, "playoffs");
        result = await loadOwnerSave(created.save.id, store) as NonNullable<
          Awaited<ReturnType<typeof loadOwnerSave>>
        >;
        expect(result.dashboard.seasonPhase).toBe("playoffs");

        const atPlayoffs = await store.load(created.save.id);
        const qualified =
          atPlayoffs!.state.competition.playoffs.qualifiedTeams.some(
            (entry) => entry.teamId === teamId,
          );
        if (qualified) {
          outcomes.qualify = true;
        } else {
          outcomes.miss = true;
        }
      }

      expect(outcomes.qualify).toBe(true);
      expect(outcomes.miss).toBe(true);
    },
    LONG_TIMEOUT_MS,
  );
});


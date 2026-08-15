import { beforeEach, describe, expect, it, vi } from "vitest";

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
  createNewOwnerSave,
  executeOwnerTrade,
  finishFreeAgency,
  loadOwnerSave,
  loadOwnerSaveView,
  selectOwnerDraftProspect,
  selectOwnerTeam,
  signOwnerFreeAgent,
} from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { isUserOnDraftClock } from "@/systems/draft";
import { listFreeAgents } from "@/systems/free-agency";
import { TEST_RNG_SEED } from "../helpers/determinism";

const LONG_TIMEOUT_MS = 600_000;

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
      expect(midRoundTrip.user.controlledTeamId).toBe(controlledTeamId);

      // Advance through preseason → regular
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

      // Complete regular season → playoffs
      phaseResult = await advanceOwnerTime(
        saveId,
        { days: 400, stopOnPhaseChange: true },
        store,
      );
      expect(phaseResult.ok).toBe(true);
      if (!phaseResult.ok) {
        throw new Error(phaseResult.error);
      }
      expect(phaseResult.dashboard.seasonPhase).toBe("playoffs");

      const atPlayoffs = await store.load(saveId);
      expect(atPlayoffs).not.toBeNull();
      expect(() => validateGameState(atPlayoffs!.state)).not.toThrow();
      const userQualified = atPlayoffs!.state.competition.playoffs.qualifiedTeams.some(
        (entry) => entry.teamId === controlledTeamId,
      );

      // Finish playoffs → postseason (may chain toward offseason)
      phaseResult = await advanceOwnerTime(
        saveId,
        { days: 400, stopOnPhaseChange: true },
        store,
      );
      if (!phaseResult.ok) {
        throw new Error(`after playoffs advance: ${phaseResult.error}`);
      }

      // Continue until free_agency
      let guard = 0;
      while (guard < 20) {
        const current = await loadOwnerSave(saveId, store);
        expect(current).not.toBeNull();
        if (
          current!.dashboard.seasonPhase === "offseason" &&
          current!.dashboard.offseasonStage === "free_agency"
        ) {
          break;
        }
        phaseResult = await advanceOwnerTime(
          saveId,
          { days: 50, stopOnPhaseChange: true },
          store,
        );
        if (!phaseResult.ok) {
          throw new Error(
            `to free_agency guard=${guard} phase=${current!.dashboard.seasonPhase}/${current!.dashboard.offseasonStage}: ${phaseResult.error}`,
          );
        }
        guard += 1;
      }

      const atFa = await store.load(saveId);
      expect(atFa).not.toBeNull();
      expect(atFa!.state.competition.season.phase).toBe("offseason");
      expect(atFa!.state.competition.season.offseasonStage).toBe(
        "free_agency",
      );
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

      // Draft: pick whenever on the clock until draft/season advances
      guard = 0;
      while (guard < 40) {
        const snap = await store.load(saveId);
        expect(snap).not.toBeNull();
        const stage = snap!.state.competition.season.offseasonStage;
        const phase = snap!.state.competition.season.phase;

        if (phase === "preseason" || phase === "regular") {
          break;
        }

        if (stage === "draft" && isUserOnDraftClock(snap!.state)) {
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
        } else if (stage === "draft") {
          const advanced = await advanceOwnerTime(
            saveId,
            { days: 5, stopOnPhaseChange: true },
            store,
          );
          if (!advanced.ok) {
            // On the clock mid-loop
            expect(advanced.error).toMatch(/draft clock/i);
            break;
          }
        } else {
          const advanced = await advanceOwnerTime(
            saveId,
            { days: 10, stopOnPhaseChange: true },
            store,
          );
          expect(advanced.ok).toBe(true);
        }
        guard += 1;
      }

      // Ensure we reached Season 2
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
        guard += 1;
      }

      const season2 = await store.load(saveId);
      expect(season2).not.toBeNull();
      expect(season2!.state.competition.season.year).toBe(2027);
      expect(season2!.state.user.controlledTeamId).toBe(controlledTeamId);
      expect(() => validateGameState(season2!.state)).not.toThrow();

      const json = serializeGameState(season2!.state);
      const restored = deserializeGameState(json);
      expect(restored.competition.season.year).toBe(2027);
      expect(restored.user.controlledTeamId).toBe(controlledTeamId);
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

        let result = await advanceOwnerTime(
          created.save.id,
          { days: 10, stopOnPhaseChange: true },
          store,
        );
        expect(result.ok).toBe(true);

        result = await advanceOwnerTime(
          created.save.id,
          { days: 400, stopOnPhaseChange: true },
          store,
        );
        expect(result.ok).toBe(true);
        if (!result.ok) {
          continue;
        }
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


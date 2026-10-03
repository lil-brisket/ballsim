import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { cloneGameSettings, CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { applyRosterPackage } from "@/systems/custom-content/apply-roster";
import { validateGameState } from "@/persistence/validate-game-state";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { canonicalCustomPlayerId } from "@/systems/custom-content/normalize";
import { makeFullRosterPackage } from "../../helpers/custom-content";
import { bootstrapWorld } from "@/systems/world-pipeline";

describe("custom roster import", () => {
  it("applies a valid package into a complete GameState", () => {
    const state = createInitialGameState({
      saveId: "custom_roster_import",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const pkg = makeFullRosterPackage({
      teamCount: Object.keys(state.world.teams).length,
    });
    const rng = createSeededRng(state.meta.rngState);
    const applied = applyRosterPackage(state, pkg, rng);
    expect(() => validateGameState(applied.state)).not.toThrow();
    expect(Object.keys(applied.state.world.players).length).toBe(
      Object.keys(applied.state.world.teams).length * DEFAULT_ROSTER_SIZE,
    );
    const firstTeam = Object.values(applied.state.world.teams)[0]!;
    expect(firstTeam.roster).toHaveLength(DEFAULT_ROSTER_SIZE);
    expect(applied.state.world.players[firstTeam.roster[0]!]?.teamId).toBe(
      firstTeam.id,
    );
  });

  it("assigns canonical player IDs from contentId and sourceId", () => {
    const state = createInitialGameState({
      saveId: "custom_roster_ids",
      rngSeed: 8,
      settings: CBL_GAME_SETTINGS,
    });
    const pkg = makeFullRosterPackage({
      teamCount: Object.keys(state.world.teams).length,
      contentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    const rng = createSeededRng(state.meta.rngState);
    const applied = applyRosterPackage(state, pkg, rng);
    const expected = canonicalCustomPlayerId(pkg.contentId, "t0_p0");
    expect(applied.state.world.players[expected]).toBeDefined();
  });

  it("bootstraps custom, standard, and fantasy modes exclusively", () => {
    const customSettings = cloneGameSettings(CBL_GAME_SETTINGS);
    customSettings.draft.mode = "custom";
    const customState = createInitialGameState({
      saveId: "custom_boot_custom",
      rngSeed: 18,
      settings: customSettings,
    });
    const customPkg = makeFullRosterPackage({
      teamCount: Object.keys(customState.world.teams).length,
    });
    const customBoot = bootstrapWorld(
      customState,
      createSeededRng(customState.meta.rngState),
      customPkg,
    ).state;
    expect(Object.keys(customBoot.world.players).every((id) => id.startsWith("custom_"))).toBe(
      true,
    );
    expect(
      Object.values(customBoot.world.players).some((player) =>
        player.id.includes("_fill_"),
      ),
    ).toBe(false);

    const standardState = createInitialGameState({
      saveId: "custom_boot_standard",
      rngSeed: 19,
      settings: CBL_GAME_SETTINGS,
    });
    const standardBoot = bootstrapWorld(
      standardState,
      createSeededRng(standardState.meta.rngState),
    ).state;
    expect(
      Object.keys(standardBoot.world.players).some((id) => id.startsWith("custom_")),
    ).toBe(false);
    expect(
      Object.values(standardBoot.world.teams).every(
        (team) => team.roster.length === DEFAULT_ROSTER_SIZE,
      ),
    ).toBe(true);

    const fantasySettings = cloneGameSettings(CBL_GAME_SETTINGS);
    fantasySettings.draft.mode = "fantasy";
    const fantasyState = createInitialGameState({
      saveId: "custom_boot_fantasy",
      rngSeed: 20,
      settings: fantasySettings,
    });
    const fantasyBoot = bootstrapWorld(
      fantasyState,
      createSeededRng(fantasyState.meta.rngState),
    ).state;
    expect(
      Object.values(fantasyBoot.world.teams).every((team) => team.roster.length === 0),
    ).toBe(true);
    expect(
      Object.values(fantasyBoot.world.players).every((player) => player.teamId === null),
    ).toBe(true);
  });
});

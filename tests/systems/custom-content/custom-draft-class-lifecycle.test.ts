import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { asPlayerId, asTeamId } from "@/domain/ids";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  activateDraft,
  createDraftFromPackage,
  makeDraftSelection,
  replaceDraftProspects,
} from "@/systems/draft";
import { canonicalCustomPlayerId } from "@/systems/custom-content/normalize";
import { makeDraftClassPackage, makePlayerSource } from "../../helpers/custom-content";
import { processOffseasonLifecycle, processPhaseEnter } from "@/systems/simulation/offseason-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { setActivePhase } from "@/systems/phase-engine";
import { draftClassIdFor } from "@/domain/entities/draft";
import { draftYearForSeason } from "@/systems/draft";

function prospectPackage() {
  return makeDraftClassPackage({
    draftYear: 2027,
    prospects: [
      makePlayerSource({
        sourceId: "star",
        firstName: "Imported",
        lastName: "Prospect",
        age: 21,
        position: "PG",
        archetype: "floor_general",
        heightInches: 74,
        weightPounds: 190,
        attributes: {
          ...makePlayerSource({ sourceId: "star" }).attributes,
          finishing: 88,
        },
      }),
    ],
  });
}

describe("custom draft class lifecycle", () => {
  it("keeps the imported snapshot through makeDraftSelection", () => {
    let state = createInitialGameState({
      saveId: "custom_dc_life",
      rngSeed: 12,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const pkg = prospectPackage();
    state = createDraftFromPackage(state, rng, pkg).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    state = activateDraft(state, draftClassId).state;
    const playerId = asPlayerId(canonicalCustomPlayerId(pkg.contentId, "star"));
    const snapshot = structuredClone(
      state.world.drafts[draftClassId]!.prospects[playerId]!.player,
    );
    const slot = state.world.drafts[draftClassId]!.order.find(
      (entry) => entry.status === "available",
    )!;
    const selected = makeDraftSelection(state, {
      draftClassId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: playerId,
      teamId: asTeamId(slot.ownerTeamId),
    });
    expect(selected.success).toBe(true);
    const player = selected.state.world.players[playerId]!;
    expect(player.id).toBe(snapshot.id);
    expect(player.firstName).toBe(snapshot.firstName);
    expect(player.lastName).toBe(snapshot.lastName);
    expect(player.attributes).toEqual(snapshot.attributes);
    expect(player.potential).toEqual(snapshot.potential);
    expect(player.heightInches).toBe(snapshot.heightInches);
    expect(player.weightPounds).toBe(snapshot.weightPounds);
    expect(player.teamId).toBe(slot.ownerTeamId);
  });

  it("rejects replacement once the draft is active", () => {
    let state = createInitialGameState({
      saveId: "custom_dc_replace",
      rngSeed: 13,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const pkg = prospectPackage();
    state = createDraftFromPackage(state, rng, pkg).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    state = activateDraft(state, draftClassIdFor(draftYear)).state;
    expect(() => replaceDraftProspects(state, rng, pkg)).toThrow(
      /Cannot replace draft class/,
    );
  });

  it("does not auto-create a draft class while the decision is unresolved", () => {
    let state = createInitialGameState({
      saveId: "custom_dc_gate",
      rngSeed: 14,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = transitionPhase(state, "regular").state;
    state = transitionPhase(state, "postseason").state;
    state = transitionPhase(state, "offseason").state;
    state = setActivePhase(state, "offseason.draft_preparation");
    state = processPhaseEnter(state, "offseason.draft_preparation", rng).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    expect(state.user.pendingDraftClassDecisions[String(draftYear)]?.resolved).toBe(
      false,
    );
    expect(state.world.drafts[draftClassId]).toBeUndefined();
    state = processOffseasonLifecycle(state, rng).state;
    expect(state.world.drafts[draftClassId]).toBeUndefined();
    state = setActivePhase(state, "offseason.draft");
    state = processPhaseEnter(state, "offseason.draft", rng).state;
    expect(state.world.drafts[draftClassId]).toBeUndefined();
  });
});

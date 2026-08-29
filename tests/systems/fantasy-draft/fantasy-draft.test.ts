import { describe, expect, it } from "vitest";
import { cloneGameSettings, CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { type TeamId } from "@/domain/ids";
import { asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { createInitialGameState } from "@/state/create-initial-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  advanceFantasyDraftClock,
  computeFantasyPoolSize,
  computeFantasyTotalPicks,
  confirmFantasyDraftOrder,
  FANTASY_DRAFT_PICKS_PER_TEAM,
  generateFantasyPlayerPool,
  getAvailableDraftPlayers,
  getCurrentPick,
  getPickOwnerForNumber,
  makeFantasyDraftSelection,
  moveTeamInOrder,
  pauseFantasyDraft,
  randomizeDraftOrder,
  resumeFantasyDraft,
  setDefaultDraftOrder,
  setFantasyDraftAutoPickAll,
  undoLastFantasyDraftPick,
} from "@/systems/fantasy-draft";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { listFreeAgents } from "@/systems/free-agency";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../../helpers/determinism";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

function fantasySettings(teamCount = 8) {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.teamCount = teamCount;
  settings.playoffs.playoffTeams = Math.min(8, teamCount);
  settings.draft.mode = "fantasy";
  settings.draft.type = "snake";
  settings.draft.orderMode = "random";
  settings.draft.timerSeconds = null;
  return settings;
}

function createFantasyState(teamCount = 8) {
  resetDomainEventSequenceForTests();
  let state = createInitialGameState({
    saveId: "save_fantasy",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
    settings: fantasySettings(teamCount),
  });
  const rng = createSeededRng(state.meta.rngState);
  const boot = bootstrapWorld(state, rng);
  state = {
    ...boot.state,
    meta: { ...boot.state.meta, rngState: rng.getState() },
  };
  return state;
}

function startDraft(state: ReturnType<typeof createFantasyState>) {
  const rng = createSeededRng(state.meta.rngState);
  let next = randomizeDraftOrder(state, rng);
  next = confirmFantasyDraftOrder(next, TEST_NOW_ISO);
  return { state: next, rng };
}

describe("fantasy draft pool", () => {
  it("generates an oversupplied balanced pool with empty rosters", () => {
    const state = createFantasyState(8);
    const teamCount = Object.keys(state.world.teams).length;
    const totalPicks = computeFantasyTotalPicks(teamCount);
    const poolSize = computeFantasyPoolSize(teamCount);

    expect(state.world.fantasyDraft).not.toBeNull();
    expect(Object.keys(state.world.players).length).toBe(poolSize);
    expect(poolSize).toBeGreaterThan(totalPicks);
    expect(state.world.fantasyDraft!.totalPicks).toBe(totalPicks);
    expect(state.world.fantasyDraft!.picksPerTeam).toBe(
      FANTASY_DRAFT_PICKS_PER_TEAM,
    );

    for (const team of Object.values(state.world.teams)) {
      expect(team.roster).toEqual([]);
    }
    for (const player of Object.values(state.world.players)) {
      expect(player.teamId).toBeNull();
      expect(player.contractId).toBeNull();
    }
  });

  it("is idempotent when players already exist", () => {
    const state = createFantasyState(8);
    const rng = createSeededRng(99);
    const again = generateFantasyPlayerPool(state, rng);
    expect(Object.keys(again.state.world.players).length).toBe(
      Object.keys(state.world.players).length,
    );
  });
});

describe("fantasy draft order", () => {
  it("computes snake order correctly", () => {
    const order = [
      asTeamId("t1"),
      asTeamId("t2"),
      asTeamId("t3"),
      asTeamId("t4"),
      asTeamId("t5"),
    ];
    expect(getPickOwnerForNumber(order, "snake", 1).teamId).toBe("t1");
    expect(getPickOwnerForNumber(order, "snake", 5).teamId).toBe("t5");
    expect(getPickOwnerForNumber(order, "snake", 6).teamId).toBe("t5");
    expect(getPickOwnerForNumber(order, "snake", 10).teamId).toBe("t1");
    expect(getPickOwnerForNumber(order, "snake", 11).teamId).toBe("t1");
  });

  it("computes linear order correctly", () => {
    const order = [asTeamId("t1"), asTeamId("t2"), asTeamId("t3")];
    expect(getPickOwnerForNumber(order, "linear", 1).teamId).toBe("t1");
    expect(getPickOwnerForNumber(order, "linear", 4).teamId).toBe("t1");
    expect(getPickOwnerForNumber(order, "linear", 6).teamId).toBe("t3");
  });

  it("allows edit after randomize until confirm locks", () => {
    let state = createFantasyState(8);
    const rng = createSeededRng(state.meta.rngState);
    state = randomizeDraftOrder(state, rng);
    const first = [...state.world.fantasyDraft!.draftOrder];
    const teamId = first[0]!;
    state = moveTeamInOrder(state, teamId, 1);
    expect(state.world.fantasyDraft!.draftOrder[1]).toBe(teamId);
    expect(state.world.fantasyDraft!.orderConfirmed).toBe(false);

    state = confirmFantasyDraftOrder(state, TEST_NOW_ISO);
    expect(state.world.fantasyDraft!.orderConfirmed).toBe(true);
    expect(state.world.fantasyDraft!.status).toBe("active");
    expect(() => moveTeamInOrder(state, teamId, 1)).toThrow(/locked/i);
  });
});

describe("fantasy draft selection", () => {
  it("prevents duplicate players and wrong team picks", () => {
    let { state } = startDraft(createFantasyState(8));
    const pick = getCurrentPick(state)!;
    const available = getAvailableDraftPlayers(state);
    const playerId = available[0]!.id;

    const wrong = makeFantasyDraftSelection(state, {
      teamId: asTeamId("not_on_clock"),
      playerId,
      nowIso: TEST_NOW_ISO,
    });
    expect(wrong.success).toBe(false);

    const ok = makeFantasyDraftSelection(state, {
      teamId: pick.teamId,
      playerId,
      nowIso: TEST_NOW_ISO,
    });
    expect(ok.success).toBe(true);
    state = ok.state;

    const dup = makeFantasyDraftSelection(state, {
      teamId: getCurrentPick(state)!.teamId,
      playerId,
      nowIso: TEST_NOW_ISO,
    });
    expect(dup.success).toBe(false);
  });

  it("undo reverses roster, contract, and pick number", () => {
    let { state } = startDraft(createFantasyState(8));
    const pick = getCurrentPick(state)!;
    const playerId = getAvailableDraftPlayers(state)[0]!.id;
    state = makeFantasyDraftSelection(state, {
      teamId: pick.teamId,
      playerId,
      nowIso: TEST_NOW_ISO,
    }).state;

    expect(state.world.players[playerId]!.teamId).toBe(pick.teamId);
    expect(state.world.fantasyDraft!.selections).toHaveLength(1);

    const undone = undoLastFantasyDraftPick(state, TEST_NOW_ISO);
    expect(undone.success).toBe(true);
    state = undone.state;
    expect(state.world.players[playerId]!.teamId).toBeNull();
    expect(state.world.players[playerId]!.contractId).toBeNull();
    expect(state.world.fantasyDraft!.selections).toHaveLength(0);
    expect(state.world.fantasyDraft!.currentPickNumber).toBe(1);
  });
});

describe("fantasy draft pause and timer", () => {
  it("pauses and resumes without allowing picks while paused", () => {
    let { state } = startDraft(createFantasyState(8));
    state = pauseFantasyDraft(state, TEST_NOW_ISO);
    expect(state.world.fantasyDraft!.status).toBe("paused");

    const pick = getCurrentPick(state)!;
    const playerId = getAvailableDraftPlayers(state)[0]!.id;
    const blocked = makeFantasyDraftSelection(state, {
      teamId: pick.teamId,
      playerId,
      nowIso: TEST_NOW_ISO,
    });
    expect(blocked.success).toBe(false);

    state = resumeFantasyDraft(state, TEST_NOW_ISO);
    expect(state.world.fantasyDraft!.status).toBe("active");
  });
});

describe("fantasy draft auto-pick and completion", () => {
  it(
    "CPU advance completes a small league and leaves free agents",
    () => {
      let { state } = startDraft(createFantasyState(8));
      state = setFantasyDraftAutoPickAll(state, true);

      const advanced = advanceFantasyDraftClock(state, TEST_NOW_ISO);
      state = advanced.state;

      expect(state.world.fantasyDraft!.status).toBe("complete");
      expect(state.world.fantasyDraft!.currentPickNumber).toBeNull();
      expect(state.world.fantasyDraft!.selections).toHaveLength(
        state.world.fantasyDraft!.totalPicks,
      );

      for (const team of Object.values(state.world.teams)) {
        expect(team.roster).toHaveLength(FANTASY_DRAFT_PICKS_PER_TEAM);
      }

      const fas = listFreeAgents(state);
      expect(fas.playerIds.length).toBeGreaterThan(0);
    },
    60_000,
  );

  it("survives serialize/deserialize mid-draft", () => {
    let { state } = startDraft(createFantasyState(8));
    const pick = getCurrentPick(state)!;
    const playerId = getAvailableDraftPlayers(state)[0]!.id;
    state = makeFantasyDraftSelection(state, {
      teamId: pick.teamId,
      playerId,
      nowIso: TEST_NOW_ISO,
    }).state;

    const json = serializeGameState(state);
    const restored = deserializeGameState(json);
    expect(restored.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(restored.world.fantasyDraft!.selections).toHaveLength(1);
    expect(restored.world.fantasyDraft!.draftOrder).toEqual(
      state.world.fantasyDraft!.draftOrder,
    );
    expect(restored.world.fantasyDraft!.currentPickNumber).toBe(2);
  });
});

describe("fantasy draft 12-team stress (reduced 30-team)", () => {
  it(
    "completes full snake draft for 12 teams with auto-picks",
    () => {
      let state = createFantasyState(12);
      const teamIds = Object.keys(state.world.teams) as TeamId[];
      state = {
        ...state,
        user: {
          ...state.user,
          ownedTeamIds: [teamIds[0]!, teamIds[1]!],
          activeOwnerTeamId: teamIds[0]!,
          ownedFranchises: {
            [teamIds[0]!]:
              state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
            [teamIds[1]!]: {
              ...state.user.ownedFranchises[state.user.activeOwnerTeamId]!,
            },
          },
        },
      };

      state = setDefaultDraftOrder(state);
      state = confirmFantasyDraftOrder(state, TEST_NOW_ISO);
      state = setFantasyDraftAutoPickAll(state, true);

      const advanced = advanceFantasyDraftClock(state, TEST_NOW_ISO);
      state = advanced.state;

      expect(state.world.fantasyDraft!.status).toBe("complete");
      expect(state.world.fantasyDraft!.selections).toHaveLength(
        12 * FANTASY_DRAFT_PICKS_PER_TEAM,
      );

      const seen = new Set<string>();
      for (const team of Object.values(state.world.teams)) {
        expect(team.roster).toHaveLength(FANTASY_DRAFT_PICKS_PER_TEAM);
        for (const id of team.roster) {
          expect(seen.has(String(id))).toBe(false);
          seen.add(String(id));
        }
      }
      expect(listFreeAgents(state).playerIds.length).toBeGreaterThan(0);
    },
    120_000,
  );
});

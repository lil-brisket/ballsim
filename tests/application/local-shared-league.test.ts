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
  advanceOwnerTime,
  confirmControlledFranchises,
  createNewOwnerSave,
  loadOwnerSaveView,
  readyAllParticipants,
  selectOwnerCity,
  setActiveParticipantReady,
  switchActiveOwnerTeam,
  switchParticipant,
} from "@/application/game-service";
import { TEAM_LOGO_CATALOG } from "@/data/team-branding/logo-catalog";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import type { LocalSharedParticipation } from "@/domain/participation";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { SaveGameStore } from "@/persistence/save-game-store";
import type { GameState } from "@/state/game-state";
import { TEST_RNG_SEED } from "../helpers/determinism";

const NICKNAMES = ["Falcons", "Comets", "Pilots"];

function local(state: GameState): LocalSharedParticipation {
  if (state.user.participation.mode !== "local_shared") {
    throw new Error("expected a local shared league");
  }
  return state.user.participation;
}

async function createAndPickCity(
  store: SaveGameStore,
  participation: unknown,
  controlledTeamCount = 1,
) {
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  settings.ownership = { controlledTeamCount };
  const created = await createNewOwnerSave(
    { settings, name: "Hotseat", rngSeed: TEST_RNG_SEED, participation },
    store,
  );
  if (!created.ok) {
    throw new Error(created.error);
  }
  const saveId = created.save.id;
  const view = await loadOwnerSaveView(saveId, store);
  const selected = await selectOwnerCity(saveId, view!.cities[0]!.city, store);
  if (!selected.ok) {
    throw new Error(selected.error);
  }
  const loaded = await store.load(saveId);
  const anchorId = loaded!.state.user.activeOwnerTeamId;
  const others = Object.keys(loaded!.state.world.teams)
    .filter((id) => id !== anchorId)
    .sort()
    .slice(0, 2);
  return { saveId, anchorId, others, state: loaded!.state };
}

function franchiseInput(teamId: string, index: number, participantId?: string) {
  return {
    teamId,
    nickname: NICKNAMES[index]!,
    primaryColor: "#112233",
    secondaryColor: "#ffffff",
    accentColor: "#f59e0b",
    logoId: TEAM_LOGO_CATALOG[0]!.id,
    participantId,
  };
}

const TWO_PLAYERS = {
  mode: "local_shared",
  participants: [
    { displayName: "Alex", teamCount: 1 },
    { displayName: "Sam", teamCount: 2 },
  ],
};

async function onboardHotseat() {
  const store = createMemorySaveGameStore();
  const setup = await createAndPickCity(store, TWO_PLAYERS);
  const [alex, sam] = local(setup.state).participants;
  const confirmed = await confirmControlledFranchises(
    setup.saveId,
    [
      franchiseInput(setup.anchorId, 0, alex!.id),
      franchiseInput(setup.others[0]!, 1, sam!.id),
      franchiseInput(setup.others[1]!, 2, sam!.id),
    ],
    store,
  );
  if (!confirmed.ok) {
    throw new Error(confirmed.error);
  }
  return { store, ...setup, alex: alex!, sam: sam! };
}

describe("local shared league", () => {
  it("creates an onboarding league where the host holds the anchor team", async () => {
    const store = createMemorySaveGameStore();
    const { state, anchorId } = await createAndPickCity(store, TWO_PLAYERS);
    const participation = local(state);
    expect(state.settings.ownership.controlledTeamCount).toBe(3);
    expect(participation.assignmentsConfirmed).toBe(false);
    expect(participation.participants.map((p) => p.displayName)).toEqual([
      "Alex",
      "Sam",
    ]);
    expect(participation.participants[0]!.teamIds).toEqual([anchorId]);
    expect(participation.participants[0]!.isHost).toBe(true);
    expect(participation.participants[1]!.teamIds).toEqual([]);
  });

  it("rejects assignments that do not match each participant's plan", async () => {
    const store = createMemorySaveGameStore();
    const setup = await createAndPickCity(store, TWO_PLAYERS);
    const [alex, sam] = local(setup.state).participants;
    const before = await store.load(setup.saveId);
    const result = await confirmControlledFranchises(
      setup.saveId,
      [
        franchiseInput(setup.anchorId, 0, alex!.id),
        franchiseInput(setup.others[0]!, 1, alex!.id),
        franchiseInput(setup.others[1]!, 2, sam!.id),
      ],
      store,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Alex must manage 1 franchise/);
    }
    const after = await store.load(setup.saveId);
    expect(after!.updatedAt).toEqual(before!.updatedAt);
  });

  it("assigns franchises per participant and keeps ownership on reload", async () => {
    const { store, saveId, anchorId, others, alex, sam } =
      await onboardHotseat();
    const loaded = await store.load(saveId);
    const participation = local(loaded!.state);
    expect(participation.assignmentsConfirmed).toBe(true);
    expect(participation.activeParticipantId).toBe(alex.id);
    expect(
      participation.participants.find((p) => p.id === alex.id)!.teamIds,
    ).toEqual([anchorId]);
    expect(
      [
        ...participation.participants.find((p) => p.id === sam.id)!.teamIds,
      ].sort(),
    ).toEqual([...others].sort());
    expect([...loaded!.state.user.ownedTeamIds].sort()).toEqual(
      [anchorId, ...others].sort(),
    );
  });

  it("only lets the active participant act as their own franchises", async () => {
    const { store, saveId, others, sam } = await onboardHotseat();
    const blocked = await switchActiveOwnerTeam(saveId, others[0]!, store);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/belongs to Sam/);
    }

    const switched = await switchParticipant(saveId, sam.id, store);
    expect(switched.ok).toBe(true);
    const loaded = await store.load(saveId);
    expect(local(loaded!.state).activeParticipantId).toBe(sam.id);
    expect(sam.id).toBe(local(loaded!.state).activeParticipantId);
    expect(others).toContain(loaded!.state.user.activeOwnerTeamId);
    const ownTeam = others.find(
      (id) => id !== loaded!.state.user.activeOwnerTeamId,
    )!;
    expect((await switchActiveOwnerTeam(saveId, ownTeam, store)).ok).toBe(true);
  });

  it("blocks advancing until every participant is ready, then resets", async () => {
    const { store, saveId, sam } = await onboardHotseat();
    const before = await store.load(saveId);

    const blocked = await advanceOwnerTime(saveId, { days: 1 }, store);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toMatch(/Waiting on Alex and Sam/);
    }
    const unchanged = await store.load(saveId);
    expect(unchanged!.updatedAt).toEqual(before!.updatedAt);

    expect((await setActiveParticipantReady(saveId, true, store)).ok).toBe(
      true,
    );
    const stillBlocked = await advanceOwnerTime(saveId, { days: 1 }, store);
    expect(stillBlocked.ok).toBe(false);
    if (!stillBlocked.ok) {
      expect(stillBlocked.error).toMatch(/Waiting on Sam to press Ready/);
    }

    await switchParticipant(saveId, sam.id, store);
    await setActiveParticipantReady(saveId, true, store);
    const advanced = await advanceOwnerTime(saveId, { days: 1 }, store);
    expect(advanced.ok).toBe(true);
    const after = await store.load(saveId);
    expect(after!.state.world.calendar.currentDate).not.toBe(
      before!.state.world.calendar.currentDate,
    );
    expect(local(after!.state).readyParticipantIds).toEqual([]);
  });

  it("lets only the host mark everyone ready", async () => {
    const { store, saveId, alex, sam } = await onboardHotseat();
    await switchParticipant(saveId, sam.id, store);
    const denied = await readyAllParticipants(saveId, store);
    expect(denied.ok).toBe(false);

    await switchParticipant(saveId, alex.id, store);
    expect((await readyAllParticipants(saveId, store)).ok).toBe(true);
    expect((await advanceOwnerTime(saveId, { days: 1 }, store)).ok).toBe(true);
  });

  it("simulates identically to the same save in single-player mode", async () => {
    const hotseat = await onboardHotseat();
    const onboarded = (await hotseat.store.load(hotseat.saveId))!.state;

    // Same league, same owned teams, same RNG — only participation differs.
    const soloStore = createMemorySaveGameStore();
    await soloStore.create({
      id: hotseat.saveId,
      name: "Solo copy",
      state: {
        ...onboarded,
        user: { ...onboarded.user, participation: { mode: "single" } },
      },
    });

    await readyAllParticipants(hotseat.saveId, hotseat.store);
    expect(
      (await advanceOwnerTime(hotseat.saveId, { days: 3 }, hotseat.store)).ok,
    ).toBe(true);
    expect(
      (await advanceOwnerTime(hotseat.saveId, { days: 3 }, soloStore)).ok,
    ).toBe(true);

    const shared = (await hotseat.store.load(hotseat.saveId))!.state;
    const single = (await soloStore.load(hotseat.saveId))!.state;
    // Event-log ids are random UUIDs (not seeded RNG); compare everything else.
    const comparable = (value: unknown) =>
      JSON.stringify(value).replace(/"evt_[^"]+"/g, '"evt"');
    expect(shared.meta.rngState).toBe(single.meta.rngState);
    expect(comparable(shared.world)).toBe(comparable(single.world));
    expect(comparable(shared.competition)).toBe(comparable(single.competition));
    expect(comparable(shared.business)).toBe(comparable(single.business));
  });
});

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
  switchParticipant,
} from "@/application/game-service";
import {
  createLeagueInvite,
  joinLeagueWithInvite,
  leaveOnlineLeague,
  listLeagueInvites,
  previewLeagueInvite,
  removeOnlineParticipant,
  revokeLeagueInvite,
  transferOnlineHost,
  type OnlineLeagueContext,
} from "@/application/game-service/online-league";
import { createActingSaveGameStore } from "@/application/online/acting-save-store";
import { TEAM_LOGO_CATALOG } from "@/data/team-branding/logo-catalog";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import type { SharedParticipation } from "@/domain/participation";
import { createMemoryAccountStore } from "@/persistence/memory-account-store";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { isSaveVersionConflict } from "@/persistence/save-version-conflict";
import type { GameState } from "@/state/game-state";
import { TEST_RNG_SEED } from "../helpers/determinism";

const HOST = { id: "user_host", username: "hostess" };
const GUEST = { id: "user_guest", username: "guest" };
const STRANGER = { id: "user_stranger", username: "stranger" };

function shared(state: GameState): SharedParticipation {
  if (state.user.participation.mode !== "online") {
    throw new Error("expected an online league");
  }
  return state.user.participation;
}

function actingAs(base: SaveGameStore, user: { id: string } | null) {
  return createActingSaveGameStore(base, async () => user?.id ?? null);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

async function createOnlineLeague() {
  const base = createMemorySaveGameStore();
  const accounts = createMemoryAccountStore();
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  const created = await createNewOwnerSave(
    {
      settings,
      name: "Online",
      rngSeed: TEST_RNG_SEED,
      participation: { mode: "online" },
      hostUser: HOST,
    },
    base,
  );
  if (!created.ok) throw new Error(created.error);
  const saveId = created.save.id;
  const view = await loadOwnerSaveView(saveId, base);
  const city = await selectOwnerCity(saveId, view!.cities[0]!.city, base);
  if (!city.ok) throw new Error(city.error);
  const anchorId = (await base.load(saveId))!.state.user.activeOwnerTeamId;
  const confirmed = await confirmControlledFranchises(
    saveId,
    [
      {
        teamId: anchorId,
        nickname: "Falcons",
        primaryColor: "#112233",
        secondaryColor: "#ffffff",
        accentColor: "#f59e0b",
        logoId: TEAM_LOGO_CATALOG[0]!.id,
      },
    ],
    base,
  );
  if (!confirmed.ok) throw new Error(confirmed.error);
  const ctx = (user: { id: string; username: string } | null) =>
    ({ user, saves: base, accounts }) satisfies OnlineLeagueContext;
  return { base, accounts, saveId, anchorId, ctx };
}

async function withGuest() {
  const league = await createOnlineLeague();
  const invite = await createLeagueInvite(league.ctx(HOST), league.saveId);
  if (!invite.ok) throw new Error(invite.error);
  const preview = await previewLeagueInvite(league.ctx(GUEST), invite.token);
  if (!preview.ok) throw new Error(preview.error);
  const guestTeamId = preview.preview.openTeams[0]!.id;
  const joined = await joinLeagueWithInvite(
    league.ctx(GUEST),
    invite.token,
    guestTeamId,
  );
  if (!joined.ok) throw new Error(joined.error);
  return { ...league, guestTeamId, token: invite.token };
}

describe("online league creation and access", () => {
  it("requires a signed-in host and records them as a participant", async () => {
    const store = createMemorySaveGameStore();
    const anonymous = await createNewOwnerSave(
      { name: "x", participation: { mode: "online" }, hostUser: null },
      store,
    );
    expect(anonymous.ok).toBe(false);

    const { base, saveId, anchorId } = await createOnlineLeague();
    const participation = shared((await base.load(saveId))!.state);
    expect(participation.assignmentsConfirmed).toBe(true);
    expect(participation.participants).toHaveLength(1);
    expect(participation.participants[0]).toMatchObject({
      userId: HOST.id,
      displayName: HOST.username,
      isHost: true,
      teamIds: [anchorId],
    });
  });

  it("hides the league from non-members and signed-out users", async () => {
    const { base, saveId } = await createOnlineLeague();
    expect(await actingAs(base, STRANGER).load(saveId)).toBeNull();
    expect(await actingAs(base, null).load(saveId)).toBeNull();
    expect(await actingAs(base, HOST).load(saveId)).not.toBeNull();
    // Commands go through the same check.
    const denied = await setActiveParticipantReady(
      saveId,
      true,
      actingAs(base, STRANGER),
    );
    expect(denied.ok).toBe(false);
  });

  it("does not allow hotseat-style player switching", async () => {
    const { base, saveId } = await withGuest();
    const guestId = shared((await base.load(saveId))!.state).participants[1]!
      .id;
    const result = await switchParticipant(saveId, guestId, actingAs(base, HOST));
    expect(result.ok).toBe(false);
  });
});

describe("invites", () => {
  it("lets only the host create, list and revoke invites", async () => {
    const { ctx, saveId } = await withGuest();
    expect((await createLeagueInvite(ctx(GUEST), saveId)).ok).toBe(false);
    expect((await createLeagueInvite(ctx(STRANGER), saveId)).ok).toBe(false);
    expect((await listLeagueInvites(ctx(GUEST), saveId)).ok).toBe(false);

    const invite = await createLeagueInvite(ctx(HOST), saveId);
    if (!invite.ok) throw new Error(invite.error);
    expect((await revokeLeagueInvite(ctx(HOST), saveId, invite.invite.id)).ok)
      .toBe(true);
    expect((await previewLeagueInvite(ctx(STRANGER), invite.token)).ok).toBe(
      false,
    );
  });

  it("joins by taking over an AI franchise and uses up a single-use invite", async () => {
    const { base, saveId, guestTeamId, token, ctx } = await withGuest();
    const state = (await base.load(saveId))!.state;
    expect(state.user.ownedTeamIds).toContain(guestTeamId);
    const guest = shared(state).participants.find(
      (p) => p.userId === GUEST.id,
    )!;
    expect(guest.teamIds).toEqual([guestTeamId]);
    expect(guest.isHost).toBe(false);

    const second = await previewLeagueInvite(ctx(STRANGER), token);
    expect(second.ok).toBe(false);

    const guestView = await actingAs(base, GUEST).load(saveId);
    expect(guestView!.state.user.activeOwnerTeamId).toBe(guestTeamId);
  });

  it("gives the invite use back when a join fails", async () => {
    const { ctx, saveId, anchorId, accounts } = await createOnlineLeague();
    const invite = await createLeagueInvite(ctx(HOST), saveId);
    if (!invite.ok) throw new Error(invite.error);
    const taken = await joinLeagueWithInvite(ctx(GUEST), invite.token, anchorId);
    expect(taken.ok).toBe(false);
    const [stored] = await accounts.listInvites(saveId);
    expect(stored!.uses).toBe(0);
  });

  it("rejects expired invites and signed-out joiners", async () => {
    const { ctx, saveId, base } = await createOnlineLeague();
    const invite = await createLeagueInvite(ctx(HOST), saveId, { days: 1 });
    if (!invite.ok) throw new Error(invite.error);
    const teamId = Object.keys((await base.load(saveId))!.state.world.teams)[1]!;
    expect(
      (await joinLeagueWithInvite(ctx(null), invite.token, teamId)).ok,
    ).toBe(false);
    const later = {
      ...ctx(GUEST),
      now: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    };
    expect((await joinLeagueWithInvite(later, invite.token, teamId)).ok).toBe(
      false,
    );
  });
});

describe("online turns and concurrency", () => {
  it("advances only when every member is ready, each from their own session", async () => {
    const { base, saveId } = await withGuest();
    const hostStore = actingAs(base, HOST);
    const guestStore = actingAs(base, GUEST);

    expect((await advanceOwnerTime(saveId, { days: 1 }, hostStore)).ok).toBe(
      false,
    );
    expect((await setActiveParticipantReady(saveId, true, hostStore)).ok).toBe(
      true,
    );
    const waiting = await advanceOwnerTime(saveId, { days: 1 }, hostStore);
    expect(waiting.ok).toBe(false);
    if (!waiting.ok) expect(waiting.error).toMatch(/Waiting on guest/);

    expect(
      (await setActiveParticipantReady(saveId, true, actingAs(base, GUEST))).ok,
    ).toBe(true);
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, GUEST))).ok,
    ).toBe(true);
    expect(shared((await base.load(saveId))!.state).readyParticipantIds).toEqual(
      [],
    );
    // A retried advance cannot simulate the same window twice.
    expect((await advanceOwnerTime(saveId, { days: 1 }, guestStore)).ok).toBe(
      false,
    );
  });

  it("lets only the host advance for everyone", async () => {
    const { base, saveId } = await withGuest();
    expect((await readyAllParticipants(saveId, actingAs(base, GUEST))).ok).toBe(
      false,
    );
    expect((await readyAllParticipants(saveId, actingAs(base, HOST))).ok).toBe(
      true,
    );
  });

  it("rejects a write based on a stale load instead of overwriting", async () => {
    const { base, saveId } = await withGuest();
    const hostStore = actingAs(base, HOST);
    const guestStore = actingAs(base, GUEST);
    const hostLoaded = await hostStore.load(saveId);
    const guestLoaded = await guestStore.load(saveId);
    await tick();
    await hostStore.save({ id: saveId, state: hostLoaded!.state });
    await tick();
    await expect(
      guestStore.save({ id: saveId, state: guestLoaded!.state }),
    ).rejects.toSatisfy(isSaveVersionConflict);
  });

  it("refuses writes from non-members and blind writes without a load", async () => {
    const { base, saveId } = await withGuest();
    const state = (await base.load(saveId))!.state;
    await expect(
      actingAs(base, STRANGER).save({ id: saveId, state }),
    ).rejects.toThrow(/not a member/);
    await expect(actingAs(base, HOST).save({ id: saveId, state })).rejects.toThrow(
      /must follow a load/,
    );
  });

  it("only lets the host delete the league", async () => {
    const { base, saveId } = await withGuest();
    await expect(actingAs(base, GUEST).delete(saveId)).rejects.toThrow(
      /Only the host/,
    );
    expect(await actingAs(base, HOST).delete(saveId)).toBe(true);
  });
});

describe("membership changes", () => {
  it("returns a leaving member's franchise to the AI", async () => {
    const { base, saveId, guestTeamId, ctx } = await withGuest();
    expect((await leaveOnlineLeague(ctx(GUEST), saveId)).ok).toBe(true);
    const state = (await base.load(saveId))!.state;
    expect(state.user.ownedTeamIds).not.toContain(guestTeamId);
    expect(shared(state).participants.map((p) => p.userId)).toEqual([HOST.id]);
    expect(await actingAs(base, GUEST).load(saveId)).toBeNull();
  });

  it("keeps the host from leaving and lets them remove or promote members", async () => {
    const { base, saveId, ctx } = await withGuest();
    expect((await leaveOnlineLeague(ctx(HOST), saveId)).ok).toBe(false);
    const guestId = shared((await base.load(saveId))!.state).participants.find(
      (p) => p.userId === GUEST.id,
    )!.id;

    expect(
      (await removeOnlineParticipant(ctx(GUEST), saveId, guestId)).ok,
    ).toBe(false);
    expect((await transferOnlineHost(ctx(HOST), saveId, guestId)).ok).toBe(true);
    let state = (await base.load(saveId))!.state;
    expect(shared(state).participants.find((p) => p.isHost)!.userId).toBe(
      GUEST.id,
    );

    const hostId = shared(state).participants.find(
      (p) => p.userId === HOST.id,
    )!.id;
    expect((await removeOnlineParticipant(ctx(GUEST), saveId, hostId)).ok).toBe(
      true,
    );
    state = (await base.load(saveId))!.state;
    expect(shared(state).participants.map((p) => p.userId)).toEqual([GUEST.id]);
  });
});

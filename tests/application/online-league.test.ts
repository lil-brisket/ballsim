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
  openApprovalWindow,
  previewLeagueInvite,
  removeOnlineParticipant,
  revokeLeagueInvite,
  setAutoManageAfterDays,
  setParticipantAutoManaged,
  transferOnlineHost,
  type OnlineLeagueContext,
} from "@/application/game-service/online-league";
import { createActingSaveGameStore } from "@/application/online/acting-save-store";
import { TEAM_LOGO_CATALOG } from "@/data/team-branding/logo-catalog";
import {
  type PendingOwnerDecision,
  buildTradeOfferPayload,
} from "@/domain/entities/owner-decision";
import { asOwnerDecisionId, asTeamId } from "@/domain/ids";
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

function participantOf(state: GameState, userId: string) {
  return shared(state).participants.find((p) => p.userId === userId)!;
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
    const result = await switchParticipant(
      saveId,
      guestId,
      actingAs(base, HOST),
    );
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
    expect(
      (await revokeLeagueInvite(ctx(HOST), saveId, invite.invite.id)).ok,
    ).toBe(true);
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
    const taken = await joinLeagueWithInvite(
      ctx(GUEST),
      invite.token,
      anchorId,
    );
    expect(taken.ok).toBe(false);
    const [stored] = await accounts.listInvites(saveId);
    expect(stored!.uses).toBe(0);
  });

  it("rejects expired invites and signed-out joiners", async () => {
    const { ctx, saveId, base } = await createOnlineLeague();
    const invite = await createLeagueInvite(ctx(HOST), saveId, { days: 1 });
    if (!invite.ok) throw new Error(invite.error);
    const teamId = Object.keys(
      (await base.load(saveId))!.state.world.teams,
    )[1]!;
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

    const waiting = await advanceOwnerTime(saveId, { days: 1 }, hostStore);
    expect(waiting.ok).toBe(false);
    if (!waiting.ok) expect(waiting.error).toMatch(/Waiting on guest/);

    expect(
      (await setActiveParticipantReady(saveId, true, actingAs(base, GUEST))).ok,
    ).toBe(true);
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, HOST))).ok,
    ).toBe(true);
    expect(
      shared((await base.load(saveId))!.state).readyParticipantIds,
    ).toEqual([]);
    // A retried advance cannot simulate the same window twice.
    expect((await advanceOwnerTime(saveId, { days: 1 }, hostStore)).ok).toBe(
      false,
    );
  });

  it("lets only the commissioner advance the league", async () => {
    const { base, saveId } = await withGuest();
    expect(
      (await setActiveParticipantReady(saveId, true, actingAs(base, GUEST))).ok,
    ).toBe(true);
    const member = await advanceOwnerTime(
      saveId,
      { days: 1 },
      actingAs(base, GUEST),
    );
    expect(member.ok).toBe(false);
    if (!member.ok) {
      expect(member.error).toMatch(/Only the commissioner \(hostess\)/);
    }
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
    await expect(
      actingAs(base, HOST).save({ id: saveId, state }),
    ).rejects.toThrow(/must follow a load/);
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
    expect((await transferOnlineHost(ctx(HOST), saveId, guestId)).ok).toBe(
      true,
    );
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

describe("approval windows and auto-management", () => {
  const HOUR = 60 * 60 * 1000;

  it("lets late members' teams go to the AI once the approval window closes", async () => {
    const { base, saveId, guestTeamId, ctx } = await withGuest();
    const before = (await base.load(saveId))!.state;
    const ownSettings = before.user.ownedFranchises[asTeamId(guestTeamId)]!;

    expect((await openApprovalWindow(ctx(GUEST), saveId, 24)).ok).toBe(false);
    expect((await openApprovalWindow(ctx(HOST), saveId, 0)).ok).toBe(false);
    expect((await openApprovalWindow(ctx(HOST), saveId, 24)).ok).toBe(true);
    const open = await advanceOwnerTime(
      saveId,
      { days: 1 },
      actingAs(base, HOST),
    );
    expect(open.ok).toBe(false);
    if (!open.ok) {
      expect(open.error).toMatch(/approve before the approval window closes/);
    }

    // A one-hour window opened two hours ago has already closed.
    const closed = await openApprovalWindow(
      { ...ctx(HOST), now: new Date(Date.now() - 2 * HOUR) },
      saveId,
      1,
    );
    expect(closed.ok).toBe(true);
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, HOST))).ok,
    ).toBe(true);

    let state = (await base.load(saveId))!.state;
    const guest = participantOf(state, GUEST.id);
    expect(guest.autoManaged?.reason).toBe("missed_approval");
    expect(shared(state).approvalWindow).toBeUndefined();
    expect(
      state.user.ownedFranchises[asTeamId(guestTeamId)]!.managementPreset,
    ).toBe("full_management");

    // Taking control back restores the member's own settings.
    expect(
      (await setParticipantAutoManaged(ctx(GUEST), saveId, guest.id, false)).ok,
    ).toBe(true);
    state = (await base.load(saveId))!.state;
    expect(participantOf(state, GUEST.id).autoManaged).toBeUndefined();
    expect(participantOf(state, GUEST.id).lastActiveAt).toBeDefined();
    const restored = state.user.ownedFranchises[asTeamId(guestTeamId)]!;
    expect(restored.managementPreset).toBe(ownSettings.managementPreset);
    expect(restored.aiAssistance).toEqual(ownSettings.aiAssistance);
  });

  it("stops waiting on idle members and hands their teams to the AI", async () => {
    const { base, saveId, ctx } = await withGuest();
    expect((await setAutoManageAfterDays(ctx(GUEST), saveId, 2)).ok).toBe(
      false,
    );
    expect((await setAutoManageAfterDays(ctx(HOST), saveId, 0)).ok).toBe(false);
    expect((await setAutoManageAfterDays(ctx(HOST), saveId, 2)).ok).toBe(true);

    // Recent activity keeps the member in the Ready gate.
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, HOST))).ok,
    ).toBe(false);

    const raw = (await base.load(saveId))!.state;
    const participation = shared(raw);
    await base.save({
      id: saveId,
      state: {
        ...raw,
        user: {
          ...raw.user,
          participation: {
            ...participation,
            participants: participation.participants.map((p) =>
              p.userId === GUEST.id
                ? {
                    ...p,
                    lastActiveAt: new Date(
                      Date.now() - 5 * 24 * HOUR,
                    ).toISOString(),
                  }
                : p,
            ),
          },
        },
      },
    });
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, HOST))).ok,
    ).toBe(true);
    const state = (await base.load(saveId))!.state;
    expect(participantOf(state, GUEST.id).autoManaged?.reason).toBe("inactive");
    expect(shared(state).autoManageAfterDays).toBe(2);
  });

  it("stamps a member's activity on each of their writes", async () => {
    const { base, saveId } = await withGuest();
    const clock = new Date("2030-01-02T03:04:05.000Z");
    const guestStore = createActingSaveGameStore(base, async () => GUEST.id, {
      now: () => clock,
    });
    expect((await setActiveParticipantReady(saveId, true, guestStore)).ok).toBe(
      true,
    );
    const state = (await base.load(saveId))!.state;
    expect(participantOf(state, GUEST.id).lastActiveAt).toBe(
      clock.toISOString(),
    );
  });

  it("limits who can switch auto-management on and off", async () => {
    const { base, saveId, ctx } = await withGuest();
    const state = (await base.load(saveId))!.state;
    const hostId = participantOf(state, HOST.id).id;
    const guestId = participantOf(state, GUEST.id).id;

    expect(
      (await setParticipantAutoManaged(ctx(GUEST), saveId, hostId, true)).ok,
    ).toBe(false);
    const commissioner = await setParticipantAutoManaged(
      ctx(HOST),
      saveId,
      hostId,
      true,
    );
    expect(commissioner.ok).toBe(false);
    if (!commissioner.ok) {
      expect(commissioner.error).toMatch(/commissioner's teams/);
    }

    expect(
      (await setParticipantAutoManaged(ctx(GUEST), saveId, guestId, true)).ok,
    ).toBe(true);
    let after = (await base.load(saveId))!.state;
    expect(participantOf(after, GUEST.id).autoManaged?.reason).toBe("manual");
    // An auto-managed member never holds up the commissioner.
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, HOST))).ok,
    ).toBe(true);

    // Promoting an auto-managed member gives them their teams back first.
    expect((await transferOnlineHost(ctx(HOST), saveId, guestId)).ok).toBe(
      true,
    );
    after = (await base.load(saveId))!.state;
    expect(participantOf(after, GUEST.id)).toMatchObject({ isHost: true });
    expect(participantOf(after, GUEST.id).autoManaged).toBeUndefined();
  });
});

describe("blocking decisions on auto-managed teams", () => {
  it("expires them instead of freezing the league", async () => {
    const { base, saveId, guestTeamId, ctx } = await withGuest();
    const raw = (await base.load(saveId))!.state;
    const guestTeam = asTeamId(guestTeamId);
    const aiTeam = asTeamId(
      Object.keys(raw.world.teams).find(
        (id) => !raw.user.ownedTeamIds.includes(asTeamId(id)),
      )!,
    );
    const proposal = {
      sideA: { teamId: aiTeam, playerIds: [], draftPickIds: [] },
      sideB: { teamId: guestTeam, playerIds: [], draftPickIds: [] },
    };
    const decision: PendingOwnerDecision = {
      id: asOwnerDecisionId("od_away_block"),
      type: "trade_offer",
      createdOn: raw.world.calendar.currentDate,
      blockingLevel: "blocking",
      primaryTeamId: guestTeam,
      participantTeamIds: [guestTeam, aiTeam],
      payload: buildTradeOfferPayload({
        offeringTeamId: aiTeam,
        userTeamId: guestTeam,
        proposal,
        fingerprint: `${aiTeam}|${guestTeam}|away|`,
        createdOn: raw.world.calendar.currentDate,
      }),
    };
    await base.save({
      id: saveId,
      state: {
        ...raw,
        user: { ...raw.user, pendingOwnerDecisions: [decision] },
      },
    });

    expect(
      (await setActiveParticipantReady(saveId, true, actingAs(base, GUEST))).ok,
    ).toBe(true);
    const blocked = await advanceOwnerTime(
      saveId,
      { days: 1 },
      actingAs(base, HOST),
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error).toMatch(/guest must resolve/);

    const guestId = participantOf(
      (await base.load(saveId))!.state,
      GUEST.id,
    ).id;
    expect(
      (await setParticipantAutoManaged(ctx(HOST), saveId, guestId, true)).ok,
    ).toBe(true);
    const state = (await base.load(saveId))!.state;
    expect(
      state.user.pendingOwnerDecisions.some((d) => d.id === decision.id),
    ).toBe(false);
    expect(
      (await advanceOwnerTime(saveId, { days: 1 }, actingAs(base, HOST))).ok,
    ).toBe(true);
  });
});

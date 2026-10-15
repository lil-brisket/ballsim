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
  acceptOwnerDecision,
  advanceOwnerTime,
  confirmControlledFranchises,
  createNewOwnerSave,
  declineOwnerDecision,
  executeOwnerTrade,
  loadOwnerSaveView,
  proposeTradeToParticipant,
  readyAllParticipants,
  selectOwnerCity,
  submitTradeCounteroffer,
  switchParticipant,
} from "@/application/game-service";
import { TEAM_LOGO_CATALOG } from "@/data/team-branding/logo-catalog";
import { CBL_GAME_SETTINGS, cloneGameSettings } from "@/domain/game-settings";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asTeamId } from "@/domain/ids";
import type { SharedParticipation } from "@/domain/participation";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import type { GameState } from "@/state/game-state";
import { buildTradeInbox } from "@/state/owner-dashboard/trade-inbox";
import { toNotificationsView } from "@/state/selectors/dashboard";
import { TEST_RNG_SEED } from "../helpers/determinism";

function local(state: GameState): SharedParticipation {
  if (state.user.participation.mode === "single") {
    throw new Error("expected a shared league");
  }
  return state.user.participation;
}

async function hotseat() {
  const store = createMemorySaveGameStore();
  const settings = cloneGameSettings(CBL_GAME_SETTINGS);
  settings.league.area = "north_america";
  const created = await createNewOwnerSave(
    {
      settings,
      name: "Trades",
      rngSeed: TEST_RNG_SEED,
      participation: {
        mode: "local_shared",
        participants: [
          { displayName: "Alex", teamCount: 1 },
          { displayName: "Sam", teamCount: 1 },
        ],
      },
    },
    store,
  );
  if (!created.ok) throw new Error(created.error);
  const saveId = created.save.id;
  const view = await loadOwnerSaveView(saveId, store);
  await selectOwnerCity(saveId, view!.cities[0]!.city, store);
  const state = (await store.load(saveId))!.state;
  const alexTeam = state.user.activeOwnerTeamId;
  const samTeam = Object.keys(state.world.teams)
    .filter((id) => id !== alexTeam)
    .sort()[0]!;
  const [alex, sam] = local(state).participants;
  const confirmed = await confirmControlledFranchises(
    saveId,
    [alexTeam, samTeam].map((teamId, i) => ({
      teamId,
      nickname: ["Falcons", "Comets"][i]!,
      primaryColor: "#112233",
      secondaryColor: "#ffffff",
      accentColor: "#f59e0b",
      logoId: TEAM_LOGO_CATALOG[0]!.id,
      participantId: [alex!.id, sam!.id][i],
    })),
    store,
  );
  if (!confirmed.ok) throw new Error(confirmed.error);
  const loaded = (await store.load(saveId))!.state;
  const lastPlayer = (teamId: string) => {
    const roster = loaded.world.teams[teamId]!.roster;
    return roster[roster.length - 1]!;
  };
  const proposal: TradeProposal = {
    sideA: { teamId: alexTeam, playerIds: [lastPlayer(alexTeam)], draftPickIds: [] },
    sideB: { teamId: asTeamId(samTeam), playerIds: [lastPlayer(samTeam)], draftPickIds: [] },
  };
  return { store, saveId, alexTeam, samTeam, alex: alex!, sam: sam!, proposal };
}

describe("trades between participants", () => {
  it("routes a proposal to the other player instead of letting the AI accept", async () => {
    const { store, saveId, proposal, samTeam } = await hotseat();
    const direct = await executeOwnerTrade(
      saveId,
      { outgoingPlayerId: proposal.sideA.playerIds[0]!, proposal },
      store,
    );
    expect(direct.ok).toBe(false);

    const sent = await proposeTradeToParticipant(saveId, proposal, store);
    expect(sent.ok).toBe(true);
    const state = (await store.load(saveId))!.state;
    const offer = state.user.pendingOwnerDecisions.at(-1)!;
    expect(offer.payload.userTeamId).toBe(samTeam);
    expect(offer.blockingLevel).toBe("non_blocking");
    expect(offer.participantTeamIds).toEqual([samTeam]);
  });

  it("only the recipient can accept, and accepting executes the trade", async () => {
    const { store, saveId, proposal, sam, alexTeam, samTeam } = await hotseat();
    await proposeTradeToParticipant(saveId, proposal, store);
    const decisionId = (await store.load(saveId))!.state.user
      .pendingOwnerDecisions.at(-1)!.id;

    const selfAccept = await acceptOwnerDecision(saveId, decisionId, store);
    expect(selfAccept.ok).toBe(false);

    await switchParticipant(saveId, sam.id, store);
    const accepted = await acceptOwnerDecision(saveId, decisionId, store);
    expect(accepted.ok).toBe(true);
    const after = (await store.load(saveId))!.state;
    expect(after.world.teams[samTeam]!.roster).toContain(
      proposal.sideA.playerIds[0],
    );
    expect(after.world.teams[alexTeam]!.roster).toContain(
      proposal.sideB.playerIds[0],
    );
  });

  it("lets the proposer withdraw their offer", async () => {
    const { store, saveId, proposal } = await hotseat();
    await proposeTradeToParticipant(saveId, proposal, store);
    const decisionId = (await store.load(saveId))!.state.user
      .pendingOwnerDecisions.at(-1)!.id;
    expect((await declineOwnerDecision(saveId, decisionId, store)).ok).toBe(true);
    expect(
      (await store.load(saveId))!.state.user.pendingOwnerDecisions.some(
        (d) => d.id === decisionId,
      ),
    ).toBe(false);
  });

  it("sends a counteroffer back to the proposer", async () => {
    const { store, saveId, proposal, sam, alexTeam } = await hotseat();
    await proposeTradeToParticipant(saveId, proposal, store);
    const decisionId = (await store.load(saveId))!.state.user
      .pendingOwnerDecisions.at(-1)!.id;
    await switchParticipant(saveId, sam.id, store);
    const counter: TradeProposal = {
      sideA: proposal.sideB,
      sideB: proposal.sideA,
    };
    const countered = await submitTradeCounteroffer(
      saveId,
      decisionId,
      counter,
      store,
    );
    expect(countered.ok).toBe(true);
    const pending = (await store.load(saveId))!.state.user.pendingOwnerDecisions;
    expect(pending.some((d) => d.id === decisionId)).toBe(false);
    expect(pending.at(-1)!.payload.userTeamId).toBe(alexTeam);
  });

  it("does not block the league from advancing", async () => {
    const { store, saveId, proposal } = await hotseat();
    await proposeTradeToParticipant(saveId, proposal, store);
    await readyAllParticipants(saveId, store);
    expect((await advanceOwnerTime(saveId, { days: 1 }, store)).ok).toBe(true);
  });
});

describe("per-participant inbox", () => {
  it("counts and shows only the acting player's offers and notifications", async () => {
    const { store, saveId, proposal, sam, samTeam } = await hotseat();
    await proposeTradeToParticipant(saveId, proposal, store);
    const asAlex = (await store.load(saveId))!.state;
    expect(buildTradeInbox(asAlex).totalPending).toBe(0);

    await switchParticipant(saveId, sam.id, store);
    const asSam = (await store.load(saveId))!.state;
    expect(buildTradeInbox(asSam).totalPending).toBe(1);

    const notifications = toNotificationsView(asSam);
    for (const entry of notifications) {
      expect(entry.teamId).toBe(samTeam);
    }
  });
});

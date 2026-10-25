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
  createNewOwnerSave,
  executeOwnerTradeOffer,
  findOwnerTradeOffers,
  type OwnerTradeAssetInput,
} from "@/application/game-service";
import { ensureAiTradeBlocks } from "@/application/game-service/internal";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { DraftPickId, PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  TRADE_OFFER_MAX_ASSETS_PER_SIDE,
  TRADE_OFFER_PACKAGE_WEIGHTS,
} from "@/systems/trades-config";
import {
  evaluateTradeOffer,
  getTeamAssetValue,
  ownedAvailablePickIds,
  validateTrade,
} from "@/systems/trades";
import { DRAFT_PICK_TRADE_HORIZON_YEARS } from "@/systems/league-rules";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { TEST_RNG_SEED } from "../helpers/determinism";

async function seedSave() {
  const store = createMemorySaveGameStore();
  const created = await createNewOwnerSave(
    {
      name: "Trade Finder Offers",
      rngSeed: TEST_RNG_SEED,
      settings: CBL_GAME_SETTINGS,
    },
    store,
  );
  if (!created.ok) {
    throw new Error(created.error);
  }
  const loaded = await store.load(created.save.id);
  const state = loaded!.state;
  const teamId = state.user.activeOwnerTeamId;
  return { store, saveId: created.save.id, state, teamId };
}

function rosterByOverall(state: GameState, teamId: TeamId): PlayerId[] {
  const overall = (id: PlayerId) => {
    const player = state.world.players[id]!;
    return calculatePlayerOverall(player.position, player.attributes);
  };
  return [...state.world.teams[teamId]!.roster].sort(
    (a, b) => overall(b) - overall(a),
  );
}

function ownedPicks(state: GameState, teamId: TeamId): DraftPickId[] {
  return Object.values(state.world.draftPicks)
    .filter((pick) => pick.ownerTeamId === teamId)
    .sort((a, b) => a.seasonYear - b.seasonYear || a.round - b.round)
    .map((pick) => pick.id);
}

function weighted(values: number[]): number {
  return [...values]
    .sort((a, b) => b - a)
    .reduce(
      (sum, value, index) =>
        sum + value * (TRADE_OFFER_PACKAGE_WEIGHTS[index] ?? 0),
      0,
    );
}

function sideAssets(side: TradeProposal["sideA"]) {
  return [
    ...side.playerIds.map((playerId) => ({
      kind: "player" as const,
      playerId,
    })),
    ...side.draftPickIds.map((draftPickId) => ({
      kind: "draftPick" as const,
      draftPickId,
    })),
  ];
}

describe("findOwnerTradeOffers", () => {
  it("returns one acceptable, capped offer per interested team, sorted by interest", async () => {
    const { store, saveId, state, teamId } = await seedSave();
    const roster = rosterByOverall(state, teamId);
    const assets: OwnerTradeAssetInput[] = [
      { kind: "player", id: roster[2]! },
      { kind: "player", id: roster[8]! },
      { kind: "draftPick", id: ownedPicks(state, teamId)[0]! },
    ];
    const blocksBefore = JSON.stringify(state.business.tradeBlocks);

    const result = await findOwnerTradeOffers(saveId, assets, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offers.length).toBeGreaterThan(0);

    const working = ensureAiTradeBlocks(state);
    const seenTeams = new Set<string>();
    for (const [index, offer] of result.offers.entries()) {
      expect(seenTeams.has(offer.counterpartyTeamId)).toBe(false);
      seenTeams.add(offer.counterpartyTeamId);
      expect(offer.interest).toBeGreaterThanOrEqual(0);
      expect(offer.interest).toBeLessThanOrEqual(100);
      if (index > 0) {
        expect(offer.interest).toBeLessThanOrEqual(
          result.offers[index - 1]!.interest,
        );
      }

      const { sideA, sideB } = offer.proposal;
      expect(sideA.teamId).toBe(teamId);
      expect([...sideA.playerIds].sort()).toEqual(
        [roster[2]!, roster[8]!].sort(),
      );
      expect(sideA.draftPickIds).toEqual([assets[2]!.id]);
      const incomingCount = sideB.playerIds.length + sideB.draftPickIds.length;
      expect(incomingCount).toBeGreaterThan(0);
      expect(incomingCount).toBeLessThanOrEqual(
        TRADE_OFFER_MAX_ASSETS_PER_SIDE,
      );
      expect(offer.send).toHaveLength(3);
      expect(offer.receive).toHaveLength(incomingCount);

      expect(validateTrade(working, offer.proposal).valid).toBe(true);
      expect(
        evaluateTradeOffer(working, sideB.teamId, offer.proposal).accepted,
      ).toBe(true);

      // Quantity never buys quality: the counterparty gives up no more
      // weighted value than it receives.
      const value = (asset: ReturnType<typeof sideAssets>[number]) =>
        getTeamAssetValue(working, sideB.teamId, asset).value;
      expect(weighted(sideAssets(sideB).map(value))).toBeLessThanOrEqual(
        weighted(sideAssets(sideA).map(value)) + 1e-9,
      );
    }

    const again = await findOwnerTradeOffers(saveId, assets, store);
    expect(again.ok && again.offers).toEqual(result.offers);

    const after = await store.load(saveId);
    expect(JSON.stringify(after!.state.business.tradeBlocks)).toBe(
      blocksBefore,
    );
  });

  it("rejects invalid asset selections", async () => {
    const { store, saveId, state, teamId } = await seedSave();
    const roster = rosterByOverall(state, teamId);
    const otherTeamId = (Object.keys(state.world.teams) as TeamId[]).find(
      (id) => id !== teamId,
    )!;

    const tooMany = await findOwnerTradeOffers(
      saveId,
      roster.slice(0, 4).map((id) => ({ kind: "player", id })),
      store,
    );
    expect(tooMany).toMatchObject({ ok: false });

    const none = await findOwnerTradeOffers(saveId, [], store);
    expect(none).toMatchObject({ ok: false });

    const duplicate = await findOwnerTradeOffers(
      saveId,
      [
        { kind: "player", id: roster[0]! },
        { kind: "player", id: roster[0]! },
      ],
      store,
    );
    expect(duplicate).toMatchObject({ ok: false });

    const notOurs = await findOwnerTradeOffers(
      saveId,
      [{ kind: "player", id: state.world.teams[otherTeamId]!.roster[0]! }],
      store,
    );
    expect(notOurs).toMatchObject({
      ok: false,
      error: "Player is not on your roster.",
    });

    const farPick = Object.values(state.world.draftPicks).find(
      (pick) =>
        pick.ownerTeamId === teamId &&
        pick.seasonYear >
          state.competition.season.year + DRAFT_PICK_TRADE_HORIZON_YEARS,
    );
    expect(farPick).toBeDefined();
    const beyond = await findOwnerTradeOffers(
      saveId,
      [{ kind: "draftPick", id: farPick!.id }],
      store,
    );
    expect(beyond.ok).toBe(false);
    if (!beyond.ok) {
      expect(beyond.error).toMatch(/trade horizon/);
    }
  });
});

describe("ownedAvailablePickIds", () => {
  it("excludes generated picks beyond the trade horizon", async () => {
    const { state, teamId } = await seedSave();
    const maxYear =
      state.competition.season.year + DRAFT_PICK_TRADE_HORIZON_YEARS;
    const tradable = ownedAvailablePickIds(state, teamId);
    expect(tradable.length).toBeGreaterThan(0);
    for (const pickId of tradable) {
      expect(state.world.draftPicks[pickId]!.seasonYear).toBeLessThanOrEqual(
        maxYear,
      );
    }
    expect(
      ownedPicks(state, teamId).some(
        (pickId) => state.world.draftPicks[pickId]!.seasonYear > maxYear,
      ),
    ).toBe(true);
  });
});

describe("executeOwnerTradeOffer", () => {
  it("executes a pick-only offer exactly as shown", async () => {
    const { store, saveId, state, teamId } = await seedSave();
    const pickId = ownedPicks(state, teamId)[0]!;
    const listed = await findOwnerTradeOffers(
      saveId,
      [{ kind: "draftPick", id: pickId }],
      store,
    );
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const offer = listed.offers[0]!;

    const result = await executeOwnerTradeOffer(saveId, offer.proposal, store);
    expect(result.ok).toBe(true);

    const after = (await store.load(saveId))!.state;
    expect(after.world.draftPicks[pickId]!.ownerTeamId).toBe(
      offer.counterpartyTeamId,
    );
    for (const playerId of offer.proposal.sideB.playerIds) {
      expect(after.world.teams[teamId]!.roster).toContain(playerId);
    }
    for (const draftPickId of offer.proposal.sideB.draftPickIds) {
      expect(after.world.draftPicks[draftPickId]!.ownerTeamId).toBe(teamId);
    }
  });

  it("rejects proposals over the asset cap or not sent by the owner", async () => {
    const { store, saveId, state, teamId } = await seedSave();
    const roster = rosterByOverall(state, teamId);
    const otherTeamId = (Object.keys(state.world.teams) as TeamId[]).find(
      (id) => id !== teamId,
    )!;
    const otherRoster = state.world.teams[otherTeamId]!.roster;

    const oversized: TradeProposal = {
      sideA: { teamId, playerIds: roster.slice(0, 4), draftPickIds: [] },
      sideB: {
        teamId: otherTeamId,
        playerIds: [otherRoster[0]!],
        draftPickIds: [],
      },
    };
    expect(
      await executeOwnerTradeOffer(saveId, oversized, store),
    ).toMatchObject({ ok: false });

    const reversed: TradeProposal = {
      sideA: {
        teamId: otherTeamId,
        playerIds: [otherRoster[0]!],
        draftPickIds: [],
      },
      sideB: { teamId, playerIds: [roster[0]!], draftPickIds: [] },
    };
    expect(await executeOwnerTradeOffer(saveId, reversed, store)).toMatchObject(
      { ok: false, error: "Trade offer must send assets from your team." },
    );

    const unchanged = (await store.load(saveId))!.state;
    expect(unchanged.world.teams[teamId]!.roster).toEqual(
      state.world.teams[teamId]!.roster,
    );
  });
});

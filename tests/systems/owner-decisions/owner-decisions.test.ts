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

import { createTestGameState } from "../../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createSeededRng } from "@/domain/rng";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import {
  acceptOwnerDecision,
  advanceOwnerTime,
  declineOwnerDecision,
  delegateOwnerDecisionToAi,
} from "@/application/game-service";
import {
  enqueueTradeOfferForOwner,
  hasActiveOwnerDecision,
  isInterruptWorthyTradeOffer,
  resolvePendingOwnerDecision,
  tradeOfferFingerprint,
} from "@/systems/owner-decisions";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { evaluateTradeOffer } from "@/systems/trades";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import type { GameState } from "@/state/game-state";
import type { PlayerId, TeamId } from "@/domain/ids";
import { toOwnerDashboardView } from "@/state/owner-dashboard";

function otherTeamId(state: GameState): TeamId {
  const userId = state.user.activeOwnerTeamId;
  const ids = (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== userId)
    .sort();
  return ids[0]!;
}

function boostPlayerOverall(
  state: GameState,
  playerId: PlayerId,
  targetOverall: number,
): GameState {
  const player = state.world.players[playerId];
  if (!player) {
    return state;
  }
  const attrs = { ...player.attributes };
  // Raise primary attributes enough to clear interrupt threshold.
  for (const key of Object.keys(attrs) as (keyof typeof attrs)[]) {
    attrs[key] = Math.min(99, Math.max(attrs[key], targetOverall));
  }
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: { ...player, attributes: attrs },
      },
    },
  };
}

function meaningfulPlayerSwapProposal(state: GameState): {
  state: GameState;
  proposal: TradeProposal;
  offeringTeamId: TeamId;
} {
  const userTeamId = state.user.activeOwnerTeamId;
  const offeringTeamId = otherTeamId(state);
  const userPlayer = state.world.teams[userTeamId]!.roster[3]!;
  const cpuPlayer = state.world.teams[offeringTeamId]!.roster[3]!;

  let working = boostPlayerOverall(state, cpuPlayer, 75);
  working = boostPlayerOverall(working, userPlayer, 70);

  const proposal: TradeProposal = {
    sideA: {
      teamId: offeringTeamId,
      playerIds: [cpuPlayer],
      draftPickIds: [],
    },
    sideB: {
      teamId: userTeamId,
      playerIds: [userPlayer],
      draftPickIds: [],
    },
  };

  return { state: working, proposal, offeringTeamId };
}

describe("v39 → v40 migration", () => {
  it("adds empty pendingOwnerDecisions and ownerDecisionHistory", () => {
    let modern = createTestGameState({ saveId: "mig_v40" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;

    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 39;
    const user = parsed.user as Record<string, unknown>;
    delete user.pendingOwnerDecisions;
    delete user.ownerDecisionHistory;

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(56);
    expect(loaded.user.pendingOwnerDecisions).toEqual([]);
    expect(loaded.user.ownerDecisionHistory).toEqual([]);
    expect(() => validateGameState(loaded)).not.toThrow();
  });
});

describe("owner trade offer enqueue", () => {
  it("queues a trade offer and does not execute the trade", () => {
    let state = createTestGameState({ saveId: "od_queue" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;

    const beforeUserRoster = [
      ...state.world.teams[state.user.activeOwnerTeamId]!.roster,
    ];
    const result = enqueueTradeOfferForOwner(
      state,
      built.offeringTeamId,
      built.proposal,
    );

    expect(result.outcome).toBe("queued");
    expect(hasActiveOwnerDecision(result.state.user)).toBe(true);
    expect(result.state.user.pendingOwnerDecisions).toHaveLength(1);
    expect(result.state.user.pendingOwnerDecisions[0]?.type).toBe("trade_offer");
    expect(result.state.world.teams[state.user.activeOwnerTeamId]!.roster).toEqual(
      beforeUserRoster,
    );
  });

  it("skips when an active decision already exists", () => {
    let state = createTestGameState({ saveId: "od_skip" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;

    const first = enqueueTradeOfferForOwner(
      state,
      built.offeringTeamId,
      built.proposal,
    );
    expect(first.outcome).toBe("queued");

    const second = enqueueTradeOfferForOwner(
      first.state,
      built.offeringTeamId,
      built.proposal,
    );
    expect(second.outcome).toBe("skipped");
    expect(second.reason).toBe("active_decision_exists");
    expect(second.state.user.pendingOwnerDecisions).toHaveLength(1);
  });

  it("skips re-offer after decline fingerprint cooldown", () => {
    let state = createTestGameState({ saveId: "od_cooldown" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;

    const queued = enqueueTradeOfferForOwner(
      state,
      built.offeringTeamId,
      built.proposal,
    );
    expect(queued.outcome).toBe("queued");
    const decisionId = queued.decision!.id;

    const declined = resolvePendingOwnerDecision(queued.state, {
      decisionId,
      status: "declined",
      decisionSource: "owner",
    });
    expect(declined.state.user.pendingOwnerDecisions).toHaveLength(0);
    expect(declined.resolved?.expiresOn).toBeDefined();

    const again = enqueueTradeOfferForOwner(
      declined.state,
      built.offeringTeamId,
      built.proposal,
    );
    expect(again.outcome).toBe("skipped");
    expect(again.reason).toBe("fingerprint_cooldown");
  });

  it("rejects low-value packages as not interrupt-worthy", () => {
    let state = createTestGameState({ saveId: "od_quality" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const userTeamId = state.user.activeOwnerTeamId;
    const offeringTeamId = otherTeamId(state);
    const userPlayer = state.world.teams[userTeamId]!.roster.at(-1)!;
    const cpuPlayer = state.world.teams[offeringTeamId]!.roster.at(-1)!;

    // Force both players to scrap-level overall so the package fails quality.
    state = boostPlayerOverall(state, cpuPlayer, 45);
    state = boostPlayerOverall(state, userPlayer, 45);
    // boostPlayerOverall raises attrs; clamp them down instead.
    const weaken = (playerId: PlayerId): void => {
      const player = state.world.players[playerId]!;
      const attrs = { ...player.attributes };
      for (const key of Object.keys(attrs) as (keyof typeof attrs)[]) {
        attrs[key] = 40;
      }
      state = {
        ...state,
        world: {
          ...state.world,
          players: {
            ...state.world.players,
            [playerId]: { ...player, attributes: attrs },
          },
        },
      };
    };
    weaken(cpuPlayer);
    weaken(userPlayer);

    const proposal: TradeProposal = {
      sideA: {
        teamId: offeringTeamId,
        playerIds: [cpuPlayer],
        draftPickIds: [],
      },
      sideB: {
        teamId: userTeamId,
        playerIds: [userPlayer],
        draftPickIds: [],
      },
    };

    const cpuEval = evaluateTradeOffer(state, offeringTeamId, proposal);
    const worthy = isInterruptWorthyTradeOffer(state, userTeamId, proposal, {
      ...cpuEval,
      accepted: true,
      netValue: 1,
      incomingValue: 40,
      outgoingValue: 39,
      tradeBlockBonus: 0,
      objectiveNetValue: 1,
    });
    expect(worthy).toBe(false);
  });
});

describe("simulation pause on owner decision", () => {
  it("pauses after the day an offer is queued with explicit status", () => {
    let state = createTestGameState({ saveId: "od_pause" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;

    // Inject pending offer as if CPU queued mid-day, then advance more days.
    const queued = enqueueTradeOfferForOwner(
      state,
      built.offeringTeamId,
      built.proposal,
    );
    expect(queued.outcome).toBe("queued");

    const rng = createSeededRng(queued.state.meta.rngState);
    // Starting with an already-pending decision: advanceSimulation still runs
    // day 1 then pauses. For multi-day with pre-existing pending, day 1 completes
    // then stops — status paused.
    const result = advanceSimulation(queued.state, rng, { days: 7 });
    expect(result.status).toBe("paused");
    expect(result.stopReason).toBe("pending_owner_decision");
    expect(result.daysAdvanced).toBe(1);
    expect(hasActiveOwnerDecision(result.state.user)).toBe(true);
  });

  it("persists pending offer across save/load and blocks advanceOwnerTime", async () => {
    const store = createMemorySaveGameStore();
    let state = createTestGameState({ saveId: "od_persist" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;

    const queued = enqueueTradeOfferForOwner(
      state,
      built.offeringTeamId,
      built.proposal,
    );
    await store.create({
      id: "od_persist",
      name: "Persist Decision",
      state: queued.state,
    });

    const loaded = await store.load("od_persist");
    expect(loaded).not.toBeNull();
    expect(loaded!.state.user.pendingOwnerDecisions).toHaveLength(1);

    const advance = await advanceOwnerTime("od_persist", { days: 1 }, store);
    expect(advance.ok).toBe(false);
    if (!advance.ok) {
      expect(advance.error).toMatch(/owner decision is pending/i);
    }

    const dash = toOwnerDashboardView(loaded!.state);
    expect(dash.flags.pendingOwnerDecision).toBe(true);
    expect(dash.pendingTradeOffer?.decisionId).toBe(
      loaded!.state.user.pendingOwnerDecisions[0]!.id,
    );
  });
});

describe("owner decision commands", () => {
  async function seedPendingOffer(saveId: string) {
    const store = createMemorySaveGameStore();
    let state = createTestGameState({ saveId });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;
    const queued = enqueueTradeOfferForOwner(
      state,
      built.offeringTeamId,
      built.proposal,
    );
    expect(queued.outcome).toBe("queued");
    await store.create({
      id: saveId,
      name: saveId,
      state: queued.state,
    });
    return {
      store,
      decisionId: queued.decision!.id,
      proposal: built.proposal,
      offeringTeamId: built.offeringTeamId,
    };
  }

  it("accepts a pending trade and clears the queue", async () => {
    const { store, decisionId, proposal } = await seedPendingOffer("od_accept");
    const before = await store.load("od_accept");
    const userPlayer = proposal.sideB.playerIds[0]!;
    expect(
      before!.state.world.teams[before!.state.user.activeOwnerTeamId]!.roster,
    ).toContain(userPlayer);

    const result = await acceptOwnerDecision("od_accept", decisionId, store);
    expect(result.ok).toBe(true);
    const after = await store.load("od_accept");
    expect(after!.state.user.pendingOwnerDecisions).toHaveLength(0);
    expect(after!.state.user.ownerDecisionHistory[0]?.status).toBe("accepted");
    expect(
      after!.state.world.teams[after!.state.user.activeOwnerTeamId]!.roster,
    ).not.toContain(userPlayer);

    // Idempotent second accept
    const again = await acceptOwnerDecision("od_accept", decisionId, store);
    expect(again.ok).toBe(true);
  });

  it("declines a pending trade with cooldown fingerprint", async () => {
    const { store, decisionId, proposal, offeringTeamId } =
      await seedPendingOffer("od_decline");
    const result = await declineOwnerDecision("od_decline", decisionId, store);
    expect(result.ok).toBe(true);
    const after = await store.load("od_decline");
    expect(after!.state.user.pendingOwnerDecisions).toHaveLength(0);
    expect(after!.state.user.ownerDecisionHistory[0]?.status).toBe("declined");
    expect(after!.state.user.ownerDecisionHistory[0]?.expiresOn).toBeDefined();

    const fingerprint = tradeOfferFingerprint(
      offeringTeamId,
      after!.state.user.activeOwnerTeamId,
      proposal,
    );
    expect(after!.state.user.ownerDecisionHistory[0]?.fingerprint).toBe(
      fingerprint,
    );

    const again = await declineOwnerDecision("od_decline", decisionId, store);
    expect(again.ok).toBe(true);
  });

  it("Ask AI uses evaluateTradeOffer and records owner_ai source", async () => {
    const { store, decisionId } = await seedPendingOffer("od_ask_ai");
    const result = await delegateOwnerDecisionToAi(
      "od_ask_ai",
      decisionId,
      store,
    );
    expect(result.ok).toBe(true);
    const after = await store.load("od_ask_ai");
    expect(after!.state.user.pendingOwnerDecisions).toHaveLength(0);
    expect(after!.state.user.ownerDecisionHistory[0]?.decisionSource).toBe(
      "owner_ai",
    );
    expect(["delegated", "declined"]).toContain(
      after!.state.user.ownerDecisionHistory[0]?.status,
    );
  });

  it("resumes simulation after resolving a pending offer", async () => {
    const { store, decisionId } = await seedPendingOffer("od_resume");
    const declined = await declineOwnerDecision(
      "od_resume",
      decisionId,
      store,
    );
    expect(declined.ok).toBe(true);

    const advance = await advanceOwnerTime("od_resume", { days: 1 }, store);
    expect(advance.ok).toBe(true);
    if (advance.ok) {
      expect(advance.simulation.daysAdvanced).toBe(1);
    }
  });
});

describe("interrupt-worthy with meaningful player", () => {
  it("accepts high overall incoming player as interrupt-worthy", () => {
    let state = createTestGameState({ saveId: "od_worthy" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    state = built.state;
    const cpuPlayer = built.proposal.sideA.playerIds[0]!;
    const overall = calculatePlayerOverall(
      state.world.players[cpuPlayer]!.position,
      state.world.players[cpuPlayer]!.attributes,
    );
    expect(overall).toBeGreaterThanOrEqual(68);

    const evalResult = {
      accepted: true,
      netValue: 20,
      incomingValue: overall,
      outgoingValue: overall - 5,
      tradeBlockBonus: 0,
      objectiveNetValue: 20,
    };
    expect(
      isInterruptWorthyTradeOffer(
        state,
        state.user.activeOwnerTeamId,
        built.proposal,
        evalResult,
      ),
    ).toBe(true);
  });
});

describe("fingerprint stability", () => {
  it("produces the same fingerprint regardless of side order", () => {
    let state = createTestGameState({ saveId: "od_fp" });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const built = meaningfulPlayerSwapProposal(state);
    const fp1 = tradeOfferFingerprint(
      built.offeringTeamId,
      built.state.user.activeOwnerTeamId,
      built.proposal,
    );
    const flipped: TradeProposal = {
      sideA: built.proposal.sideB,
      sideB: built.proposal.sideA,
    };
    const fp2 = tradeOfferFingerprint(
      built.offeringTeamId,
      built.state.user.activeOwnerTeamId,
      flipped,
    );
    expect(fp1).toBe(fp2);
  });
});

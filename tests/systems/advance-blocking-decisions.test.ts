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

import { advanceOwnerTime } from "@/application/game-service";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  type PendingOwnerDecision,
  buildTradeOfferPayload,
} from "@/domain/entities/owner-decision";
import { createSeededRng } from "@/domain/rng";
import { asOwnerDecisionId, asTeamId } from "@/domain/ids";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  withActiveOwnerTeam,
  withAddedOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";

function stubBlockingDecision(
  primaryTeamId: ReturnType<typeof asTeamId>,
  participantTeamIds: ReturnType<typeof asTeamId>[],
  blockingLevel: "blocking" | "non_blocking",
): PendingOwnerDecision {
  const offeringTeamId =
    participantTeamIds.find((id) => id !== primaryTeamId) ?? primaryTeamId;
  const proposal = {
    sideA: { teamId: offeringTeamId, playerIds: [] as never[], draftPickIds: [] as never[] },
    sideB: { teamId: primaryTeamId, playerIds: [] as never[], draftPickIds: [] as never[] },
  };
  return {
    id: asOwnerDecisionId(`od_blocking_${primaryTeamId}_${blockingLevel}`),
    type: "trade_offer",
    createdOn: "2026-10-01",
    blockingLevel,
    primaryTeamId,
    participantTeamIds,
    payload: buildTradeOfferPayload({
      offeringTeamId,
      userTeamId: primaryTeamId,
      proposal,
      fingerprint: `${offeringTeamId}|${primaryTeamId}|stub|`,
      createdOn: "2026-10-01",
    }),
  };
}

function multiOwnedState() {
  let state = createInitialGameState({
    saveId: "save_blocking_decisions",
    rngSeed: 17,
    nowIso: "2026-08-13T12:00:00.000Z",
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  const teamIds = Object.keys(state.world.teams).sort();
  const primary = asTeamId(teamIds[0]!);
  const secondary = asTeamId(teamIds[1]!);
  state = withAddedOwnedFranchise(
    state,
    secondary,
    createDefaultOwnedFranchiseState({
      seasonYear: state.competition.season.year,
      currentDate: state.world.calendar.currentDate,
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
    }),
  );
  return { state, primary, secondary };
}

describe("advance blocking decisions", () => {
  it("pauses advanceSimulation when a blocking decision is pending", () => {
    const { state, primary, secondary } = multiOwnedState();
    const decision = stubBlockingDecision(primary, [primary, secondary], "blocking");
    const withDecision = {
      ...state,
      user: {
        ...state.user,
        pendingOwnerDecisions: [decision],
      },
    };

    const result = advanceSimulation(
      withDecision,
      createSeededRng(withDecision.meta.rngState),
      { days: 5 },
    );
    expect(result.status).toBe("paused");
    expect(result.stopReason).toBe("pending_owner_decision");
    expect(result.daysAdvanced).toBe(1);
    expect(result.state.user.pendingOwnerDecisions).toHaveLength(1);
  });

  it("does not pause advanceSimulation for non-blocking decisions", () => {
    const { state, primary, secondary } = multiOwnedState();
    const decision = stubBlockingDecision(primary, [primary, secondary], "non_blocking");
    const withDecision = {
      ...state,
      user: {
        ...state.user,
        pendingOwnerDecisions: [decision],
      },
    };

    const result = advanceSimulation(
      withDecision,
      createSeededRng(withDecision.meta.rngState),
      { days: 3 },
    );
    expect(result.stopReason).not.toBe("pending_owner_decision");
    expect(result.daysAdvanced).toBe(3);
  });

  it("advanceOwnerTime fails with non-active team name when blocking decision targets another owned franchise", async () => {
    const store = createMemorySaveGameStore();
    const { state, primary, secondary } = multiOwnedState();
    const secondaryTeam = state.world.teams[secondary]!;
    const decision = stubBlockingDecision(secondary, [secondary, primary], "blocking");
    const withDecision = withActiveOwnerTeam(
      {
        ...state,
        user: {
          ...state.user,
          pendingOwnerDecisions: [decision],
        },
      },
      primary,
    );

    await store.create({
      id: "blocking_non_active",
      name: "Blocking Non Active",
      state: withDecision,
    });

    const result = await advanceOwnerTime("blocking_non_active", { days: 1 }, store);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain(`${secondaryTeam.city} ${secondaryTeam.name}`);
    expect(result.error).toMatch(/resolve the pending owner decision/i);
    expect(result.error).toMatch(/switch to/i);
  });
});

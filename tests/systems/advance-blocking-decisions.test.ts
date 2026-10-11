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
import { applyPreset } from "@/domain/ai-management-presets";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  createDraftOrderSlot,
  createEmptyDraftClass,
  draftClassIdFor,
} from "@/domain/entities/draft";
import {
  type PendingOwnerDecision,
  buildTradeOfferPayload,
} from "@/domain/entities/owner-decision";
import { createSeededRng } from "@/domain/rng";
import { asDraftPickId, asOwnerDecisionId, asTeamId } from "@/domain/ids";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import {
  withActiveOwnerTeam,
  withAddedOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";
import { draftYearForSeason } from "@/systems/draft";
import { setActivePhase } from "@/systems/phase-engine";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { remainingSimulateTarget } from "@/components/calendar/calendar-resume-target";

function stubBlockingDecision(
  primaryTeamId: ReturnType<typeof asTeamId>,
  participantTeamIds: ReturnType<typeof asTeamId>[],
  blockingLevel: "blocking" | "non_blocking",
): PendingOwnerDecision {
  const offeringTeamId =
    participantTeamIds.find((id) => id !== primaryTeamId) ?? primaryTeamId;
  const proposal = {
    sideA: {
      teamId: offeringTeamId,
      playerIds: [] as never[],
      draftPickIds: [] as never[],
    },
    sideB: {
      teamId: primaryTeamId,
      playerIds: [] as never[],
      draftPickIds: [] as never[],
    },
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
    const decision = stubBlockingDecision(
      primary,
      [primary, secondary],
      "blocking",
    );
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
    const decision = stubBlockingDecision(
      primary,
      [primary, secondary],
      "non_blocking",
    );
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
    const decision = stubBlockingDecision(
      secondary,
      [secondary, primary],
      "blocking",
    );
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

    const result = await advanceOwnerTime(
      "blocking_non_active",
      { days: 1 },
      store,
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain(
      `${secondaryTeam.city} ${secondaryTeam.name}`,
    );
    expect(result.error).toMatch(/resolve the pending owner decision/i);
    expect(result.error).toMatch(/switch to/i);
  });
});

function withOwnedTeamOnDraftClock(
  state: ReturnType<typeof multiOwnedState>["state"],
  ownerTeamId: ReturnType<typeof asTeamId>,
  draftSelection: "off" | "full",
) {
  let next = setActivePhase(state, "offseason.draft");
  const draftYear = draftYearForSeason(next.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = {
    ...createEmptyDraftClass({ id: draftClassId, seasonYear: draftYear }),
    status: "active" as const,
    order: [
      createDraftOrderSlot({
        draftPickId: asDraftPickId("dp_clock_test"),
        overallPick: 7,
        round: 1,
        ownerTeamId,
        status: "available",
      }),
    ],
  };
  next = {
    ...next,
    world: {
      ...next.world,
      drafts: { ...next.world.drafts, [draftClassId]: draft },
    },
  };
  const preset = draftSelection === "full" ? "full_management" : "off";
  return withOwnedFranchise(next, ownerTeamId, (franchise) => ({
    ...franchise,
    managementPreset: preset,
    aiAssistance: {
      ...applyPreset(preset),
      draftSelection,
    },
  }));
}

describe("advance draft clock stop", () => {
  it("does not simulate a day already on the clock without assist", () => {
    const { state, primary } = multiOwnedState();
    const onClock = withOwnedTeamOnDraftClock(state, primary, "off");
    const currentDate = onClock.world.calendar.currentDate;

    const result = advanceSimulation(
      onClock,
      createSeededRng(onClock.meta.rngState),
      { days: 5 },
    );
    expect(result.status).toBe("paused");
    expect(result.stopReason).toBe("draft_clock");
    expect(result.daysAdvanced).toBe(0);
    expect(result.state.world.calendar.currentDate).toBe(currentDate);
  });

  it("does not stop for draft clock when pick assist can execute", () => {
    const { state, primary } = multiOwnedState();
    const onClock = withOwnedTeamOnDraftClock(state, primary, "full");

    const result = advanceSimulation(
      onClock,
      createSeededRng(onClock.meta.rngState),
      { days: 2 },
    );
    expect(result.stopReason).not.toBe("draft_clock");
  });

  it("prefers a blocking trade over draft clock when both are active", () => {
    const { state, primary, secondary } = multiOwnedState();
    const onClock = withOwnedTeamOnDraftClock(state, primary, "off");
    const decision = stubBlockingDecision(
      primary,
      [primary, secondary],
      "blocking",
    );
    const both = {
      ...onClock,
      user: {
        ...onClock.user,
        pendingOwnerDecisions: [decision],
      },
    };

    const result = advanceSimulation(
      both,
      createSeededRng(both.meta.rngState),
      { days: 5 },
    );
    expect(result.stopReason).toBe("pending_owner_decision");
    expect(result.daysAdvanced).toBe(1);
  });
});

describe("remainingSimulateTarget interrupt stops", () => {
  it("keeps the leftover target for draft_clock", () => {
    expect(
      remainingSimulateTarget({
        requestedTargetDate: "2026-10-15",
        currentDate: "2026-10-03",
        stopReason: "draft_clock",
      }),
    ).toBe("2026-10-15");
  });

  it("does not clear the leftover while an interrupt is still short of the target", () => {
    expect(
      remainingSimulateTarget({
        requestedTargetDate: "2026-10-15",
        currentDate: "2026-10-14",
        stopReason: "pending_owner_decision",
      }),
    ).toBe("2026-10-15");
  });
});

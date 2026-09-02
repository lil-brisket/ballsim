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
import { bootstrapWorld } from "@/systems/world-pipeline";
import { addCalendarDays } from "@/domain/calendar-date";

function stubBlockingDecision(
  primaryTeamId: ReturnType<typeof asTeamId>,
  offeringTeamId: ReturnType<typeof asTeamId>,
): PendingOwnerDecision {
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
    id: asOwnerDecisionId("od_sim_block"),
    type: "trade_offer",
    createdOn: "2026-10-01",
    blockingLevel: "blocking",
    primaryTeamId,
    participantTeamIds: [primaryTeamId, offeringTeamId],
    payload: buildTradeOfferPayload({
      offeringTeamId,
      userTeamId: primaryTeamId,
      proposal,
      fingerprint: `${offeringTeamId}|${primaryTeamId}|block|`,
      createdOn: "2026-10-01",
    }),
  };
}

describe("simulate blocking decision pause", () => {
  it("stops time advance and does not skip past a mandatory owner decision", async () => {
    const store = createMemorySaveGameStore();
    let state = createInitialGameState({
      saveId: "sim_block",
      rngSeed: 19,
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams).sort();
    const primary = asTeamId(teamIds[0]!);
    const offering = asTeamId(teamIds[1]!);
    const startDate = state.world.calendar.currentDate;
    const withDecision = {
      ...state,
      user: {
        ...state.user,
        pendingOwnerDecisions: [stubBlockingDecision(primary, offering)],
      },
    };
    await store.create({
      id: "sim_block",
      name: "Sim Block",
      state: withDecision,
    });

    const target = addCalendarDays(startDate, 14);
    const result = await advanceOwnerTime(
      "sim_block",
      { targetDate: target },
      store,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/pending owner decision|attention/i);
    }
    const loaded = await store.load("sim_block");
    expect(loaded?.state.world.calendar.currentDate).toBe(startDate);
    expect(loaded?.state.user.pendingOwnerDecisions).toHaveLength(1);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import {
  type PendingOwnerDecision,
  buildTradeOfferPayload,
} from "@/domain/entities/owner-decision";
import { createSeededRng } from "@/domain/rng";
import { asOwnerDecisionId, asTeamId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { buildTradeReviewView } from "@/state/trade-review-view";

describe("buildTradeReviewView", () => {
  it("returns a JSON-serializable review", () => {
    let state = createInitialGameState({
      saveId: "save_review",
      rngSeed: 9,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams).sort();
    const userTeamId = asTeamId(teamIds[0]!);
    const offeringTeamId = asTeamId(teamIds[1]!);
    const proposal = {
      sideA: {
        teamId: offeringTeamId,
        playerIds: [] as never[],
        draftPickIds: [] as never[],
      },
      sideB: {
        teamId: userTeamId,
        playerIds: [] as never[],
        draftPickIds: [] as never[],
      },
    };
    const decision: PendingOwnerDecision = {
      id: asOwnerDecisionId("od_review"),
      type: "trade_offer",
      createdOn: "2026-10-01",
      blockingLevel: "blocking",
      primaryTeamId: userTeamId,
      participantTeamIds: [userTeamId, offeringTeamId],
      payload: buildTradeOfferPayload({
        offeringTeamId,
        userTeamId,
        proposal,
        fingerprint: "fp",
        createdOn: "2026-10-01",
        motivation: { type: "positional_need", targetPosition: "SF" },
      }),
    };
    state = {
      ...state,
      user: {
        ...state.user,
        activeOwnerTeamId: userTeamId,
        ownedTeamIds: [userTeamId],
        pendingOwnerDecisions: [decision],
      },
    };

    const review = buildTradeReviewView(state, "od_review");
    expect(review).not.toBeNull();
    const roundTripped = JSON.parse(JSON.stringify(review)) as typeof review;
    expect(roundTripped).toEqual(review);
    expect(roundTripped?.motivationLabel).toMatch(/SF/);
  });
});

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
import { TRADE_EVEN_BAND } from "@/systems/trades-config";
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

  it("describes player assets with card fields", () => {
    let state = createInitialGameState({
      saveId: "save_review_players",
      rngSeed: 9,
      nowIso: "2026-08-13T12:00:00.000Z",
      settings: CBL_GAME_SETTINGS,
    });
    state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
    const teamIds = Object.keys(state.world.teams).sort();
    const userTeamId = asTeamId(teamIds[0]!);
    const offeringTeamId = asTeamId(teamIds[1]!);
    const offered = state.world.teams[offeringTeamId]!.roster[0]!;
    const sent = state.world.teams[userTeamId]!.roster[0]!;
    const proposal = {
      sideA: {
        teamId: offeringTeamId,
        playerIds: [offered],
        draftPickIds: [] as never[],
      },
      sideB: {
        teamId: userTeamId,
        playerIds: [sent],
        draftPickIds: [] as never[],
      },
    };
    const decision: PendingOwnerDecision = {
      id: asOwnerDecisionId("od_players"),
      type: "trade_offer",
      createdOn: "2026-10-01",
      blockingLevel: "blocking",
      primaryTeamId: userTeamId,
      participantTeamIds: [userTeamId, offeringTeamId],
      payload: buildTradeOfferPayload({
        offeringTeamId,
        userTeamId,
        proposal,
        fingerprint: "fp2",
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

    const review = buildTradeReviewView(state, "od_players")!;
    const asset = review.youReceive[0]!;
    const player = state.world.players[offered]!;
    expect(asset.playerId).toBe(offered);
    expect(asset.firstName).toBe(player.firstName);
    expect(asset.lastName).toBe(player.lastName);
    expect(asset.position).toBe(player.position);
    expect(asset.age).toBe(player.age);
    expect(typeof asset.overall).toBe("number");
    expect(asset.salary === null || typeof asset.salary === "number").toBe(
      true,
    );
    expect(asset.portrait === null || typeof asset.portrait).toBeTruthy();
    expect(asset.href).toContain(`/players/${offered}`);
    expect(asset.detail).toContain(player.position);
    expect(JSON.parse(JSON.stringify(review))).toEqual(review);
    expect(review.evenBand).toBe(TRADE_EVEN_BAND);
    expect(review.offeringTeamBranding?.primaryColor).toBe(
      state.world.teams[offeringTeamId]!.branding.primaryColor,
    );
    expect(review.receivingTeamBranding?.primaryColor).toBe(
      state.world.teams[userTeamId]!.branding.primaryColor,
    );
  });
});

import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  getExpectedPhaseWindow,
  resolvePhaseResolution,
  resolveSeasonAnchors,
} from "@/systems/league-rules/league-calendar";
import { asOwnerDecisionId } from "@/domain/ids";
import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";

function bootState(): GameState {
  const state = createInitialGameState({
    saveId: "league_cal",
    rngSeed: 4,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
}

function withDraftHold(state: GameState, date: string): GameState {
  const drafts: GameState["world"]["drafts"] = {};
  for (const [id, draft] of Object.entries(state.world.drafts)) {
    drafts[id] = { ...draft, status: "active" };
  }
  return {
    ...state,
    world: {
      ...state.world,
      calendar: {
        ...state.world.calendar,
        currentDate: date,
      },
      drafts,
    },
    competition: {
      ...state.competition,
      phase: {
        activePhaseId: "offseason.draft" as LeaguePhaseId,
        enteredDate: "2026-07-01",
      },
      season: {
        ...state.competition.season,
        phase: "offseason",
        offseasonStage: "draft",
        offseasonStageEnteredDate: "2026-07-01",
      },
    },
  };
}

describe("league-calendar phase resolution", () => {
  it("separates expected windows from actual phase resolution", () => {
    const state = bootState();
    const date = state.world.calendar.currentDate;
    const resolution = resolvePhaseResolution(state, date);
    const anchors = resolveSeasonAnchors(state);
    expect(resolution.phaseId).toBeTruthy();
    expect(resolution.reason).toBeTruthy();
    expect(typeof anchors.regularSeasonStart === "string" || anchors.regularSeasonStart === null).toBe(
      true,
    );
    const window = getExpectedPhaseWindow(state, resolution.phaseId);
    expect(window === null || typeof window.start === "string").toBe(true);
  });

  it("holds draft when the date is past the expected window but the draft is incomplete", () => {
    const state = withDraftHold(bootState(), "2026-10-20");
    const resolution = resolvePhaseResolution(state, "2026-10-20");
    expect(resolution.phaseId).toBe("offseason.draft");
    expect(resolution.reason).toBe("event_incomplete");
    expect(resolution.blockedBy).toBe("draft_incomplete");
  });

  it("holds on blocking owner decisions instead of date-derived phase", () => {
    const base = withDraftHold(bootState(), "2026-10-20");
    const teamId = base.user.activeOwnerTeamId;
    const state: GameState = {
      ...base,
      user: {
        ...base.user,
        pendingOwnerDecisions: [
          {
            id: asOwnerDecisionId("od_hold"),
            type: "trade_offer",
            createdOn: "2026-10-20",
            blockingLevel: "blocking",
            primaryTeamId: teamId,
            participantTeamIds: [teamId],
            payload: {
              offeringTeamId: teamId,
              userTeamId: teamId,
              proposal: {
                sideA: { teamId, playerIds: [], draftPickIds: [] },
                sideB: { teamId, playerIds: [], draftPickIds: [] },
              },
              originalProposal: {
                sideA: { teamId, playerIds: [], draftPickIds: [] },
                sideB: { teamId, playerIds: [], draftPickIds: [] },
              },
              currentProposal: {
                sideA: { teamId, playerIds: [], draftPickIds: [] },
                sideB: { teamId, playerIds: [], draftPickIds: [] },
              },
              negotiationHistory: [],
              status: "pending",
              fingerprint: "hold",
              createdOn: "2026-10-20",
            },
          },
        ],
      },
    };
    const resolution = resolvePhaseResolution(state, "2026-10-20");
    expect(resolution.reason).toBe("blocking_decision");
    expect(resolution.blockedBy).toBe("owner_decision");
    expect(resolution.phaseId).toBe("offseason.draft");
  });
});

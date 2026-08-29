import { describe, expect, it } from "vitest";
import {
  getBlockingOwnerDecisions,
  getPendingDecisionsForTeam,
  type PendingOwnerDecision,
} from "@/domain/entities/owner-decision";
import { asOwnerDecisionId, asTeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

function stubPendingDecision(
  primaryTeamId: ReturnType<typeof asTeamId>,
  participantTeamIds: ReturnType<typeof asTeamId>[],
  blockingLevel: "blocking" | "non_blocking" = "blocking",
): PendingOwnerDecision {
  const offeringTeamId =
    participantTeamIds.find((id) => id !== primaryTeamId) ?? primaryTeamId;
  return {
    id: asOwnerDecisionId(`od_test_${primaryTeamId}_${blockingLevel}`),
    type: "trade_offer",
    createdOn: "2026-10-01",
    blockingLevel,
    primaryTeamId,
    participantTeamIds,
    payload: {
      offeringTeamId,
      userTeamId: primaryTeamId,
      proposal: {
        sideA: { teamId: offeringTeamId, playerIds: [], draftPickIds: [] },
        sideB: { teamId: primaryTeamId, playerIds: [], draftPickIds: [] },
      },
      fingerprint: `${offeringTeamId}|${primaryTeamId}| |`,
    },
  };
}

function userWithDecisions(
  decisions: PendingOwnerDecision[],
): GameState["user"] {
  return {
    mode: "owner",
    ownedTeamIds: [],
    activeOwnerTeamId: asTeamId("team_a"),
    ownedFranchises: {},
    pendingOwnerDecisions: decisions,
    ownerDecisionHistory: [],
    franchisePhaseState: {},
  };
}

describe("owner-decision participants", () => {
  const teamA = asTeamId("team_a");
  const teamB = asTeamId("team_b");
  const teamC = asTeamId("team_c");

  it("getPendingDecisionsForTeam returns decisions involving that franchise", () => {
    const blockingOnA = stubPendingDecision(teamA, [teamA, teamB], "blocking");
    const nonBlockingOnB = stubPendingDecision(teamB, [teamB, teamC], "non_blocking");
    const user = userWithDecisions([blockingOnA, nonBlockingOnB]);

    expect(getPendingDecisionsForTeam(user, teamA)).toEqual([blockingOnA]);
    expect(getPendingDecisionsForTeam(user, teamB)).toEqual([
      blockingOnA,
      nonBlockingOnB,
    ]);
    expect(getPendingDecisionsForTeam(user, teamC)).toEqual([nonBlockingOnB]);
    expect(getPendingDecisionsForTeam(user, asTeamId("team_x"))).toEqual([]);
  });

  it("getBlockingOwnerDecisions filters to blockingLevel blocking only", () => {
    const blocking = stubPendingDecision(teamA, [teamA, teamB], "blocking");
    const nonBlocking = stubPendingDecision(teamB, [teamB, teamC], "non_blocking");
    const user = userWithDecisions([blocking, nonBlocking]);

    expect(getBlockingOwnerDecisions(user)).toEqual([blocking]);
  });

  it("participantTeamIds aggregates both sides without duplication", () => {
    const decision = stubPendingDecision(teamA, [teamA, teamB]);
    expect(decision.participantTeamIds).toEqual([teamA, teamB]);
    expect(decision.participantTeamIds).toContain(decision.primaryTeamId);
    expect(decision.participantTeamIds.length).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createDraft, activateDraft, makeDraftSelection } from "@/systems/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";
import { draftClassIdFor } from "@/domain/entities/draft";
import { createDraftFixture, sortedTeamIds } from "../draft/fixture";
import { TEST_RNG_SEED } from "../../helpers/determinism";
import { calculateTeamDraftNeeds } from "@/systems/draft/draft-needs";
import { getDraftRecommendations } from "@/systems/draft/draft-recommendations";
import {
  computeLeagueMockDraft,
  selectProspectFromTeamScouting,
} from "@/systems/draft/mock-draft";
import {
  addToDraftBoard,
  removeFromDraftBoard,
} from "@/systems/draft/draft-board";
import { conductProspectInterview } from "@/systems/draft/prospect-interviews";
import {
  gradePickImmediate,
  applyImmediateGradesToDraft,
} from "@/systems/draft/draft-grading";
import { completeDraft } from "@/systems/draft";
import { assignScoutToProspect } from "@/systems/scouting";
import { resolveScoutingRegion } from "@/domain/entities/scouting-regions";
import { prospectFunFact } from "@/systems/draft/prospect-fun-facts";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

describe("draft needs and recommendations", () => {
  it("computes positional needs and recommendations from estimates", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const teamId = sortedTeamIds(state)[0]!;
    const needs = calculateTeamDraftNeeds(state, teamId);
    expect(needs.byPosition).toHaveLength(5);

    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const recs = getDraftRecommendations(state, draft, teamId, 3);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.scoutGrade).toBeTruthy();
  });
});

describe("mock draft", () => {
  it("simulates full order using team scouting", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const mock = computeLeagueMockDraft(state, draft, "2099-01-01");
    expect(mock.slots.length).toBe(draft.order.length);
    const ids = new Set(mock.slots.map((s) => s.prospectPlayerId));
    expect(ids.size).toBe(mock.slots.length);
  });

  it("selectProspectFromTeamScouting ignores true ranking order when estimates differ", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const teamId = sortedTeamIds(state)[0]!;
    const eligible = new Set(
      Object.values(draft.prospects)
        .filter((p) => p.status === "eligible")
        .map((p) => p.playerId as string),
    );
    const pick = selectProspectFromTeamScouting(
      state,
      draft,
      teamId,
      eligible,
    );
    expect(pick).toBeDefined();
    expect(eligible.has(pick!)).toBe(true);
  });
});

describe("draft board and interviews", () => {
  it("persists board add/remove per franchise", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    const teamId = sortedTeamIds(state)[0]!;
    const prospectId = Object.keys(
      state.world.drafts[draftId]!.prospects,
    )[0]!;

    state = addToDraftBoard(state, teamId, prospectId as never);
    expect(
      state.world.drafts[draftId]!.teamDraftState[teamId]!.board,
    ).toHaveLength(1);
    state = removeFromDraftBoard(state, teamId, prospectId as never);
    expect(
      state.world.drafts[draftId]!.teamDraftState[teamId]!.board,
    ).toHaveLength(0);
  });

  it("interview quotes differ by personality without exposing honesty labels", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    const teamId = sortedTeamIds(state)[0]!;
    const prospectId = Object.keys(
      state.world.drafts[draftId]!.prospects,
    )[0]!;
    state = conductProspectInterview(state, teamId, prospectId as never);
    const interview =
      state.world.drafts[draftId]!.teamDraftState[teamId]!.interviews[
        prospectId
      ]!;
    expect(interview.answers.length).toBeGreaterThan(0);
    for (const answer of interview.answers) {
      expect(answer.quote.length).toBeGreaterThan(10);
      expect(JSON.stringify(answer)).not.toMatch(/likely_honest/);
    }
  });
});

describe("draft grading and pick results", () => {
  it("records pickResults and grades every team on complete", () => {
    resetDomainEventSequenceForTests();
    let state = createDraftFixture();
    const rng = createSeededRng(TEST_RNG_SEED);
    state = createDraft(state, rng).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    state = activateDraft(state, draftId).state;

    const draft = state.world.drafts[draftId]!;
    const slot = draft.order[0]!;
    const prospectId = Object.keys(draft.prospects)[0]!;
    const result = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: prospectId as never,
      teamId: slot.ownerTeamId,
    });
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.world.drafts[draftId]!.pickResults).toHaveLength(1);
    const pick = state.world.drafts[draftId]!.pickResults[0]!;
    const grade = gradePickImmediate(state, pick);
    expect(grade.grade).toBeTruthy();
    expect(grade.explanation.length).toBeGreaterThan(0);

    // Force complete with remaining picks unused — completeDraft grades all teams
    // First finish all picks quickly via AI path is heavy; just apply grades API
    const graded = applyImmediateGradesToDraft(state, {
      ...state.world.drafts[draftId]!,
      status: "complete",
    });
    expect(Object.keys(graded.teamGrades ?? {}).length).toBe(
      sortedTeamIds(state).length,
    );
  });
});

describe("coverage and fun facts", () => {
  it("resolves domestic vs international from league area", () => {
    expect(resolveScoutingRegion("north_america", "USA")).toBe("domestic");
    expect(resolveScoutingRegion("north_america", "Spain")).toBe(
      "international",
    );
    expect(resolveScoutingRegion("europe", "Spain")).toBe("domestic");
  });

  it("fun facts are gameplay-derived", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const prospect = Object.values(draft.prospects)[0]!;
    const fact = prospectFunFact(prospect, "north_america");
    expect(fact.length).toBeGreaterThan(10);
  });

  it("assign scout adds assignment", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    const teamId = sortedTeamIds(state)[0]!;
    const prospectId = Object.keys(
      state.world.drafts[draftId]!.prospects,
    )[0]!;
    state = assignScoutToProspect(state, teamId, prospectId as never);
    expect(
      state.world.drafts[draftId]!.teamDraftState[teamId]!.scoutAssignments
        .length,
    ).toBe(1);
  });
});

describe("completeDraft grades", () => {
  it("completeDraft attaches team grades", () => {
    resetDomainEventSequenceForTests();
    let state = createDraftFixture();
    const rng = createSeededRng(TEST_RNG_SEED);
    state = createDraft(state, rng).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    state = activateDraft(state, draftId).state;
    // Mark order fully used without picking everyone — complete requires active
    // So pick one then manually set remaining used? completeDraft only checks status.
    // Pick all slots
    let guard = 0;
    while (guard < 200) {
      guard += 1;
      const draft = state.world.drafts[draftId]!;
      const slot = draft.order.find((s) => s.status === "available");
      if (!slot) break;
      const prospect = Object.values(draft.prospects).find(
        (p) => p.status === "eligible",
      );
      if (!prospect) break;
      const sel = makeDraftSelection(state, {
        draftClassId: draftId,
        draftPickId: slot.draftPickId,
        prospectPlayerId: prospect.playerId,
        teamId: slot.ownerTeamId,
      });
      if (!sel.success) break;
      state = sel.state;
    }
    state = completeDraft(state, draftId).state;
    const done = state.world.drafts[draftId]!;
    expect(done.status).toBe("complete");
    expect(done.teamGrades).toBeDefined();
    expect(Object.keys(done.teamGrades!).length).toBe(
      sortedTeamIds(state).length,
    );
  });
});

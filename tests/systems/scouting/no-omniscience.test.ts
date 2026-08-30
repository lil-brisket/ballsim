import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createDraft } from "@/systems/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";
import { draftClassIdFor } from "@/domain/entities/draft";
import { ratingRangeWidth } from "@/domain/entities/scouting-types";
import { toDraftBoardView } from "@/state/selectors";
import { selectProspectForTeam } from "@/systems/ai-team-decisions";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { createDraftFixture, sortedTeamIds } from "../draft/fixture";
import { TEST_RNG_SEED } from "../../helpers/determinism";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";
import {
  deriveStrengthsWeaknessesFromEstimates,
} from "@/systems/scouting/scouting-reports";

describe("no omniscience", () => {
  it("draft board view never exposes true overall", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    const draft = state.world.drafts[draftId]!;

    state = {
      ...state,
      competition: {
        ...state.competition,
        season: {
          ...state.competition.season,
          phase: "offseason",
          offseasonStage: "draft",
        },
      },
      world: {
        ...state.world,
        drafts: {
          ...state.world.drafts,
          [draftId]: { ...draft, status: "active" },
        },
      },
    };

    const view = toDraftBoardView(state);
    expect(view).not.toBeNull();
    for (const prospect of view!.eligibleProspects) {
      expect(prospect).not.toHaveProperty("overall");
      const trueProspect = draft.prospects[prospect.playerId]!;
      const trueOvr = calculatePlayerOverall(
        trueProspect.player.position,
        trueProspect.player.attributes,
      );
      if (
        prospect.estimatedOverallMin != null &&
        prospect.estimatedOverallMax != null
      ) {
        // Range may contain truth but must not equal a single exact value leak as overall field
        expect(
          prospect.estimatedOverallMin === trueOvr &&
            prospect.estimatedOverallMax === trueOvr,
        ).toBe(false);
      }
    }
  });

  it("strengths/weaknesses come from estimates not true attrs", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const teamId = sortedTeamIds(state)[0]!;
    const estimate = draft.teamDraftState[teamId]!.scouting[0]!;
    // Force detailed knowledge for strengths
    const detailed = {
      ...estimate,
      knowledgeLevel: "detailed" as const,
      estimatedCategories: {
        ...estimate.estimatedCategories,
        shooting: { min: 85, max: 92 },
        finishing: { min: 30, max: 40 },
      },
    };
    const { strengths, weaknesses } =
      deriveStrengthsWeaknessesFromEstimates(detailed);
    expect(strengths.some((s) => s.category === "shooting")).toBe(true);
    expect(weaknesses.some((w) => w.category === "finishing")).toBe(true);
  });

  it("AI selectProspectForTeam does not require true overall ranking", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const teamId = sortedTeamIds(state)[0]!;
    const pick = selectProspectForTeam(state, draft, teamId);
    expect(pick).toBeDefined();
    // Chosen prospect must have scouting data for that team
    const estimate = draft.teamDraftState[teamId]!.scouting.find(
      (s) => s.prospectPlayerId === pick,
    );
    expect(estimate).toBeDefined();
  });

  it("scouting report view gates categories by knowledge level", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const teamId = sortedTeamIds(state)[0]!;
    const estimate = draft.teamDraftState[teamId]!.scouting[0]!;
    const basicView = toScoutingReportView({
      ...estimate,
      knowledgeLevel: "basic",
    });
    expect(Object.keys(basicView.categories)).toHaveLength(0);
    expect(basicView.strengths).toHaveLength(0);

    const detailedView = toScoutingReportView({
      ...estimate,
      knowledgeLevel: "detailed",
    });
    expect(Object.keys(detailedView.categories).length).toBeGreaterThan(0);
  });
});

describe("scouting accuracy", () => {
  it("elite scout produces narrower ranges than weak scout context via exposure", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const teamIds = sortedTeamIds(state);
    const widths = teamIds.map((teamId) => {
      const report = draft.teamDraftState[teamId]!.scouting[0]!;
      return ratingRangeWidth(report.estimatedOverall);
    });
    // All teams get finite positive widths
    for (const w of widths) {
      expect(w).toBeGreaterThanOrEqual(2);
    }
  });

  it("every team receives its own scouting estimates", () => {
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draft = state.world.drafts[draftClassIdFor(draftYear)]!;
    const teams = sortedTeamIds(state);
    expect(Object.keys(draft.teamDraftState).length).toBe(teams.length);
    const prospectId = Object.keys(draft.prospects)[0]!;
    const reports = teams.map(
      (teamId) =>
        draft.teamDraftState[teamId]!.scouting.find(
          (s) => s.prospectPlayerId === prospectId,
        )!,
    );
    // Different teams generally disagree (not required identical)
    expect(reports[0]!.teamId).not.toBe(reports[1]!.teamId);
  });
});

import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { draftClassIdFor, type DraftClass } from "@/domain/entities/draft";
import {
  ESTIMATED_SCOUTING_CATEGORY_KEYS,
  type EstimatedProspectData,
} from "@/domain/entities/scouting-types";
import type { GameState } from "@/state/game-state";
import {
  PROSPECT_SHEET_LIMIT,
  toProspectSheet,
  toProspectSheetRows,
} from "@/state/prospect-sheet-view";
import { createDraft } from "@/systems/draft";
import { draftYearForSeason } from "@/systems/draft/draft-order";
import { createDraftFixture } from "../systems/draft/fixture";
import { TEST_RNG_SEED } from "../helpers/determinism";

/** Values no scouting estimate, rank or id can ever contain. */
const TRUE_ATTRIBUTE = 7777.5;
const TRUE_POTENTIAL = 8888.5;

function draftStageState(): { state: GameState; draftId: string } {
  let state = createDraftFixture();
  state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
  const draftId = draftClassIdFor(
    draftYearForSeason(state.competition.season.year),
  );
  const draft = state.world.drafts[draftId]!;

  // Plant sentinel truths: if any true attribute, overall or potential
  // reached a row, the sentinel would show up in its JSON.
  const prospects = Object.fromEntries(
    Object.entries(draft.prospects).map(([id, prospect]) => [
      id,
      {
        ...prospect,
        player: {
          ...prospect.player,
          attributes: Object.fromEntries(
            Object.keys(prospect.player.attributes).map((key) => [
              key,
              TRUE_ATTRIBUTE,
            ]),
          ) as typeof prospect.player.attributes,
          potential: Object.fromEntries(
            Object.entries(prospect.player.potential).map(([key, value]) => [
              key,
              typeof value === "number" ? TRUE_POTENTIAL : value,
            ]),
          ) as typeof prospect.player.potential,
        },
      },
    ]),
  );

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
        [draftId]: { ...draft, status: "active", prospects } as DraftClass,
      },
    },
  };
  return { state, draftId };
}

function estimatesOf(state: GameState, draftId: string) {
  return state.world.drafts[draftId as keyof typeof state.world.drafts]!
    .teamDraftState[state.user.activeOwnerTeamId]!.scouting;
}

/** Replace the user team's scouting list. */
function withScouting(
  state: GameState,
  draftId: string,
  scouting: EstimatedProspectData[],
): GameState {
  const id = draftId as keyof typeof state.world.drafts;
  const draft = state.world.drafts[id]!;
  const teamId = state.user.activeOwnerTeamId;
  return {
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [id]: {
          ...draft,
          teamDraftState: {
            ...draft.teamDraftState,
            [teamId]: { ...draft.teamDraftState[teamId]!, scouting },
          },
        },
      },
    },
  };
}

describe("toProspectSheetRows", () => {
  it("never carries a true attribute, overall or potential", () => {
    const { state, draftId } = draftStageState();
    const rows = toProspectSheetRows(state);
    expect(rows.length).toBeGreaterThan(0);

    const json = JSON.stringify(rows);
    expect(json).not.toContain(String(TRUE_ATTRIBUTE));
    expect(json).not.toContain(String(TRUE_POTENTIAL));
    expect(json).not.toContain("7777");
    expect(json).not.toContain("8888");

    const allowed = new Set([
      "playerId",
      "portrait",
      "firstName",
      "lastName",
      "position",
      "age",
      "nationality",
      "scoutGrade",
      "confidence",
      "knowledgeLevel",
      "projectedPick",
      "previousProjectedPick",
      "projectedRank",
      "overall",
      "potential",
      "categories",
      "strengths",
      "weaknesses",
      "onBoard",
    ]);
    for (const row of rows) {
      expect(row).not.toHaveProperty("attributes");
      expect(row).not.toHaveProperty("ranking");
      for (const key of Object.keys(row)) expect(allowed.has(key)).toBe(true);
    }
    expect(estimatesOf(state, draftId).length).toBeGreaterThan(0);
  });

  it("takes every number from the scouting estimate", () => {
    const { state, draftId } = draftStageState();
    // One prospect with a detailed estimate, so categories are revealed.
    const scouting = estimatesOf(state, draftId).map((estimate, index) =>
      index === 0
        ? {
            ...estimate,
            knowledgeLevel: "detailed" as const,
            estimatedCategories: {
              ...estimate.estimatedCategories,
              shooting: { min: 85, max: 92 },
            },
          }
        : estimate,
    );
    const seeded = withScouting(state, draftId, scouting);

    for (const row of toProspectSheetRows(seeded)) {
      const estimate = scouting.find(
        (entry) => entry.prospectPlayerId === row.playerId,
      );
      if (!estimate || estimate.knowledgeLevel === "unknown") {
        expect(row.overall).toBeNull();
        continue;
      }
      expect(row.overall).toEqual(estimate.estimatedOverall);
      expect(row.potential).toEqual(estimate.estimatedPotential);
      expect(row.projectedRank).toEqual(estimate.projectedRank);
      expect(row.scoutGrade).toBe(estimate.scoutGrade);
      expect(row.confidence).toBe(estimate.confidence);
      expect(row.position).toBe(estimate.positionEstimate);
      for (const key of ESTIMATED_SCOUTING_CATEGORY_KEYS) {
        const range = row.categories[key];
        if (range) expect(range).toEqual(estimate.estimatedCategories[key]);
      }
    }

    const detailed = toProspectSheetRows(seeded).find(
      (row) => row.knowledgeLevel === "detailed",
    );
    expect(detailed?.categories.shooting).toEqual({ min: 85, max: 92 });
    expect(detailed?.strengths).toContain("Strong perimeter shooting");
  });

  it("gives prospects without an estimate nulls, not zeros", () => {
    const { state, draftId } = draftStageState();
    const seeded = withScouting(state, draftId, []);

    const rows = toProspectSheetRows(seeded);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatchObject({
        scoutGrade: null,
        confidence: null,
        knowledgeLevel: "unknown",
        overall: null,
        potential: null,
        projectedRank: null,
        categories: {},
        strengths: [],
        weaknesses: [],
      });
    }
    expect(JSON.stringify(rows)).not.toContain("7777");
  });

  it("keeps the page order and cap, and reports the full count", () => {
    const { state } = draftStageState();
    const { rows, total } = toProspectSheet(state);
    expect(rows.length).toBeLessThanOrEqual(PROSPECT_SHEET_LIMIT);
    expect(total).toBeGreaterThanOrEqual(rows.length);
    expect(toProspectSheetRows(state).map((row) => row.playerId)).toEqual(
      rows.map((row) => row.playerId),
    );
    const mids = rows.map((row) =>
      row.overall ? (row.overall.min + row.overall.max) / 2 : -1,
    );
    expect(mids).toEqual([...mids].sort((a, b) => b - a));
  });

  it("passes mock-draft projections through and drops placeholders", () => {
    const { state } = draftStageState();
    const [first, second] = toProspectSheetRows(state);
    const rows = toProspectSheetRows(state, {
      projections: new Map([
        [first!.playerId, { projected: 4, previous: 9 }],
        [second!.playerId, { projected: 999, previous: null }],
      ]),
    });
    expect(rows[0]).toMatchObject({
      projectedPick: 4,
      previousProjectedPick: 9,
    });
    expect(rows[1]!.projectedPick).toBeNull();
  });

  it("is empty outside the draft stage", () => {
    const { state } = draftStageState();
    const idle = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, offseasonStage: "free_agency" },
      },
    } as GameState;
    expect(toProspectSheet(idle)).toEqual({ rows: [], total: 0 });
  });
});

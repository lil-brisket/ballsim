/**
 * Rows for the draft "Prospect pool" scouting sheet. Read-only, nothing is
 * stored.
 *
 * FOG OF WAR: a row is built from the user team's scouting estimate
 * (draft.teamDraftState[team].scouting, gated by toScoutingReportView) and
 * public identity (name, age, nationality, portrait) only. The prospect's true
 * attributes, overall and potential are never read, so they cannot reach the
 * client. A prospect without an estimate has nulls and shows dashes.
 */

import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { draftClassIdFor } from "@/domain/entities/draft";
import type {
  EstimatedScoutingCategoryKey,
  RatingRange,
} from "@/domain/entities/scouting-types";
import type { GameState } from "@/state/game-state";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { toDraftBoardView } from "@/state/selectors/market";
import { draftYearForSeason } from "@/systems/draft";
import { toScoutingReportView } from "@/systems/scouting/scouting-reports";

/** The pool shows this many prospects (the page's long-standing cap). */
export const PROSPECT_SHEET_LIMIT = 24;

export type ProspectSheetCategories = Partial<
  Record<EstimatedScoutingCategoryKey, RatingRange>
>;

export type ProspectSheetRow = {
  playerId: string;
  portrait: PlayerPortraitAssignment | null;
  firstName: string;
  lastName: string;
  /** The scouted position estimate when there is one, else the listed one. */
  position: string;
  age: number | null;
  nationality: string | null;
  /** The scouting letter (A+ to F), not the roster rating grade. */
  scoutGrade: string | null;
  confidence: string | null;
  knowledgeLevel: string;
  /** Mock-draft projection (overall pick), when the mock draft has one. */
  projectedPick: number | null;
  previousProjectedPick: number | null;
  /** Scouts' projected rank range. */
  projectedRank: RatingRange | null;
  overall: RatingRange | null;
  potential: RatingRange | null;
  /** Only the categories the knowledge level reveals. */
  categories: ProspectSheetCategories;
  strengths: string[];
  weaknesses: string[];
  onBoard: boolean;
};

export type ProspectProjection = {
  projected: number;
  previous: number | null;
};

export type ProspectSheetOptions = {
  /** Mock-draft projections by prospect id (the page already computes them). */
  projections?: ReadonlyMap<string, ProspectProjection>;
};

export type ProspectSheetData = {
  rows: ProspectSheetRow[];
  /** All eligible prospects, for the "Showing N of M" footnote. */
  total: number;
};

function copyRange(range: RatingRange | null): RatingRange | null {
  return range ? { min: range.min, max: range.max } : null;
}

export function toProspectSheet(
  state: GameState,
  options: ProspectSheetOptions = {},
): ProspectSheetData {
  const board = toDraftBoardView(state);
  if (!board) return { rows: [], total: 0 };

  const draft =
    state.world.drafts[
      draftClassIdFor(draftYearForSeason(state.competition.season.year))
    ];
  const teamState = draft?.teamDraftState[state.user.activeOwnerTeamId];
  const onBoard = new Set<string>(
    (teamState?.board ?? []).map((entry) => entry.prospectPlayerId),
  );

  const rows = board.eligibleProspects
    .slice(0, PROSPECT_SHEET_LIMIT)
    .map((prospect): ProspectSheetRow => {
      const identity = draft?.prospects[prospect.playerId]?.player;
      const estimate = teamState?.scouting.find(
        (entry) => entry.prospectPlayerId === prospect.playerId,
      );
      const report = toScoutingReportView(estimate);
      const projection = options.projections?.get(prospect.playerId);
      const projected =
        projection && projection.projected < 900 ? projection : null;
      return {
        playerId: prospect.playerId,
        portrait: selectPlayerPortrait(state, prospect.playerId),
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        position: prospect.position,
        age: identity?.age ?? null,
        nationality: identity?.nationality ?? null,
        scoutGrade: report.scoutGrade,
        confidence: report.confidence,
        knowledgeLevel: report.knowledgeLevel,
        projectedPick: projected?.projected ?? null,
        previousProjectedPick: projected?.previous ?? null,
        projectedRank: copyRange(report.projectedRank),
        overall: copyRange(report.estimatedOverall),
        potential: copyRange(report.estimatedPotential),
        categories: Object.fromEntries(
          Object.entries(report.categories).map(([key, range]) => [
            key,
            { min: range.min, max: range.max },
          ]),
        ) as ProspectSheetCategories,
        strengths: report.strengths.map((entry) => entry.label),
        weaknesses: report.weaknesses.map((entry) => entry.label),
        onBoard: onBoard.has(prospect.playerId),
      };
    });

  return { rows, total: board.eligibleProspects.length };
}

export function toProspectSheetRows(
  state: GameState,
  options: ProspectSheetOptions = {},
): ProspectSheetRow[] {
  return toProspectSheet(state, options).rows;
}

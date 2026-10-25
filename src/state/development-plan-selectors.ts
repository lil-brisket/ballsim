/**
 * Training camp views: the owner's roster with each player's camp, the camp
 * catalogue, and skill ratings with the change since last season.
 * Presentation only.
 */

import {
  DEVELOPMENT_FOCUSES,
  DEVELOPMENT_FOCUS_ATTRIBUTES,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import type { PlayerAttributes } from "@/domain/entities/player";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { changeFromHistory } from "@/state/player-overall-change";
import { selectPlayerPortrait } from "@/state/player-portrait-selectors";
import { formatAttributeLabel } from "@/presentation/player-rating-categories";
import { isPlayerDlAssigned } from "@/systems/development-league/franchise-membership";

export const DEVELOPMENT_FOCUS_LABELS: Record<DevelopmentFocus, string> = {
  balanced: "No camp",
  shooting: "Shooting",
  finishing: "Finishing",
  playmaking: "Playmaking",
  defense: "Defense",
  rebounding: "Rebounding",
  athleticism: "Athleticism",
  iq: "Basketball IQ",
};

/** Camps in display order, without "balanced". */
export const TRAINING_CAMPS = DEVELOPMENT_FOCUSES.filter(
  (focus) => focus !== "balanced",
);

export type TrainingCampInfo = {
  focus: DevelopmentFocus;
  label: string;
  skills: string[];
  /** Owner players currently booked into this camp. */
  attendees: number;
};

export type PlayerInjuryTag = { label: string };

export type DevelopmentPlanRow = {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
  overall: number;
  focus: DevelopmentFocus;
  injury: PlayerInjuryTag | null;
};

export type DevelopmentPlansView = {
  camps: TrainingCampInfo[];
  rows: DevelopmentPlanRow[];
};

export type SkillRating = {
  focus: DevelopmentFocus;
  label: string;
  rating: number;
  /** Change since the last completed season; null without history. */
  delta: number | null;
};

export type SkillRatingsRow = {
  playerId: string;
  portrait: PlayerPortraitAssignment | null;
  playerName: string;
  position: string;
  age: number;
  overall: number;
  overallDelta: number | null;
  potential: number;
  onDevelopmentLeague: boolean;
  focus: DevelopmentFocus;
  injury: PlayerInjuryTag | null;
  skills: SkillRating[];
};

export function toDevelopmentPlansView(state: GameState): DevelopmentPlansView {
  const plans = state.business.developmentPlans ?? {};
  const rows: DevelopmentPlanRow[] = [];
  for (const playerId of ownerRoster(state)) {
    const player = state.world.players[playerId]!;
    rows.push({
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      position: player.position,
      age: player.age,
      overall: calculatePlayerOverall(player.position, player.attributes),
      focus: plans[playerId] ?? "balanced",
      injury: injuryTag(state, playerId),
    });
  }
  rows.sort(
    (a, b) => a.age - b.age || a.playerName.localeCompare(b.playerName),
  );
  const camps = TRAINING_CAMPS.map((focus) => ({
    focus,
    label: DEVELOPMENT_FOCUS_LABELS[focus],
    skills: DEVELOPMENT_FOCUS_ATTRIBUTES[focus].map(formatAttributeLabel),
    attendees: rows.filter((row) => row.focus === focus).length,
  }));
  return { camps, rows };
}

/** Owner roster skill ratings (camp areas), best overall first. */
export function toSkillRatingsView(state: GameState): SkillRatingsRow[] {
  const plans = state.business.developmentPlans ?? {};
  const rows: SkillRatingsRow[] = [];
  for (const playerId of ownerRoster(state)) {
    const player = state.world.players[playerId]!;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    const baseline = attributeBaseline(state, playerId);
    rows.push({
      playerId,
      portrait: selectPlayerPortrait(state, playerId),
      playerName: `${player.firstName} ${player.lastName}`,
      position: player.position,
      age: player.age,
      overall,
      overallDelta: changeFromHistory(state, playerId, overall).delta,
      potential: player.potential.overall,
      onDevelopmentLeague: isPlayerDlAssigned(player),
      focus: plans[playerId] ?? "balanced",
      injury: injuryTag(state, playerId),
      skills: TRAINING_CAMPS.map((focus) => {
        const rating = areaRating(player.attributes, focus);
        return {
          focus,
          label: DEVELOPMENT_FOCUS_LABELS[focus],
          rating,
          delta: baseline ? rating - areaRating(baseline, focus) : null,
        };
      }),
    });
  }
  rows.sort(
    (a, b) => b.overall - a.overall || a.playerName.localeCompare(b.playerName),
  );
  return rows;
}

function ownerRoster(state: GameState): string[] {
  const team = state.world.teams[getActiveOwnerTeamId(state)];
  return (team?.roster ?? []).filter((id) => state.world.players[id]);
}

function injuryTag(state: GameState, playerId: string): PlayerInjuryTag | null {
  const injury = state.world.players[playerId]?.activeInjuries?.[0];
  return injury ? { label: injury.type } : null;
}

/** Rounded mean of a camp's attributes. */
function areaRating(
  attributes: PlayerAttributes,
  focus: DevelopmentFocus,
): number {
  const keys = DEVELOPMENT_FOCUS_ATTRIBUTES[focus];
  const total = keys.reduce((sum, key) => sum + attributes[key], 0);
  return Math.round(total / keys.length);
}

/**
 * Attributes to measure change against: the latest snapshot from a season
 * before the current one.
 */
function attributeBaseline(
  state: GameState,
  playerId: string,
): PlayerAttributes | null {
  const seasons = state.business.playerHistory[playerId]?.seasons ?? [];
  let best: (typeof seasons)[number] | null = null;
  for (const season of seasons) {
    if (season.seasonYear >= state.competition.season.year) continue;
    if (!best || season.seasonYear > best.seasonYear) best = season;
  }
  return best?.attributes ?? null;
}

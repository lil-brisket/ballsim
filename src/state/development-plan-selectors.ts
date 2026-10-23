/**
 * Development plans view: the owner's players who can follow a plan, their
 * focus, and last season's attribute change by area. Presentation only.
 */

import {
  DEVELOPMENT_FOCUS_ATTRIBUTES,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import type { PlayerAttributes } from "@/domain/entities/player";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { DEVELOPMENT_PLAN_MAX_AGE } from "@/systems/player-development";

export const DEVELOPMENT_FOCUS_LABELS: Record<DevelopmentFocus, string> = {
  balanced: "Balanced",
  shooting: "Shooting",
  playmaking: "Playmaking",
  defense: "Defense",
  rebounding: "Rebounding",
  athleticism: "Athleticism",
};

export type DevelopmentPlanRow = {
  playerId: string;
  playerName: string;
  age: number;
  focus: DevelopmentFocus;
  /** Change per area since last season's end (null without history). */
  lastChange: { label: string; delta: number }[] | null;
};

export type DevelopmentPlansView = {
  maxAge: number;
  rows: DevelopmentPlanRow[];
};

export function toDevelopmentPlansView(state: GameState): DevelopmentPlansView {
  const teamId = getActiveOwnerTeamId(state);
  const team = state.world.teams[teamId];
  const rows: DevelopmentPlanRow[] = [];
  for (const playerId of team?.roster ?? []) {
    const player = state.world.players[playerId];
    if (!player || player.age > DEVELOPMENT_PLAN_MAX_AGE) continue;
    rows.push({
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      age: player.age,
      focus: state.business.developmentPlans?.[playerId] ?? "balanced",
      lastChange: lastSeasonChange(state, playerId),
    });
  }
  rows.sort(
    (a, b) => a.age - b.age || a.playerName.localeCompare(b.playerName),
  );
  return { maxAge: DEVELOPMENT_PLAN_MAX_AGE, rows };
}

function lastSeasonChange(
  state: GameState,
  playerId: string,
): DevelopmentPlanRow["lastChange"] {
  const seasons = state.business.playerHistory[playerId]?.seasons ?? [];
  const last = seasons[seasons.length - 1];
  const player = state.world.players[playerId];
  if (!last || !player) return null;
  // Development runs in the offseason: compare now with last season's end.
  const now: PlayerAttributes = player.attributes;
  const then: PlayerAttributes = last.attributes;
  const areas = (
    Object.keys(DEVELOPMENT_FOCUS_ATTRIBUTES) as DevelopmentFocus[]
  )
    .filter((focus) => focus !== "balanced")
    .map((focus) => ({
      label: DEVELOPMENT_FOCUS_LABELS[focus],
      delta: DEVELOPMENT_FOCUS_ATTRIBUTES[focus].reduce(
        (sum, key) => sum + (now[key] - then[key]),
        0,
      ),
    }));
  return areas.every((a) => a.delta === 0) ? null : areas;
}

/**
 * Presentation moments the dashboard layout may open on its own. Only facts
 * that are news right now are included, to keep the layout payload small.
 */

import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toProgressionRevealView,
  type ProgressionRevealView,
} from "@/state/progression-reveal-selectors";

export type DashboardMomentsView = {
  teamId: string;
  progression: ProgressionRevealView | null;
};

export function toDashboardMomentsView(state: GameState): DashboardMomentsView {
  const teamId = getActiveOwnerTeamId(state);
  const progression = toProgressionRevealView(state, teamId);
  return {
    teamId,
    progression: progression?.isCurrent ? progression : null,
  };
}

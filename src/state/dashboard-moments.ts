/**
 * Presentation moments the dashboard layout may open on its own. Only facts
 * that are news right now are included, to keep the layout payload small.
 */

import type { GameState } from "@/state/game-state";
import {
  toChampionMomentView,
  type ChampionMomentView,
} from "@/state/champion-moment-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toProgressionRevealView,
  type ProgressionRevealView,
} from "@/state/progression-reveal-selectors";

export type DashboardMomentsView = {
  teamId: string;
  /** League-wide: shown to every owner. */
  champion: ChampionMomentView | null;
  progression: ProgressionRevealView | null;
};

export function toDashboardMomentsView(state: GameState): DashboardMomentsView {
  const teamId = getActiveOwnerTeamId(state);
  const progression = toProgressionRevealView(state, teamId);
  const champion = toChampionMomentView(state);
  return {
    teamId,
    champion: champion?.isCurrent ? champion : null,
    progression: progression?.isCurrent ? progression : null,
  };
}

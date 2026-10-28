/**
 * Presentation moments the dashboard layout may open on its own. Only facts
 * that are news right now are included, to keep the layout payload small.
 */

import type { GameState } from "@/state/game-state";
import {
  toAwardsNightView,
  type AwardsNightView,
} from "@/state/awards-night-selectors";
import {
  toChampionMomentView,
  type ChampionMomentView,
} from "@/state/champion-moment-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  toProgressionRevealView,
  type ProgressionRevealView,
} from "@/state/progression-reveal-selectors";
import {
  toSeasonRecapView,
  type SeasonRecapView,
} from "@/state/season-recap-selectors";

export type DashboardMomentsView = {
  teamId: string;
  /** League-wide: shown to every owner. */
  awards: AwardsNightView | null;
  champion: ChampionMomentView | null;
  progression: ProgressionRevealView | null;
  recap: SeasonRecapView | null;
};

export function toDashboardMomentsView(state: GameState): DashboardMomentsView {
  const teamId = getActiveOwnerTeamId(state);
  const progression = toProgressionRevealView(state, teamId);
  const champion = toChampionMomentView(state);
  const awards = toAwardsNightView(state);
  const recap = toSeasonRecapView(state, undefined, teamId);
  return {
    teamId,
    awards: awards?.isCurrent ? awards : null,
    champion: champion?.isCurrent ? champion : null,
    progression: progression?.isCurrent ? progression : null,
    recap: recap?.isCurrent ? recap : null,
  };
}

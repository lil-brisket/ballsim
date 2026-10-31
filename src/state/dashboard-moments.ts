/**
 * Presentation moments the dashboard layout may open on its own. Only facts
 * that are news right now are included, to keep the layout payload small.
 * Eligibility is decided from cheap state first, so the full selectors (which
 * walk every player in the league) only run in the phases that show them.
 */

import type { GameState } from "@/state/game-state";
import {
  isAwardsNightCurrent,
  toAwardsNightView,
  type AwardsNightView,
} from "@/state/awards-night-selectors";
import {
  isChampionMomentCurrent,
  toChampionMomentView,
  type ChampionMomentView,
} from "@/state/champion-moment-selectors";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  isProgressionRevealCurrent,
  toProgressionRevealView,
  type ProgressionRevealView,
} from "@/state/progression-reveal-selectors";
import {
  isSeasonRecapCurrent,
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

function currentOnly<T extends { isCurrent: boolean }>(
  view: T | null,
): T | null {
  return view?.isCurrent ? view : null;
}

export function toDashboardMomentsView(state: GameState): DashboardMomentsView {
  const teamId = getActiveOwnerTeamId(state);
  return {
    teamId,
    awards: isAwardsNightCurrent(state)
      ? currentOnly(toAwardsNightView(state))
      : null,
    champion: isChampionMomentCurrent(state)
      ? currentOnly(toChampionMomentView(state))
      : null,
    progression: isProgressionRevealCurrent(state)
      ? currentOnly(toProgressionRevealView(state, teamId))
      : null,
    recap: isSeasonRecapCurrent(state, teamId)
      ? currentOnly(toSeasonRecapView(state, undefined, teamId))
      : null,
  };
}

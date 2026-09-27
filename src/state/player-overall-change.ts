/**
 * Season-over-season overall change from playerHistory snapshots.
 * Presentation-only; does not invent a prior season when history is missing.
 */

import type { GameState } from "@/state/game-state";

export type PlayerOverallChange = {
  delta: number | null;
  label: string | null;
};

export function changeFromHistory(
  state: GameState,
  playerId: string,
  currentOverall: number,
): PlayerOverallChange {
  const history = state.business.playerHistory[playerId];
  if (!history || history.seasons.length === 0) {
    return { delta: null, label: null };
  }
  const seasons = [...history.seasons].sort(
    (a, b) => a.seasonYear - b.seasonYear,
  );
  const last = seasons[seasons.length - 1]!;
  // Prefer last completed season vs current live OVR when years differ.
  if (last.seasonYear < state.competition.season.year) {
    const delta = currentOverall - last.overall;
    return {
      delta,
      label: `${last.overall} → ${currentOverall}`,
    };
  }
  if (seasons.length >= 2) {
    const prev = seasons[seasons.length - 2]!;
    const delta = last.overall - prev.overall;
    return {
      delta,
      label: `${prev.overall} → ${last.overall}`,
    };
  }
  // Only one season snapshot — contextual evidence, not a fabricated prior.
  return { delta: null, label: String(last.overall) };
}

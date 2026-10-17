import { contrastRatio } from "@/domain/color-contrast";
import type { WatchSide, WatchTeam } from "@/state/watch-game-view";

/** Away tokens switch to their secondary colour below this contrast ratio. */
export const MIN_TEAM_CONTRAST = 1.5;

/** Token colour per side; away falls back to secondary when too close to home. */
export function teamTokenColor(
  home: WatchTeam,
  away: WatchTeam,
): (side: WatchSide) => string {
  const awayUsesSecondary =
    (contrastRatio(home.branding.primaryColor, away.branding.primaryColor) ??
      Infinity) < MIN_TEAM_CONTRAST;
  return (side) =>
    side === 0
      ? home.branding.primaryColor
      : awayUsesSecondary
        ? away.branding.secondaryColor
        : away.branding.primaryColor;
}

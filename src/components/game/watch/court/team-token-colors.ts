import { contrastRatio } from "@/domain/color-contrast";
import type { WatchSide, WatchTeam } from "@/state/watch-game-view";

/** Away tokens switch to their secondary colour below this contrast ratio. */
export const MIN_TEAM_CONTRAST = 1.5;

/** Below this contrast with black a colour reads as shadow rather than light. */
const MIN_LIGHT_CONTRAST = 3;

/** The team's first brand colour bright enough to read as light on the floor. */
export function teamLightColor(team: WatchTeam): string {
  const { primaryColor, accentColor, secondaryColor } = team.branding;
  return (
    [primaryColor, accentColor, secondaryColor].find(
      (color) => (contrastRatio(color, "#000000") ?? 0) >= MIN_LIGHT_CONTRAST,
    ) ?? "#FFFFFF"
  );
}

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

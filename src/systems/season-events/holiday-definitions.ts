import type { HolidayDefinition } from "@/domain/entities/season-events";

/**
 * Fictional league holidays — presentation-only in M3.
 * Offsets are relative to the midseason anchor date.
 */
export const LEAGUE_HOLIDAY_DEFINITIONS: readonly HolidayDefinition[] = [
  {
    key: "league_founding_day",
    title: "League Founding Day",
    shortLabel: "Founding Day",
    offsetFromAnchor: -21,
    durationDays: 1,
  },
  {
    key: "basketball_heritage_day",
    title: "Basketball Heritage Day",
    shortLabel: "Heritage Day",
    offsetFromAnchor: -7,
    durationDays: 1,
  },
  {
    key: "players_appreciation_day",
    title: "Players Appreciation Day",
    shortLabel: "Players Day",
    offsetFromAnchor: 0,
    durationDays: 1,
  },
  {
    key: "rivalry_weekend",
    title: "Rivalry Weekend",
    shortLabel: "Rivalry Weekend",
    offsetFromAnchor: 7,
    durationDays: 2,
  },
  {
    key: "community_basketball_day",
    title: "Community Basketball Day",
    shortLabel: "Community Day",
    offsetFromAnchor: 14,
    durationDays: 1,
  },
] as const;

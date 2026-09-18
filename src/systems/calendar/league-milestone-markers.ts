/**
 * League milestone markers for the owner calendar grid.
 * Uses getLeagueMilestones — schedule/phase anchors, not invented dates.
 */

import type { LeagueMilestoneKey } from "@/systems/league-rules/calendar-events";
import {
  getLeagueMilestones,
  type LeagueMilestone,
} from "@/systems/league-rules/calendar-events";
import type { GameState } from "@/state/game-state";

export type CalendarLeagueMilestoneMarker = {
  key: LeagueMilestoneKey;
  label: string;
  shortLabel: string;
  date: string;
  reached: boolean;
  active: boolean;
  chipClass: string;
  dotClass: string;
};

/** Milestones surfaced on the month grid (excludes bookkeeping-only keys). */
export const CALENDAR_MILESTONE_KEYS = new Set<LeagueMilestoneKey>([
  "offseasonStart",
  "draftStart",
  "freeAgencyOpen",
  "freeAgencyClose",
  "preseasonStart",
  "regularSeasonStart",
  "tradeDeadline",
  "regularSeasonEnd",
  "playoffsStart",
  "championFinalized",
]);

/** Lower index = higher priority when a day has multiple milestones. */
const MILESTONE_PRIORITY: readonly LeagueMilestoneKey[] = [
  "regularSeasonStart",
  "playoffsStart",
  "tradeDeadline",
  "regularSeasonEnd",
  "preseasonStart",
  "draftStart",
  "freeAgencyOpen",
  "freeAgencyClose",
  "offseasonStart",
  "championFinalized",
];

type MilestoneDisplay = {
  shortLabel: string;
  chipClass: string;
  dotClass: string;
};

const MILESTONE_DISPLAY: Record<LeagueMilestoneKey, MilestoneDisplay> = {
  offseasonStart: {
    shortLabel: "Offseason",
    chipClass: "bg-zinc-800/90 text-zinc-300",
    dotClass: "bg-zinc-400",
  },
  contractExpirationProcessed: {
    shortLabel: "Contracts",
    chipClass: "bg-zinc-800/90 text-zinc-400",
    dotClass: "bg-zinc-500",
  },
  rfaWindowOpen: {
    shortLabel: "RFA",
    chipClass: "bg-violet-950/70 text-violet-300",
    dotClass: "bg-violet-400",
  },
  draftStart: {
    shortLabel: "Draft",
    chipClass: "bg-purple-950/70 text-purple-300",
    dotClass: "bg-purple-400",
  },
  draftComplete: {
    shortLabel: "Draft done",
    chipClass: "bg-purple-950/50 text-purple-200",
    dotClass: "bg-purple-300",
  },
  freeAgencyOpen: {
    shortLabel: "FA opens",
    chipClass: "bg-cyan-950/70 text-cyan-300",
    dotClass: "bg-cyan-400",
  },
  freeAgencyClose: {
    shortLabel: "FA closes",
    chipClass: "bg-cyan-950/50 text-cyan-200",
    dotClass: "bg-cyan-300",
  },
  preseasonStart: {
    shortLabel: "Preseason",
    chipClass: "bg-indigo-950/70 text-indigo-300",
    dotClass: "bg-indigo-400",
  },
  regularSeasonStart: {
    shortLabel: "Season",
    chipClass: "bg-emerald-950/70 text-emerald-300",
    dotClass: "bg-emerald-400",
  },
  tradeDeadline: {
    shortLabel: "Deadline",
    chipClass: "bg-rose-950/70 text-rose-300",
    dotClass: "bg-rose-400",
  },
  regularSeasonEnd: {
    shortLabel: "RS end",
    chipClass: "bg-amber-950/70 text-amber-300",
    dotClass: "bg-amber-400",
  },
  playoffsStart: {
    shortLabel: "Playoffs",
    chipClass: "bg-orange-950/70 text-orange-300",
    dotClass: "bg-orange-400",
  },
  championFinalized: {
    shortLabel: "Champion",
    chipClass: "bg-yellow-950/70 text-yellow-200",
    dotClass: "bg-yellow-400",
  },
  nextOffseason: {
    shortLabel: "Offseason",
    chipClass: "bg-zinc-800/90 text-zinc-400",
    dotClass: "bg-zinc-500",
  },
};

function milestonePriority(key: LeagueMilestoneKey): number {
  const index = MILESTONE_PRIORITY.indexOf(key);
  return index === -1 ? MILESTONE_PRIORITY.length : index;
}

export function toCalendarLeagueMilestoneMarker(
  milestone: LeagueMilestone,
): CalendarLeagueMilestoneMarker | null {
  if (milestone.date === null) return null;
  if (!CALENDAR_MILESTONE_KEYS.has(milestone.key)) return null;

  const display = MILESTONE_DISPLAY[milestone.key];
  return {
    key: milestone.key,
    label: milestone.label,
    shortLabel: display.shortLabel,
    date: milestone.date,
    reached: milestone.reached,
    active: milestone.active,
    chipClass: display.chipClass,
    dotClass: display.dotClass,
  };
}

export function getLeagueMilestoneMarkersForRange(
  state: GameState,
  from: string,
  to: string,
): CalendarLeagueMilestoneMarker[] {
  const markers: CalendarLeagueMilestoneMarker[] = [];

  for (const milestone of getLeagueMilestones(state)) {
    const marker = toCalendarLeagueMilestoneMarker(milestone);
    if (!marker) continue;
    if (marker.date < from || marker.date > to) continue;
    markers.push(marker);
  }

  markers.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      milestonePriority(left.key) - milestonePriority(right.key),
  );

  return markers;
}

export function indexLeagueMilestoneMarkersByDate(
  markers: readonly CalendarLeagueMilestoneMarker[],
): Map<string, CalendarLeagueMilestoneMarker[]> {
  const byDate = new Map<string, CalendarLeagueMilestoneMarker[]>();

  for (const marker of markers) {
    const list = byDate.get(marker.date);
    if (list) {
      list.push(marker);
    } else {
      byDate.set(marker.date, [marker]);
    }
  }

  for (const list of byDate.values()) {
    list.sort(
      (left, right) => milestonePriority(left.key) - milestonePriority(right.key),
    );
  }

  return byDate;
}

export function collectLegendMilestones(
  markers: readonly CalendarLeagueMilestoneMarker[],
): CalendarLeagueMilestoneMarker[] {
  const seen = new Set<LeagueMilestoneKey>();
  const legend: CalendarLeagueMilestoneMarker[] = [];

  const sorted = [...markers].sort(
    (left, right) => milestonePriority(left.key) - milestonePriority(right.key),
  );

  for (const marker of sorted) {
    if (seen.has(marker.key)) continue;
    seen.add(marker.key);
    legend.push(marker);
  }

  return legend;
}

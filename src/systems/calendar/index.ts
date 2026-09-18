export { advanceCalendar } from "@/systems/calendar/advance-calendar";

export {
  projectCalendarEvents,
  awardCalendarDate,
  teamDisplayName,
  playerDisplayName,
  type ProjectCalendarEventsOptions,
} from "@/systems/calendar/project-calendar-events";

export {
  getCalendarMonthGrid,
  type CalendarDayCell,
  type CalendarDayIndicatorCounts,
  type CalendarMonthGrid,
  type GetCalendarMonthGridOptions,
} from "@/systems/calendar/calendar-month";

export {
  getCalendarTodayBriefing,
  type CalendarTodayBriefing,
  type CalendarTodayYourTeamBriefing,
  type CalendarTodayLeagueBriefing,
} from "@/systems/calendar/today-briefing";

export {
  findNextSimulationTarget,
  type SimulationTargetMode,
  type SimulationTarget,
} from "@/systems/calendar/simulation-targets";

export {
  summarizeSimulationRange,
  type SimulationRangePreview,
  type SimulationRangeYourTeamPreview,
  type SimulationRangeLeaguePreview,
} from "@/systems/calendar/simulation-preview";


export {
  buildSimulationSummary,
} from "@/systems/calendar/simulation-summary";
export type {
  SimulationSummaryItem, SimulationSummary, BuildSimulationSummaryOptions,
} from "@/systems/calendar/simulation-summary";
export {
  getTeamGamesForDate,
  getTeamGameForDate,
  projectTeamGameView,
  getNextTeamGameDate,
  type TeamCalendarGameView,
} from "@/systems/calendar/schedule-projection";

export {
  projectOwnerCalendarEvents,
  isOwnerCalendarEvent,
  type ProjectOwnerCalendarEventsOptions,
} from "@/systems/calendar/project-owner-calendar";

export {
  buildCalendarDateInspectorView,
  type CalendarDateInspectorView,
} from "@/systems/calendar/calendar-inspector";

export {
  collectLegendMilestones,
  getLeagueMilestoneMarkersForRange,
  indexLeagueMilestoneMarkersByDate,
  toCalendarLeagueMilestoneMarker,
  type CalendarLeagueMilestoneMarker,
} from "@/systems/calendar/league-milestone-markers";

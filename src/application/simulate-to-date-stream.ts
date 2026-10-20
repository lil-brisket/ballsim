import type {
  SimulationProgress,
  SimulationStopReason,
} from "@/systems/simulation/types";
import type { CalendarLeagueContextView } from "@/state/standings-selectors";
import type { CalendarMonthGrid } from "@/systems/calendar";

export type SimulateToDateProgressEvent = {
  type: "progress";
  /** Controlled team's standings after this day, for the live league strip. */
  leagueContext?: CalendarLeagueContextView | null;
  /** Grid for currentDate's month, sent the first time the run enters it. */
  monthGrid?: CalendarMonthGrid;
} & SimulationProgress;

export type SimulateToDateDoneEvent = {
  type: "done";
  ok: true;
  daysAdvanced: number;
  highlightCount: number;
  fromDate: string;
  toDate: string;
  currentDate: string;
  requestedTargetDate: string;
  stopReason?: SimulationStopReason;
};

export type SimulateToDateErrorEvent = {
  type: "error";
  ok: false;
  message: string;
};

export type SimulateToDateStreamEvent =
  | SimulateToDateProgressEvent
  | SimulateToDateDoneEvent
  | SimulateToDateErrorEvent;

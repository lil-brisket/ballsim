import type { SimulationProgress } from "@/systems/simulation/types";

export type SimulateToDateProgressEvent = {
  type: "progress";
} & SimulationProgress;

export type SimulateToDateDoneEvent = {
  type: "done";
  ok: true;
  daysAdvanced: number;
  highlightCount: number;
  fromDate: string;
  toDate: string;
  currentDate: string;
  stopReason?: string;
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

import type { LabGameSessionOptions } from "@/simulation/lab/lab-game-session";
import type { LabGameHarnessRecord } from "@/simulation/lab/lab-game-harness";

export type LabGameWorkerData = LabGameSessionOptions & {
  warmupIndexes?: number[];
};

export type LabGameWorkerPlayMessage = {
  type: "play";
  indexes: number[];
};

export type LabGameWorkerPlayedMessage = {
  type: "played";
  records: LabGameHarnessRecord[];
};

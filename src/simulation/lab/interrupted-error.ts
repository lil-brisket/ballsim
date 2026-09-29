export type LabRunInterruptReason = "aborted" | "timeout";

export class LabRunInterruptedError extends Error {
  readonly reason: LabRunInterruptReason;
  readonly runId: string | undefined;
  readonly checkpointPath: string | undefined;
  readonly completedGameIndexes: readonly number[];
  readonly timedOutGameIndex: number | undefined;

  constructor(input: {
    reason: LabRunInterruptReason;
    completedGameIndexes: readonly number[];
    runId?: string;
    checkpointPath?: string;
    timedOutGameIndex?: number;
  }) {
    const resume =
      input.runId != null
        ? ` Resume with --resume --run-id ${input.runId}.`
        : "";
    const timeout =
      input.reason === "timeout" && input.timedOutGameIndex != null
        ? ` Timed out on game ${input.timedOutGameIndex}.`
        : "";
    super(
      `Lab run ${input.reason} after ${input.completedGameIndexes.length} game(s).${timeout}${resume}`,
    );
    this.name = "LabRunInterruptedError";
    this.reason = input.reason;
    this.runId = input.runId;
    this.checkpointPath = input.checkpointPath;
    this.completedGameIndexes = [...input.completedGameIndexes].sort(
      (left, right) => left - right,
    );
    this.timedOutGameIndex = input.timedOutGameIndex;
  }
}

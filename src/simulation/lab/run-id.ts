import { randomBytes } from "node:crypto";

const PATH_SEPARATORS = /[\\/]/;

export function assertLabRunId(runId: string): string {
  if (runId.trim().length === 0) {
    throw new Error("Lab runId must be a non-empty string.");
  }
  if (PATH_SEPARATORS.test(runId)) {
    throw new Error("Lab runId must not contain path separators.");
  }
  return runId;
}

export function createLabRunId(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const suffix = randomBytes(4).toString("hex");
  return `lab-${stamp}-${suffix}`;
}

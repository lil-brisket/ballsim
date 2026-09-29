export const LAB_DEFAULT_JOBS = 1;
export const LAB_DEFAULT_CHUNK_SIZE = 32;

export function remainingGameIndexes(
  games: number,
  completed: ReadonlySet<number>,
): number[] {
  if (!Number.isInteger(games) || games < 1) {
    throw new Error("remainingGameIndexes: games must be a positive integer.");
  }
  const indexes: number[] = [];
  for (let gameIndex = 0; gameIndex < games; gameIndex += 1) {
    if (!completed.has(gameIndex)) {
      indexes.push(gameIndex);
    }
  }
  return indexes;
}

export function chunkIndexes(
  indexes: readonly number[],
  chunkSize: number,
): number[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("chunkIndexes: chunkSize must be a positive integer.");
  }
  const chunks: number[][] = [];
  for (let offset = 0; offset < indexes.length; offset += chunkSize) {
    chunks.push([...indexes.slice(offset, offset + chunkSize)]);
  }
  return chunks;
}

export function assertLabJobs(jobs: number, rotation: "on" | "off"): void {
  if (!Number.isInteger(jobs) || jobs < 1) {
    throw new Error("Lab jobs must be a positive integer.");
  }
  if (jobs > 1 && rotation === "on") {
    throw new Error(
      "Lab --jobs > 1 requires --rotation=off. Rotation-on games share injury/rotation state and cannot be parallelized without changing output.",
    );
  }
}

export function assertLabTimeoutMs(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 0) {
    throw new Error("Lab timeoutMs must be a non-negative integer.");
  }
}

export function assertLabChunkSize(chunkSize: number): void {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("Lab chunkSize must be a positive integer.");
  }
}

/**
 * Simulated basketball game clock. Uses integer seconds only — never wall clock.
 */

export type GameClock = {
  /** 1-based period index within the current segment (regulation or OT). */
  periodNumber: number;
  remainingSeconds: number;
};

export function createGameClock(periodSeconds: number): GameClock {
  if (!Number.isInteger(periodSeconds) || periodSeconds < 0) {
    throw new Error("Game clock periodSeconds must be a non-negative integer.");
  }
  return {
    periodNumber: 1,
    remainingSeconds: periodSeconds,
  };
}

/**
 * Consumes up to `requestedSeconds` from the clock.
 * Returns elapsed time (never more than remaining; never negative remaining).
 */
export function consumeTime(
  clock: GameClock,
  requestedSeconds: number,
): { clock: GameClock; elapsedSeconds: number } {
  if (!Number.isInteger(requestedSeconds) || requestedSeconds < 0) {
    throw new Error(
      "Game clock requestedSeconds must be a non-negative integer.",
    );
  }
  const elapsedSeconds = Math.min(requestedSeconds, clock.remainingSeconds);
  return {
    clock: {
      periodNumber: clock.periodNumber,
      remainingSeconds: clock.remainingSeconds - elapsedSeconds,
    },
    elapsedSeconds,
  };
}

export function resetPeriodClock(
  clock: GameClock,
  periodSeconds: number,
): GameClock {
  if (!Number.isInteger(periodSeconds) || periodSeconds < 0) {
    throw new Error("Game clock periodSeconds must be a non-negative integer.");
  }
  return {
    periodNumber: clock.periodNumber + 1,
    remainingSeconds: periodSeconds,
  };
}

export function isPeriodOver(clock: GameClock): boolean {
  return clock.remainingSeconds <= 0;
}

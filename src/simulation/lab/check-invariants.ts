import type { GameEvent } from "@/domain/entities/game";
import type { GameResult } from "@/domain/entities/game-result";
import type { Player } from "@/domain/entities/player";
import { collectRawGameFailures } from "@/simulation/lab/collect-game-failures";
import type {
  LabRotationMode,
  RawInvariantFailure,
} from "@/simulation/lab/types";
import { collectGameSnapshot } from "@/simulation/validation/collect-game-stats";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export type LabInvariantState = {
  result: GameResult | null;
  homePlayers: readonly Player[];
  awayPlayers: readonly Player[];
  homePlayerIds: ReadonlySet<string>;
  awayPlayerIds: ReadonlySet<string>;
  rotation: LabRotationMode;
  thrown?: readonly RawInvariantFailure[];
};

export function checkInvariants(
  state: LabInvariantState,
  gameIndex: number,
  seed: number | string,
): RawInvariantFailure[] {
  if (!Number.isInteger(gameIndex) || gameIndex < 0) {
    throw new Error(
      "checkInvariants: gameIndex must be a non-negative integer.",
    );
  }
  const failures: RawInvariantFailure[] = [...(state.thrown ?? [])];
  const context = { gameIndex, seed };

  failures.push(
    ...checkRosterSize(state.homePlayers.length, "home", context),
    ...checkRosterSize(state.awayPlayers.length, "away", context),
  );

  if (state.result == null) {
    return failures;
  }

  if (state.result.score.home < 0 || state.result.score.away < 0) {
    failures.push({
      rule: "SCORE_NONNEG",
      detail: `score ${JSON.stringify(state.result.score)}`,
      context: { ...context, gameId: state.result.gameId },
    });
  } else {
    try {
      const snapshot = collectGameSnapshot(state.result);
      failures.push(
        ...collectRawGameFailures(
          state.result,
          snapshot,
          state.homePlayerIds,
          state.awayPlayerIds,
        ),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ rule: "ENGINE_THROW", detail: message, context });
    }
  }
  failures.push(...checkClock(state.result, context));
  failures.push(...checkFoulLimits(state.result, state.rotation, context));
  return failures;
}

function checkRosterSize(
  size: number,
  side: "home" | "away",
  context: { gameIndex: number; seed: number | string },
): RawInvariantFailure[] {
  const min = TRADE_ROSTER_RULES.minRosterSize;
  const max = TRADE_ROSTER_RULES.maxRosterSize;
  if (size >= min && size <= max) {
    return [];
  }
  return [
    {
      rule: "ROSTER_SIZE",
      detail: `${side} roster size ${size} is outside [${min}, ${max}]`,
      context: { ...context, side, size, min, max },
    },
  ];
}

function checkClock(
  result: GameResult,
  context: { gameIndex: number; seed: number | string },
): RawInvariantFailure[] {
  const failures: RawInvariantFailure[] = [];
  for (const row of result.playerStats) {
    if (row.minutes < 0) {
      failures.push({
        rule: "CLOCK_NEGATIVE",
        detail: `player ${row.playerId} minutes ${row.minutes} < 0`,
        context: { ...context, playerId: row.playerId },
      });
    }
  }
  const trace = result.rotationMeta?.trace ?? [];
  for (const entry of trace) {
    if (entry.secondsRemaining < 0) {
      failures.push({
        rule: "CLOCK_NEGATIVE",
        detail: `rotation trace sequence ${entry.sequence} secondsRemaining ${entry.secondsRemaining} < 0`,
        context: { ...context, sequence: entry.sequence },
      });
    }
  }
  return failures;
}

function checkFoulLimits(
  result: GameResult,
  rotation: LabRotationMode,
  context: { gameIndex: number; seed: number | string },
): RawInvariantFailure[] {
  if (rotation !== "on") {
    return [];
  }
  const limit = ROTATION_CONFIG.personalFoulLimit;
  const failures: RawInvariantFailure[] = [];
  for (const row of result.playerStats) {
    if (row.fouls > limit) {
      failures.push({
        rule: "FOUL_LIMIT",
        detail: `player ${row.playerId} fouls ${row.fouls} > personalFoulLimit ${limit}`,
        context: {
          ...context,
          playerId: row.playerId,
          fouls: row.fouls,
          limit,
        },
      });
    }
  }
  return failures;
}

export function eventsFromResult(result: GameResult | null): GameEvent[] {
  if (result == null) {
    return [];
  }
  return result.events.map((event) => ({ ...event }));
}

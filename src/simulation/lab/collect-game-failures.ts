import { createGame } from "@/domain/entities/game";
import { validateCompletedGameBoxScore } from "@/domain/entities/game-box-score";
import type { GameResult } from "@/domain/entities/game-result";
import type {
  GameSnapshot,
  InvariantFailure,
} from "@/simulation/validation/types";
import { checkGameInvariants } from "@/simulation/validation/invariants";
import type { RawInvariantFailure } from "@/simulation/lab/types";

const BOX_SCORE_PREFIX = "failed box-score validation: ";

function fromInvariantFailure(failure: InvariantFailure): RawInvariantFailure {
  return {
    rule: failure.rule,
    detail: failure.detail,
    context: {
      gameId: failure.gameId,
      ...(failure.side != null ? { side: failure.side } : {}),
    },
  };
}

/** Parse concatenated `rule: detail` pairs from engine assert throws. */
export function parseThrownInvariantError(
  error: unknown,
): RawInvariantFailure[] {
  const message = error instanceof Error ? error.message : String(error);
  const start = message.indexOf(BOX_SCORE_PREFIX);
  const payload =
    start >= 0 ? message.slice(start + BOX_SCORE_PREFIX.length) : message;
  const parts = payload
    .split("; ")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const failures: RawInvariantFailure[] = [];
  for (const part of parts) {
    const splitAt = part.indexOf(": ");
    if (splitAt <= 0) {
      failures.push({ rule: "ENGINE_THROW", detail: part });
      continue;
    }
    failures.push({
      rule: part.slice(0, splitAt),
      detail: part.slice(splitAt + 2),
    });
  }
  return failures.length > 0
    ? failures
    : [{ rule: "ENGINE_THROW", detail: message }];
}

export function gameFromResult(result: GameResult) {
  return createGame({
    id: result.gameId,
    seasonId: result.seasonId,
    date: result.date,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    competitionType: "regular_season",
    status: "final",
    score: { ...result.score },
    periodScores: result.periodScores.map((period) => ({ ...period })),
    events: result.events.map((event) => ({ ...event })),
    playerStats: result.playerStats.map((row) => ({ ...row })),
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
    rotationMeta: result.rotationMeta,
  });
}

/**
 * Rotation HARD rules (NEGATIVE_SECONDS / TEAM_SECONDS_MISMATCH) are asserted
 * inside simulateGame when gameState is present. Lab collects them by catching
 * those throws via parseThrownInvariantError. Do not reconstruct seconds from
 * floored box-score minutes — that loses sub-minute clock remainder.
 */
export function collectRawGameFailures(
  result: GameResult,
  snapshot: GameSnapshot,
  homePlayerIds: ReadonlySet<string>,
  awayPlayerIds: ReadonlySet<string>,
): RawInvariantFailure[] {
  const failures: RawInvariantFailure[] = [];
  const game = gameFromResult(result);
  for (const failure of validateCompletedGameBoxScore(game)) {
    failures.push({
      rule: failure.rule,
      detail: failure.detail,
      context: { gameId: result.gameId },
    });
  }
  for (const failure of checkGameInvariants(
    result,
    snapshot,
    homePlayerIds,
    awayPlayerIds,
  )) {
    failures.push(fromInvariantFailure(failure));
  }
  return dedupeRawFailures(failures);
}

function dedupeRawFailures(
  failures: readonly RawInvariantFailure[],
): RawInvariantFailure[] {
  const seen = new Set<string>();
  const unique: RawInvariantFailure[] = [];
  for (const failure of failures) {
    const key = `${failure.rule}|${failure.detail}|${JSON.stringify(failure.context ?? {})}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(failure);
  }
  return unique;
}

export const LAB_OT_PERIODS_HIGH_THRESHOLD = 4;

export function overtimeHighFailure(
  overtimePeriodCount: number,
  gameId: string,
): RawInvariantFailure | null {
  if (overtimePeriodCount <= LAB_OT_PERIODS_HIGH_THRESHOLD) {
    return null;
  }
  return {
    rule: "LAB_OT_PERIODS_HIGH",
    detail: `overtimePeriodCount=${overtimePeriodCount} exceeds Lab interest threshold ${LAB_OT_PERIODS_HIGH_THRESHOLD}`,
    context: { gameId, overtimePeriodCount },
  };
}

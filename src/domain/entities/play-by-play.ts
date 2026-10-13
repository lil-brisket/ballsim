import type { PlayerId } from "@/domain/ids";

/**
 * Compact play-by-play log for one possession-fidelity game (schema v66+).
 *
 * Stored in `competition.playByPlay[gameId]` for the owner team's games of the
 * current season only, and cleared at season rollover. Parallel arrays keep
 * the JSON small (~6 KB/game); every array has one entry per play, in order.
 *
 * Clock semantics: `clock` is the seconds remaining in the period when the
 * possession STARTED, so every play of one possession shares a clock value.
 * Group plays by `poss` to render a possession as one feed row. Substitutions
 * carry the checkpoint clock and the possession count completed so far, so a
 * substitution with `poss = n` happens between possession n and n + 1.
 */
export type PlayByPlayLog = {
  v: 1;
  /** Player index table; `player` / `player2` point into it. */
  players: PlayerId[];
  /** 1-based period (5+ is overtime). */
  period: number[];
  /** Seconds remaining in the period at possession start (or checkpoint). */
  clock: number[];
  /** 1-based possession number (see type docs for substitutions). */
  poss: number[];
  /** {@link PlayCode}. */
  code: number[];
  /** Team of `player`: 0 = home, 1 = away. */
  side: number[];
  /** Primary player index; never -1. */
  player: number[];
  /** Secondary player index, -1 when none. Meaning depends on `code`. */
  player2: number[];
};

/**
 * Play codes. `player` / `player2` meaning per code:
 *
 * | code | play                | player        | player2                 |
 * |------|---------------------|---------------|-------------------------|
 * | 0    | 2PT made            | shooter       | assister or -1          |
 * | 1    | 2PT missed          | shooter       | blocker or -1           |
 * | 2    | 3PT made            | shooter       | assister or -1          |
 * | 3    | 3PT missed          | shooter       | blocker or -1           |
 * | 4    | free throw made     | shooter       | -1                      |
 * | 5    | free throw missed   | shooter       | -1                      |
 * | 6    | offensive rebound   | rebounder     | -1                      |
 * | 7    | defensive rebound   | rebounder     | -1                      |
 * | 8    | turnover            | ball handler  | stealer or -1           |
 * | 9    | shooting foul       | fouler        | fouled shooter          |
 * | 10   | personal foul       | fouler        | fouled player           |
 * | 11   | offensive foul      | fouler        | fouled defender         |
 * | 12   | substitution        | player out    | player in               |
 *
 * `side` is always the team of `player` (so for a turnover with a steal the
 * stealer in `player2` is on the other side). A shot made/missed that is
 * immediately followed by a shooting foul (same possession) on the shooter is
 * an and-one / fouled attempt; the shot row comes first.
 */
export const PLAY_CODE = {
  twoMade: 0,
  twoMissed: 1,
  threeMade: 2,
  threeMissed: 3,
  freeThrowMade: 4,
  freeThrowMissed: 5,
  offensiveRebound: 6,
  defensiveRebound: 7,
  turnover: 8,
  shootingFoul: 9,
  personalFoul: 10,
  offensiveFoul: 11,
  substitution: 12,
} as const;

export type PlayCode = (typeof PLAY_CODE)[keyof typeof PLAY_CODE];

export const PLAY_CODE_MAX: PlayCode = PLAY_CODE.substitution;

/** Codes whose `player2` must be a valid index (never -1). */
const PLAYER2_REQUIRED = new Set<number>([
  PLAY_CODE.shootingFoul,
  PLAY_CODE.personalFoul,
  PLAY_CODE.offensiveFoul,
  PLAY_CODE.substitution,
]);

/** Codes whose `player2` may be a valid index or -1. */
const PLAYER2_OPTIONAL = new Set<number>([
  PLAY_CODE.twoMade,
  PLAY_CODE.twoMissed,
  PLAY_CODE.threeMade,
  PLAY_CODE.threeMissed,
  PLAY_CODE.turnover,
]);

export function playCodePoints(code: number): number {
  switch (code) {
    case PLAY_CODE.twoMade:
      return 2;
    case PLAY_CODE.threeMade:
      return 3;
    case PLAY_CODE.freeThrowMade:
      return 1;
    default:
      return 0;
  }
}

export function isFoulCode(code: number): boolean {
  return (
    code === PLAY_CODE.shootingFoul ||
    code === PLAY_CODE.personalFoul ||
    code === PLAY_CODE.offensiveFoul
  );
}

export function playCountOf(log: PlayByPlayLog): number {
  return log.code.length;
}

/**
 * Structural validation (no GameState context). Throws with a path-prefixed
 * message. `limits` bound period and clock values.
 */
export function assertPlayByPlayLog(
  value: unknown,
  path: string,
  limits: {
    periodCount: number;
    regulationPeriodCount: number;
    regulationPeriodSeconds: number;
    overtimePeriodSeconds: number;
  },
): asserts value is PlayByPlayLog {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  const log = value as Record<string, unknown>;
  if (log.v !== 1) {
    throw new Error(`${path}.v must be 1.`);
  }
  if (!Array.isArray(log.players)) {
    throw new Error(`${path}.players must be an array.`);
  }
  const seenPlayers = new Set<string>();
  for (const [index, id] of log.players.entries()) {
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`${path}.players[${index}] must be a non-empty string.`);
    }
    if (seenPlayers.has(id)) {
      throw new Error(`${path}.players has duplicate id "${id}".`);
    }
    seenPlayers.add(id);
  }
  const columns = [
    "period",
    "clock",
    "poss",
    "code",
    "side",
    "player",
    "player2",
  ] as const;
  for (const column of columns) {
    if (!Array.isArray(log[column])) {
      throw new Error(`${path}.${column} must be an array.`);
    }
  }
  const length = (log.code as unknown[]).length;
  for (const column of columns) {
    if ((log[column] as unknown[]).length !== length) {
      throw new Error(
        `${path}.${column} length must equal code length (${length}).`,
      );
    }
  }

  const period = log.period as unknown[];
  const clock = log.clock as unknown[];
  const poss = log.poss as unknown[];
  const code = log.code as unknown[];
  const side = log.side as unknown[];
  const player = log.player as unknown[];
  const player2 = log.player2 as unknown[];
  const playerCount = log.players.length;
  let previousPeriod = 1;
  let previousPoss = 0;

  for (let index = 0; index < length; index += 1) {
    const at = `${path}[${index}]`;
    const p = period[index];
    if (!Number.isInteger(p) || (p as number) < 1) {
      throw new Error(`${at}.period must be a positive integer.`);
    }
    if ((p as number) > limits.periodCount) {
      throw new Error(
        `${at}.period ${p as number} exceeds the game's ${limits.periodCount} periods.`,
      );
    }
    if ((p as number) < previousPeriod) {
      throw new Error(`${at}.period must not decrease.`);
    }
    previousPeriod = p as number;

    const maxClock =
      (p as number) <= limits.regulationPeriodCount
        ? limits.regulationPeriodSeconds
        : limits.overtimePeriodSeconds;
    const c = clock[index];
    if (!Number.isInteger(c) || (c as number) < 0 || (c as number) > maxClock) {
      throw new Error(`${at}.clock must be an integer in [0, ${maxClock}].`);
    }

    const n = poss[index];
    if (!Number.isInteger(n) || (n as number) < 0) {
      throw new Error(`${at}.poss must be a non-negative integer.`);
    }
    if ((n as number) < previousPoss) {
      throw new Error(`${at}.poss must not decrease.`);
    }
    previousPoss = n as number;

    const k = code[index];
    if (
      !Number.isInteger(k) ||
      (k as number) < 0 ||
      (k as number) > PLAY_CODE_MAX
    ) {
      throw new Error(
        `${at}.code must be an integer in [0, ${PLAY_CODE_MAX}].`,
      );
    }
    if (side[index] !== 0 && side[index] !== 1) {
      throw new Error(`${at}.side must be 0 or 1.`);
    }
    const a = player[index];
    if (
      !Number.isInteger(a) ||
      (a as number) < 0 ||
      (a as number) >= playerCount
    ) {
      throw new Error(`${at}.player must index players.`);
    }
    const b = player2[index];
    if (!Number.isInteger(b)) {
      throw new Error(`${at}.player2 must be an integer.`);
    }
    if ((b as number) === -1) {
      if (PLAYER2_REQUIRED.has(k as number)) {
        throw new Error(`${at}.player2 is required for code ${k as number}.`);
      }
    } else {
      if (
        !PLAYER2_REQUIRED.has(k as number) &&
        !PLAYER2_OPTIONAL.has(k as number)
      ) {
        throw new Error(`${at}.player2 must be -1 for code ${k as number}.`);
      }
      if ((b as number) < 0 || (b as number) >= playerCount) {
        throw new Error(`${at}.player2 must index players or be -1.`);
      }
      if (b === a) {
        throw new Error(`${at}.player2 must differ from player.`);
      }
    }
  }
}

/**
 * Offseason soak: many seeds x many seasons through the real engine, checking
 * the offseason invariants at every phase boundary. Two user profiles:
 *
 * - `auto`: the user team is delegated to the engine (Full Management).
 * - `busy`: the user team is manual and a seeded script of extensions,
 *   releases, signings and trades (many deliberately illegal) fires in every
 *   phase. A rejected action must leave state untouched.
 *
 * No vitest imports; driven by `scripts/offseason-soak.ts` (tsx).
 */

import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createContract } from "@/domain/entities/contract";
import type { DraftPick } from "@/domain/entities/draft-pick";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import {
  asContractId,
  asOfferId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng, normalizeSeed, type Rng } from "@/domain/rng";
import type { SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  getExtensionBlockReason,
  offerContractExtension,
} from "@/systems/contract-extensions";
import { acceptOffer, listFreeAgents, makeOffer } from "@/systems/free-agency";
import { getActionBlockReason } from "@/systems/league-rules";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  LEAGUE_PHASE_IDS,
  getActivePhaseId,
  type LeaguePhaseId,
} from "@/systems/phase-engine";
import {
  getPlayerReleaseBlockReason,
  releasePlayerUnderContract,
} from "@/systems/player-release";
import { getContractSigningYear } from "@/systems/salary-cap";
import { SUPERMAX_CAP_FRACTION, vetMinSalary } from "@/systems/salary-scale";
import { evaluateTradeOffer } from "@/systems/trades/trade-evaluation";
import { executeTrade } from "@/systems/trades/trade-execution";
import {
  OffseasonPhaseStuckError,
  advanceThroughPhase,
  createOffseasonLeague,
  type OffseasonUserAction,
  type UserActionOutcome,
  type UserManagement,
} from "./driver";
import {
  collectOffseasonInvariantIssues,
  type OffseasonInvariantIssue,
} from "./invariants";
import {
  diffOffseasonSnapshots,
  snapshotOffseason,
  stateForComparison,
  type OffseasonSnapshot,
} from "./snapshot";

// ---------------------------------------------------------------------------
// Options

export type SoakProfile = "auto" | "busy";
export type SoakProfileOption = SoakProfile | "both";

export type SoakReplay = {
  seed: number;
  season: number;
  phase: LeaguePhaseId;
};

export type SoakOptions = {
  seeds: number;
  seasons: number;
  seedStart: number;
  profile: SoakProfileOption;
  maxSeasonMs: number;
  maxPhaseDays: number;
  replay: SoakReplay | null;
  failFast: boolean;
  verifyDeterminism: boolean;
  /** Busy profile also offers free agents salaries outside league bounds. */
  probeSalaryBounds: boolean;
};

export const SOAK_DEFAULTS: SoakOptions = {
  seeds: 8,
  seasons: 12,
  seedStart: 1,
  profile: "both",
  maxSeasonMs: 120_000,
  maxPhaseDays: 400,
  replay: null,
  failFast: false,
  verifyDeterminism: false,
  probeSalaryBounds: false,
};

const PHASE_PREFIXES = [
  "",
  "offseason.",
  "preseason.",
  "postseason.",
  "end_of_season.",
] as const;

/** `free-agency`, `free_agency` and `offseason.free_agency` all resolve. */
export function normalizePhaseName(input: string): LeaguePhaseId {
  const name = input.trim().toLowerCase().replace(/-/g, "_");
  for (const prefix of PHASE_PREFIXES) {
    const candidate = `${prefix}${name}`;
    const found = LEAGUE_PHASE_IDS.find((id) => id === candidate);
    if (found !== undefined) return found;
  }
  throw new Error(
    `Unknown phase "${input}". Known: ${LEAGUE_PHASE_IDS.join(", ")}.`,
  );
}

function positiveInt(flag: string, raw: string | undefined): number {
  const value = Number(raw);
  if (raw === undefined || !Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} needs a positive integer (got "${raw ?? ""}").`);
  }
  return value;
}

/** Parses CLI arguments (without node and script path). Throws on bad input. */
export function parseSoakArgs(argv: readonly string[]): SoakOptions {
  const options: SoakOptions = { ...SOAK_DEFAULTS };
  let seed: number | undefined;
  let season: number | undefined;
  let phase: LeaguePhaseId | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}".`);
    }
    const eq = token.indexOf("=");
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    const takeValue = (): string | undefined => {
      if (inline !== undefined) return inline;
      index += 1;
      return argv[index];
    };
    switch (flag) {
      case "--seeds":
        options.seeds = positiveInt(flag, takeValue());
        break;
      case "--seasons":
        options.seasons = positiveInt(flag, takeValue());
        break;
      case "--seed-start":
        options.seedStart = positiveInt(flag, takeValue());
        break;
      case "--max-season-ms":
        options.maxSeasonMs = positiveInt(flag, takeValue());
        break;
      case "--max-phase-days":
        options.maxPhaseDays = positiveInt(flag, takeValue());
        break;
      case "--seed":
        seed = positiveInt(flag, takeValue());
        break;
      case "--season":
        season = positiveInt(flag, takeValue());
        break;
      case "--phase": {
        const raw = takeValue();
        if (raw === undefined) throw new Error("--phase needs a value.");
        phase = normalizePhaseName(raw);
        break;
      }
      case "--profile": {
        const raw = takeValue();
        if (raw !== "auto" && raw !== "busy" && raw !== "both") {
          throw new Error(
            `--profile must be auto, busy or both (got "${raw ?? ""}").`,
          );
        }
        options.profile = raw;
        break;
      }
      case "--fail-fast":
        options.failFast = true;
        break;
      case "--probe-salary-bounds":
        options.probeSalaryBounds = true;
        break;
      case "--verify-determinism":
        options.verifyDeterminism = true;
        break;
      default:
        throw new Error(`Unknown flag "${flag}".`);
    }
  }

  const replayFlags = [seed, season, phase].filter((v) => v !== undefined);
  if (replayFlags.length > 0) {
    if (replayFlags.length !== 3) {
      throw new Error("Replay needs --seed, --season and --phase together.");
    }
    options.replay = { seed: seed!, season: season!, phase: phase! };
  }
  return options;
}

export function profilesFor(option: SoakProfileOption): SoakProfile[] {
  return option === "both" ? ["auto", "busy"] : [option];
}

// ---------------------------------------------------------------------------
// Failures

export type SoakFailureKind =
  | "invariant"
  | "action_invariant"
  | "action_mutation"
  | "illegal_applied"
  | "exception"
  | "stuck"
  | "slow"
  | "nondeterminism";

export type SoakFailure = {
  kind: SoakFailureKind;
  seed: number;
  profile: SoakProfile;
  seasonIndex: number;
  seasonYear: number;
  /** Phase being run (or the slowest phase for "slow"). */
  phaseId: LeaguePhaseId;
  summary: string;
  /** The run used --probe-salary-bounds. */
  probeSalaryBounds?: boolean;
  issues?: OffseasonInvariantIssue[];
  /** Snapshot diff from the last good boundary to the failing one. */
  diff?: string[];
  error?: string;
  stack?: string;
};

export function replayCommand(failure: SoakFailure): string {
  const phase = failure.phaseId.replace(/^[a-z_]+\./, "").replace(/_/g, "-");
  return (
    `npm run test:offseason-soak -- --seed ${failure.seed} ` +
    `--profile ${failure.profile} --season ${failure.seasonIndex} ` +
    `--phase ${phase}` +
    (failure.probeSalaryBounds ? " --probe-salary-bounds" : "")
  );
}

export function formatFailure(failure: SoakFailure): string {
  const lines = [
    `FAILURE [${failure.kind}] seed ${failure.seed}, profile ${failure.profile}, ` +
      `season ${failure.seasonIndex} (${failure.seasonYear}), phase ${failure.phaseId}`,
    `  ${failure.summary}`,
  ];
  if (failure.issues !== undefined && failure.issues.length > 0) {
    lines.push("  broken invariants:");
    for (const issue of failure.issues) {
      lines.push(`    [${issue.code}] ${issue.message}`);
    }
  }
  if (failure.diff !== undefined) {
    lines.push("  snapshot diff (last good boundary -> failing state):");
    lines.push(
      ...(failure.diff.length === 0
        ? ["    (no change)"]
        : failure.diff.map((line) => `    ${line}`)),
    );
  }
  if (failure.error !== undefined) {
    lines.push(`  error: ${failure.error}`);
  }
  if (failure.stack !== undefined) {
    lines.push(
      ...failure.stack.split("\n").map((line) => `    ${line.trimEnd()}`),
    );
  }
  lines.push(`  replay: ${replayCommand(failure)}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Busy-user script

export type BusyKind = "extend" | "release" | "sign_fa" | "trade";

const BUSY_KINDS: readonly BusyKind[] = [
  "extend",
  "release",
  "sign_fa",
  "trade",
];

type ActionContext = {
  /** Set when the action deliberately aims at something that must fail. */
  expectIllegal: boolean;
  /** Also try free-agent salaries outside the league minimum and maximum. */
  probeSalaryBounds: boolean;
};

export type BusyAction = {
  label: string;
  onDay: number;
  run: (
    state: GameState,
    rng: Rng,
    context: ActionContext,
  ) => GameState | SystemResult;
};

export function busyKindOf(label: string): BusyKind {
  return label.split("#")[0] as BusyKind;
}

function userTeamId(state: GameState): TeamId {
  return state.user.activeOwnerTeamId;
}

function rosterOf(state: GameState, teamId: TeamId): PlayerId[] {
  return [...(state.world.teams[teamId]?.roster ?? [])];
}

function retiredPlayers(state: GameState): PlayerId[] {
  return Object.values(state.world.players)
    .filter((player) => player.retired === true)
    .map((player) => player.id)
    .sort();
}

function otherTeams(state: GameState): TeamId[] {
  const own = userTeamId(state);
  return (Object.keys(state.world.teams).sort() as TeamId[]).filter(
    (id) => id !== own,
  );
}

function salaryRange(state: GameState): { min: number; max: number } {
  const cap = getLeagueSalaryCap(state);
  return {
    min: vetMinSalary(cap),
    max: Math.round((cap * SUPERMAX_CAP_FRACTION) / 1_000) * 1_000,
  };
}

function pickSalary(state: GameState, rng: Rng, illegal: boolean): number {
  const { min, max } = salaryRange(state);
  if (illegal) return rng.pick([min - 1_000, max + 1_000, 0, min + 0.5]);
  const span = Math.max(1, Math.floor((max * 0.6 - min) / 1_000));
  return min + rng.nextInt(0, span) * 1_000;
}

function runExtend(
  state: GameState,
  rng: Rng,
  context: ActionContext,
): SystemResult {
  const teamId = userTeamId(state);
  const illegal = rng.chance(0.35);
  const retired = retiredPlayers(state);
  const foreign = otherTeams(state).flatMap((id) => rosterOf(state, id));
  const own = rosterOf(state, teamId);
  const eligible = own.filter(
    (playerId) => getExtensionBlockReason(state, { playerId, teamId }) === null,
  );

  let playerId: PlayerId;
  let years = rng.nextInt(1, 5);
  let salary = pickSalary(state, rng, false);
  if (illegal) {
    const pool = rng.chance(0.5) && retired.length > 0 ? retired : foreign;
    playerId = rng.pick(pool);
    context.expectIllegal = true;
  } else if (eligible.length > 0 && rng.chance(0.85)) {
    playerId = rng.pick(eligible);
    if (rng.chance(0.25)) {
      // Bad terms on a player who is otherwise eligible.
      salary = pickSalary(state, rng, true);
      years = rng.pick([0, 6, years]);
      context.expectIllegal =
        salary !== Math.round(salary) || years < 1 || years > 5;
    }
  } else {
    playerId = rng.pick(own);
  }

  const ruleBlock = getActionBlockReason(state, {
    kind: "contract_extension",
    playerId,
    teamId,
  });
  if (ruleBlock) throw new Error(ruleBlock);
  const terms = { years, salary };
  const blocked = getExtensionBlockReason(state, { playerId, teamId, terms });
  if (blocked) throw new Error(blocked);
  return offerContractExtension(state, { playerId, teamId, terms }).result;
}

function runRelease(
  state: GameState,
  rng: Rng,
  context: ActionContext,
): SystemResult {
  const teamId = userTeamId(state);
  const illegal = rng.chance(0.3);
  const retired = retiredPlayers(state);
  let playerId: PlayerId;
  if (illegal) {
    const foreign = otherTeams(state).flatMap((id) => rosterOf(state, id));
    playerId = rng.pick(
      rng.chance(0.4) && retired.length > 0 ? retired : foreign,
    );
    context.expectIllegal = true;
  } else {
    playerId = rng.pick(rosterOf(state, teamId));
  }
  const mode = rng.pick(["waive", "buyout"] as const);
  const ruleBlock = getActionBlockReason(state, {
    kind: "player_release",
    playerId,
    teamId,
  });
  if (ruleBlock) throw new Error(ruleBlock);
  const blocked = getPlayerReleaseBlockReason(state, { playerId, teamId });
  if (blocked) throw new Error(blocked);
  return releasePlayerUnderContract(state, { playerId, teamId, mode });
}

function runSignFreeAgent(
  state: GameState,
  rng: Rng,
  context: ActionContext,
): SystemResult {
  const teamId = userTeamId(state);
  const illegal = rng.chance(0.3);
  const retired = retiredPlayers(state);
  const pool = listFreeAgents(state).playerIds;
  let playerId: PlayerId;
  if (illegal) {
    const rostered = Object.values(state.world.teams).flatMap((t) => t.roster);
    playerId = rng.pick(
      rng.chance(0.5) && retired.length > 0 ? retired : rostered,
    );
    context.expectIllegal = true;
  } else {
    if (pool.length === 0) throw new Error("No free agents.");
    playerId = rng.pick(pool);
  }
  const ruleBlock = getActionBlockReason(state, {
    kind: "sign_free_agent",
    playerId,
    teamId,
  });
  if (ruleBlock) throw new Error(ruleBlock);
  if (!listFreeAgents(state).playerIds.includes(playerId)) {
    throw new Error("Player is not an available free agent.");
  }

  const year = getContractSigningYear(state);
  const cap = getLeagueSalaryCap(state);
  const { min, max } = salaryRange(state);
  const inBounds = [
    min,
    min,
    min + rng.nextInt(0, 40) * 25_000,
    Math.min(max, Math.round(cap * 0.15)),
  ];
  const salary = rng.pick(
    context.probeSalaryBounds
      ? [...inBounds, Math.max(1, min - 50_000), max + 1_000_000]
      : inBounds,
  );
  const years = rng.nextInt(1, 4);
  const salaryByYear: Record<string, number> = {};
  for (let y = year; y < year + years; y += 1) salaryByYear[String(y)] = salary;

  const serial = Object.keys(state.business.freeAgency.offers).length;
  const tag = `soak_${serial}_${state.world.calendar.currentDate}_${playerId}`;
  const offerId = asOfferId(`offer_${tag}`);
  const terms = {
    id: asContractId(`contract_${tag}`),
    playerId,
    teamId,
    startYear: year,
    endYear: year + years - 1,
    salaryByYear,
  };
  // Same contract shape the engine builds; throws on malformed terms.
  createContract(terms);
  const offered = makeOffer(state, { id: offerId, playerId, teamId, terms });
  const accepted = acceptOffer(offered.state, offerId);
  return {
    state: accepted.state,
    events: [...offered.events, ...accepted.events],
  };
}

function proposalFor(
  state: GameState,
  rng: Rng,
  counterpart: TeamId,
): TradeProposal {
  const own = userTeamId(state);
  const picks = (teamId: TeamId): DraftPick[] =>
    Object.values(state.world.draftPicks)
      .filter(
        (pick) => pick.ownerTeamId === teamId && pick.status === "available",
      )
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  const sample = <T>(items: readonly T[], count: number): T[] => {
    const left = [...items];
    const out: T[] = [];
    while (out.length < count && left.length > 0) {
      out.push(left.splice(rng.nextInt(0, left.length - 1), 1)[0]!);
    }
    return out;
  };
  const side = (teamId: TeamId) => ({
    teamId,
    playerIds: sample(rosterOf(state, teamId), rng.nextInt(0, 2)),
    draftPickIds: rng.chance(0.3)
      ? sample(picks(teamId), 1).map((p) => p.id)
      : [],
  });
  return { sideA: side(own), sideB: side(counterpart) };
}

function runTrade(
  state: GameState,
  rng: Rng,
  context: ActionContext,
): SystemResult {
  const own = userTeamId(state);
  const counterparts = otherTeams(state);
  const illegal = rng.chance(0.3);

  if (illegal) {
    const retired = retiredPlayers(state);
    const used = Object.values(state.world.draftPicks)
      .filter((pick) => pick.status === "used")
      .map((pick) => pick.id)
      .sort();
    const base = proposalFor(state, rng, rng.pick(counterparts));
    const kind = rng.nextInt(0, 2);
    if (kind === 0 && retired.length > 0) {
      base.sideA.playerIds = [rng.pick(retired)];
      context.expectIllegal = true;
    } else if (kind === 1 && used.length > 0) {
      base.sideB.draftPickIds = [rng.pick(used)];
      context.expectIllegal = true;
    } else {
      // Mirror trade with himself: both sides the same team.
      base.sideB = { ...base.sideB, teamId: own };
      context.expectIllegal = true;
    }
    const executed = executeTrade(state, base);
    if (!executed.success) {
      throw new Error(
        executed.validation.errors[0]?.message ?? "Invalid trade.",
      );
    }
    return { state: executed.state, events: executed.events };
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const counterpart = rng.pick(counterparts);
    const proposal = proposalFor(state, rng, counterpart);
    const total =
      proposal.sideA.playerIds.length +
      proposal.sideA.draftPickIds.length +
      proposal.sideB.playerIds.length +
      proposal.sideB.draftPickIds.length;
    if (total === 0) continue;
    const ruleBlock = getActionBlockReason(state, {
      kind:
        proposal.sideA.draftPickIds.length +
          proposal.sideB.draftPickIds.length >
        0
          ? "trade"
          : "player_trade",
      proposal,
    });
    if (ruleBlock) throw new Error(ruleBlock);
    if (!evaluateTradeOffer(state, counterpart, proposal).accepted) continue;
    const executed = executeTrade(state, proposal);
    if (!executed.success) {
      throw new Error(
        executed.validation.errors[0]?.message ?? "Trade validation failed.",
      );
    }
    return { state: executed.state, events: executed.events };
  }
  throw new Error("No trade the counterpart would accept.");
}

const BUSY_RUNNERS: Record<
  BusyKind,
  (state: GameState, rng: Rng, context: ActionContext) => SystemResult
> = {
  extend: runExtend,
  release: runRelease,
  sign_fa: runSignFreeAgent,
  trade: runTrade,
};

/**
 * The busy user's script for one phase. A pure function of its arguments:
 * the same seed, phase index and phase always give the same labels and days,
 * and each action draws from its own seeded stream (never the engine's).
 */
export function buildBusyActions(
  seed: number,
  phaseIndex: number,
  phaseId: LeaguePhaseId,
): BusyAction[] {
  const planner = createSeededRng(seed * 7919 + phaseIndex);
  const actions: BusyAction[] = [];
  BUSY_KINDS.forEach((kind, kindIndex) => {
    const count =
      (planner.chance(0.75) ? 1 : 0) + (planner.chance(0.3) ? 1 : 0);
    for (let index = 0; index < count; index += 1) {
      const onDay = planner.chance(0.6) ? 0 : planner.nextInt(1, 20);
      const streamSeed = normalizeSeed(
        `${seed}:${phaseIndex}:${phaseId}:${kindIndex}:${index}`,
      );
      const stream = createSeededRng(streamSeed);
      actions.push({
        label: `${kind}#${index}`,
        onDay,
        run: (state, _engineRng, context) =>
          BUSY_RUNNERS[kind](state, stream, context),
      });
    }
  });
  return actions;
}

// ---------------------------------------------------------------------------
// Running a case

export type ActionCounts = {
  applied: number;
  rejected: number;
  not_run: number;
};
export type ActionStats = Record<BusyKind, ActionCounts>;

export function emptyActionStats(): ActionStats {
  const stats = {} as ActionStats;
  for (const kind of BUSY_KINDS) {
    stats[kind] = { applied: 0, rejected: 0, not_run: 0 };
  }
  return stats;
}

export function mergeActionStats(into: ActionStats, from: ActionStats): void {
  for (const kind of BUSY_KINDS) {
    for (const key of ["applied", "rejected", "not_run"] as const) {
      into[kind][key] += from[kind][key];
    }
  }
}

export type SoakCaseInput = {
  seed: number;
  profile: SoakProfile;
  seasons: number;
  maxSeasonMs: number;
  maxPhaseDays: number;
  probeSalaryBounds?: boolean;
  /** Stop once this season's phase has run and been checked. */
  stopAfter?: { season: number; phase: LeaguePhaseId };
  /** Called with the state each time a season completes. */
  onSeasonEnd?: (state: GameState, seasonIndex: number) => void;
  log?: (line: string) => void;
  /** Log every phase and its user actions. */
  verbose?: boolean;
  now?: () => number;
};

export type SoakCaseResult = {
  seed: number;
  profile: SoakProfile;
  seasonsCompleted: number;
  totalMs: number;
  seasonMs: number[];
  failures: SoakFailure[];
  actionStats: ActionStats;
  /** Set when `stopAfter` was reached. */
  stopped: boolean;
};

function managementFor(profile: SoakProfile): UserManagement {
  return profile === "busy" ? "manual" : "delegated";
}

function issueKey(issue: OffseasonInvariantIssue): string {
  return `${issue.code}|${issue.message}`;
}

function errorFields(error: unknown): { error: string; stack?: string } {
  if (error instanceof Error) {
    return { error: `${error.name}: ${error.message}`, stack: error.stack };
  }
  return { error: String(error) };
}

function safeSnapshot(state: GameState): OffseasonSnapshot | null {
  try {
    return snapshotOffseason(state);
  } catch {
    return null;
  }
}

/** Runs one seed/profile for up to `seasons` seasons. Never throws. */
export function runSoakCase(input: SoakCaseInput): SoakCaseResult {
  const now = input.now ?? Date.now;
  const log = input.log ?? (() => undefined);
  const caseStart = now();
  const failures: SoakFailure[] = [];
  const stats = emptyActionStats();
  const seasonMs: number[] = [];
  let seasonsCompleted = 0;
  let stopped = false;

  let state = createOffseasonLeague(input.seed, managementFor(input.profile));
  let lastGood = safeSnapshot(state);
  let seasonIndex = 1;
  let phaseIndex = 0;
  let seasonStart = now();
  let phaseMs: { phaseId: LeaguePhaseId; ms: number }[] = [];
  let checkMs = 0;

  const fail = (
    partial: Omit<
      SoakFailure,
      "seed" | "profile" | "seasonIndex" | "seasonYear"
    >,
    at: GameState,
  ) => {
    failures.push({
      seed: input.seed,
      profile: input.profile,
      seasonIndex,
      seasonYear: at.competition.season.year,
      probeSalaryBounds: input.probeSalaryBounds === true,
      ...partial,
    });
  };

  const startIssues = collectOffseasonInvariantIssues(state);
  if (startIssues.length > 0) {
    fail(
      {
        kind: "invariant",
        phaseId: getActivePhaseId(state),
        summary: "Invariants broken at the start state.",
        issues: startIssues,
      },
      state,
    );
    return finish();
  }

  while (seasonIndex <= input.seasons) {
    const phaseId = getActivePhaseId(state);
    const phaseStart = now();
    const pendingFailures: Omit<
      SoakFailure,
      "seed" | "profile" | "seasonIndex" | "seasonYear"
    >[] = [];

    const userActions: OffseasonUserAction[] =
      input.profile === "busy"
        ? instrument(
            buildBusyActions(input.seed, phaseIndex, phaseId),
            phaseId,
            pendingFailures,
            input.probeSalaryBounds === true,
          )
        : [];

    if (input.verbose) {
      const snap = safeSnapshot(state);
      log(
        `  [phase ${phaseId}] start: ${snap === null ? "(snapshot failed)" : JSON.stringify(snap)}`,
      );
    }

    let result;
    try {
      result = advanceThroughPhase(state, phaseId, {
        userActions,
        autoUser: true,
        maxDays: input.maxPhaseDays,
      });
    } catch (error) {
      fail(
        error instanceof OffseasonPhaseStuckError
          ? {
              kind: "stuck",
              phaseId,
              summary: error.message,
              ...errorFields(error),
            }
          : {
              kind: "exception",
              phaseId,
              summary: "The engine threw while running the phase.",
              ...errorFields(error),
            },
        state,
      );
      return finish();
    }

    countOutcomes(stats, result.actions);
    if (input.verbose) {
      for (const action of result.actions) {
        log(
          `  [action ${action.label}] day ${action.day}: ${action.status}` +
            (action.error ? ` (${action.error})` : ""),
        );
      }
    }
    for (const pending of pendingFailures) fail(pending, state);

    const previous = state;
    state = result.state;
    phaseIndex += 1;
    phaseMs.push({ phaseId, ms: now() - phaseStart });

    const checkStart = now();
    const issues = collectOffseasonInvariantIssues(state, { previous });
    checkMs += now() - checkStart;
    if (issues.length > 0) {
      const snapshot = safeSnapshot(state);
      fail(
        {
          kind: "invariant",
          phaseId,
          summary: `Invariants broken after ${phaseId} (now ${getActivePhaseId(state)}).`,
          issues,
          diff:
            lastGood !== null && snapshot !== null
              ? diffOffseasonSnapshots(lastGood, snapshot)
              : undefined,
        },
        state,
      );
      return finish();
    }
    if (failures.length > 0 && failures.some((f) => f.kind !== "slow")) {
      // An action broke a rule but the boundary is fine: keep going so one
      // run can surface more, but the case already counts as failed.
    }
    lastGood = safeSnapshot(state);

    if (
      input.stopAfter !== undefined &&
      input.stopAfter.season === seasonIndex &&
      input.stopAfter.phase === phaseId
    ) {
      stopped = true;
      return finish();
    }

    if (getActivePhaseId(state) === "preseason.preparation") {
      const elapsed = now() - seasonStart;
      seasonMs.push(elapsed);
      seasonsCompleted += 1;
      input.onSeasonEnd?.(state, seasonIndex);
      log(
        `  season ${seasonIndex}/${input.seasons} (${state.competition.season.year}) done in ${elapsed} ms (boundary checks ${checkMs} ms)`,
      );
      if (elapsed > input.maxSeasonMs) {
        const slowest = [...phaseMs].sort((a, b) => b.ms - a.ms)[0]!;
        fail(
          {
            kind: "slow",
            phaseId: slowest.phaseId,
            summary:
              `Season took ${elapsed} ms (limit ${input.maxSeasonMs}); ` +
              `slowest phase ${slowest.phaseId} took ${slowest.ms} ms.`,
          },
          state,
        );
      }
      seasonIndex += 1;
      seasonStart = now();
      phaseMs = [];
      checkMs = 0;
    }
  }
  return finish();

  function finish(): SoakCaseResult {
    return {
      seed: input.seed,
      profile: input.profile,
      seasonsCompleted,
      totalMs: now() - caseStart,
      seasonMs,
      failures,
      actionStats: stats,
      stopped,
    };
  }
}

function countOutcomes(stats: ActionStats, outcomes: UserActionOutcome[]) {
  for (const outcome of outcomes) {
    stats[busyKindOf(outcome.label)][outcome.status] += 1;
  }
}

function isGameState(value: GameState | SystemResult): value is GameState {
  return "meta" in value;
}

/**
 * Wraps busy actions with the soak's own checks: a thrown action must not
 * have touched the state it was given, an applied one must not break the
 * invariants (new issues only) and a deliberately illegal one must not apply.
 */
function instrument(
  actions: BusyAction[],
  phaseId: LeaguePhaseId,
  sink: Omit<SoakFailure, "seed" | "profile" | "seasonIndex" | "seasonYear">[],
  probe: boolean,
): OffseasonUserAction[] {
  return actions.map((action) => ({
    label: action.label,
    onDay: action.onDay,
    run: (state, rng) => {
      const before = structuredClone(state);
      const context: ActionContext = {
        expectIllegal: false,
        probeSalaryBounds: probe,
      };
      let output: GameState | SystemResult;
      try {
        output = action.run(state, rng, context);
      } catch (error) {
        if (!isDeepStrictEqual(state, before)) {
          sink.push({
            kind: "action_mutation",
            phaseId,
            summary: `Rejected action ${action.label} mutated the state it was given.`,
            ...errorFields(error),
          });
        }
        throw error;
      }
      if (!isDeepStrictEqual(state, before)) {
        sink.push({
          kind: "action_mutation",
          phaseId,
          summary: `Applied action ${action.label} mutated its input state instead of returning a new one.`,
        });
      }
      if (context.expectIllegal) {
        sink.push({
          kind: "illegal_applied",
          phaseId,
          summary: `Deliberately illegal action ${action.label} was applied.`,
        });
      }
      const next = isGameState(output) ? output : output.state;
      const after = collectOffseasonInvariantIssues(next);
      if (after.length > 0) {
        const known = new Set(
          collectOffseasonInvariantIssues(before).map(issueKey),
        );
        const fresh = after.filter((issue) => !known.has(issueKey(issue)));
        if (fresh.length > 0) {
          sink.push({
            kind: "action_invariant",
            phaseId,
            summary: `Applied action ${action.label} broke invariants.`,
            issues: fresh,
          });
        }
      }
      return output;
    },
  }));
}

/** Stable digest of a state, ignoring random ids and timestamps. */
export function digestState(state: GameState): string {
  return createHash("sha256")
    .update(JSON.stringify(stateForComparison(state)))
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Whole run

export type SoakSummary = {
  cases: SoakCaseResult[];
  failures: SoakFailure[];
  totalMs: number;
  actionStats: ActionStats;
  seasonsCompleted: number;
};

export type SoakRunIo = {
  log: (line: string) => void;
  now?: () => number;
};

/** Runs the same case twice and reports the first season that differs. */
export function verifyDeterminism(
  base: Omit<SoakCaseInput, "onSeasonEnd">,
): SoakFailure | null {
  const collect = () => {
    const digests: string[] = [];
    const years: number[] = [];
    const result = runSoakCase({
      ...base,
      onSeasonEnd: (state) => {
        digests.push(digestState(state));
        years.push(state.competition.season.year);
      },
    });
    return { digests, years, result };
  };
  const first = collect();
  const second = collect();
  const length = Math.max(first.digests.length, second.digests.length);
  for (let index = 0; index < length; index += 1) {
    if (first.digests[index] !== second.digests[index]) {
      return {
        kind: "nondeterminism",
        seed: base.seed,
        profile: base.profile,
        seasonIndex: index + 1,
        seasonYear: first.years[index] ?? 0,
        phaseId: "preseason.preparation",
        summary: `Two runs of the same seed and profile differ at the end of season ${index + 1}.`,
      };
    }
  }
  return null;
}

export function runSoak(options: SoakOptions, io: SoakRunIo): SoakSummary {
  const now = io.now ?? Date.now;
  const start = now();
  const profiles = profilesFor(options.profile);
  const cases: SoakCaseResult[] = [];
  const failures: SoakFailure[] = [];
  const actionStats = emptyActionStats();

  const seeds = options.replay
    ? [options.replay.seed]
    : Array.from({ length: options.seeds }, (_, i) => options.seedStart + i);

  outer: for (const seed of seeds) {
    for (const profile of profiles) {
      io.log(`seed ${seed} profile ${profile}`);
      const base = {
        seed,
        profile,
        seasons: options.replay ? options.replay.season : options.seasons,
        maxSeasonMs: options.maxSeasonMs,
        maxPhaseDays: options.maxPhaseDays,
        probeSalaryBounds: options.probeSalaryBounds,
        log: io.log,
        now,
      };
      const result = runSoakCase({
        ...base,
        stopAfter: options.replay ?? undefined,
        verbose: options.replay !== null,
      });
      cases.push(result);
      failures.push(...result.failures);
      mergeActionStats(actionStats, result.actionStats);
      for (const failure of result.failures) {
        io.log(formatFailure(failure));
      }
      if (options.replay && result.failures.length === 0) {
        io.log(
          result.stopped
            ? `Replay reached ${options.replay.phase} in season ${options.replay.season} with no failure.`
            : `Replay did not reach ${options.replay.phase} in season ${options.replay.season}.`,
        );
      }
      if (options.failFast && result.failures.length > 0) break outer;
    }
  }

  if (options.verifyDeterminism && !options.replay) {
    const seed = options.seedStart;
    for (const profile of profiles) {
      if (options.failFast && failures.length > 0) break;
      io.log(`verifying determinism: seed ${seed} profile ${profile}`);
      const failure = verifyDeterminism({
        seed,
        profile,
        seasons: options.seasons,
        maxSeasonMs: options.maxSeasonMs,
        maxPhaseDays: options.maxPhaseDays,
        probeSalaryBounds: options.probeSalaryBounds,
        now,
      });
      if (failure) {
        failures.push(failure);
        io.log(formatFailure(failure));
      } else {
        io.log("  deterministic.");
      }
    }
  }

  return {
    cases,
    failures,
    totalMs: now() - start,
    actionStats,
    seasonsCompleted: cases.reduce((sum, c) => sum + c.seasonsCompleted, 0),
  };
}

export function formatSummary(summary: SoakSummary): string[] {
  const lines = ["", "Offseason soak summary", "----------------------"];
  lines.push("seed  profile  seasons  time(ms)  failures");
  for (const result of summary.cases) {
    lines.push(
      `${String(result.seed).padEnd(5)} ${result.profile.padEnd(8)} ` +
        `${String(result.seasonsCompleted).padEnd(8)} ${String(result.totalMs).padEnd(9)} ${result.failures.length}`,
    );
  }
  lines.push("");
  lines.push("busy user actions  applied  rejected  not_run");
  for (const kind of BUSY_KINDS) {
    const counts = summary.actionStats[kind];
    lines.push(
      `${kind.padEnd(18)} ${String(counts.applied).padEnd(8)} ${String(counts.rejected).padEnd(9)} ${counts.not_run}`,
    );
  }
  const caseMs = summary.cases.reduce((sum, c) => sum + c.totalMs, 0);
  const perSeason =
    summary.seasonsCompleted === 0
      ? 0
      : Math.round(caseMs / summary.seasonsCompleted);
  lines.push("");
  lines.push(
    `cases ${summary.cases.length}, seasons ${summary.seasonsCompleted}, ` +
      `run time ${(summary.totalMs / 1000).toFixed(1)} s (${perSeason} ms per season), ` +
      `failures ${summary.failures.length}`,
  );
  return lines;
}

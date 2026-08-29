/**
 * Substitution decision engine: forced vs tactical paths.
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import type { RotationEntry } from "@/domain/entities/team-roster-management";
import type { PlayerId, TeamId } from "@/domain/ids";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import {
  buildRotationMap,
  playerCanCoverSlot,
  scoreLineupViability,
  validateLineup,
} from "@/systems/rotation/lineup-validation";
import {
  effectiveMaximum,
  minuteBalanceInScore,
  minuteBalanceOutScore,
} from "@/systems/rotation/minute-balancing";
import {
  computeFatigue,
  isFatiguedForSubstitution,
} from "@/systems/rotation/rotation-fatigue";
import {
  foulTroubleLevel,
  foulTroubleSitScore,
  isFouledOut,
} from "@/systems/rotation/rotation-foul-trouble";
import type { RotationGameContext } from "@/systems/rotation/rotation-game-context";
import type { RotationPlan } from "@/systems/rotation/rotation-planner";
import type { RotationTraceReason } from "@/systems/rotation/rotation-trace";

export type SubstitutionCheckpoint =
  | "period_start"
  | "halftime"
  | "rotation_window"
  | "foul_trouble"
  | "foul_out"
  | "injury"
  | "blowout_relief";

export type SubstitutionDecision = {
  playerOutId: PlayerId;
  playerInId: PlayerId;
  forced: boolean;
  reason: RotationTraceReason;
  detail?: string;
};

export type SubstitutionEngineResult = {
  onCourt: Player[];
  slots: PlayerPosition[];
  decisions: SubstitutionDecision[];
};

export type SubstitutionEngineInput = {
  teamId: TeamId;
  onCourt: Player[];
  slots: PlayerPosition[];
  benchPool: Player[];
  plan: RotationPlan;
  secondsOnCourt: ReadonlyMap<string, number>;
  continuousSecondsOnCourt: ReadonlyMap<string, number>;
  lastSubElapsedSeconds: ReadonlyMap<string, number>;
  foulsByPlayerId: ReadonlyMap<string, number>;
  fouledOutIds: ReadonlySet<string>;
  unavailableIds: ReadonlySet<string>;
  fatigueByPlayerId: ReadonlyMap<string, number>;
  elapsedGameSeconds: number;
  context: RotationGameContext;
  checkpoint: SubstitutionCheckpoint;
  /** Remaining regulation+OT estimate in minutes. */
  remainingGameMinutes: number;
};

function entryFor(
  plan: RotationPlan,
  playerId: string,
): RotationEntry | undefined {
  return plan.rotationByPlayerId.get(playerId);
}

function actualMinutes(
  secondsOnCourt: ReadonlyMap<string, number>,
  playerId: string,
): number {
  return (secondsOnCourt.get(playerId) ?? 0) / 60;
}

function isEligibleToEnter(input: {
  player: Player;
  onCourtIds: Set<string>;
  unavailableIds: ReadonlySet<string>;
  fouledOutIds: ReadonlySet<string>;
  plan: RotationPlan;
  allowEmergency: boolean;
}): boolean {
  if (input.onCourtIds.has(input.player.id)) {
    return false;
  }
  if (input.unavailableIds.has(input.player.id)) {
    return false;
  }
  if (input.fouledOutIds.has(input.player.id)) {
    return false;
  }
  const entry = entryFor(input.plan, input.player.id);
  if (entry?.rotationStatus === "inactive") {
    return input.allowEmergency;
  }
  if (entry?.rotationStatus === "emergency") {
    return input.allowEmergency;
  }
  // Active or no entry (fallback)
  return (
    input.plan.activePlayerIds.includes(input.player.id) ||
    input.allowEmergency
  );
}

function pickBestReplacement(input: {
  slot: PlayerPosition;
  outPlayer: Player;
  candidates: Player[];
  plan: RotationPlan;
  secondsOnCourt: ReadonlyMap<string, number>;
  context: RotationGameContext;
  elapsedGameSeconds: number;
  remainingGameMinutes: number;
  onCourt: Player[];
}): Player | null {
  let best: Player | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of input.candidates) {
    const entry = entryFor(input.plan, candidate.id);
    const positionFit = playerCanCoverSlot(candidate, input.slot, entry)
      ? 4
      : entry != null &&
          [...(entry.secondaryPositions ?? []), candidate.position].length > 0
        ? 1
        : 0;

    const inScore = entry
      ? minuteBalanceInScore({
          entry,
          actualMinutes: actualMinutes(input.secondsOnCourt, candidate.id),
          elapsedGameSeconds: input.elapsedGameSeconds,
          context: input.context,
          remainingGameMinutes: input.remainingGameMinutes,
        })
      : 0;

    const priorityBoost = entry
      ? (6 - entry.rotationPriority) * 0.5
      : 0;

    // Closing lineup preference in late close / OT
    const closingBoost =
      input.context.closingLineupWeight > 1 &&
      input.plan.closingLineupIds.includes(candidate.id)
        ? 3 * input.context.closingLineupWeight
        : 0;

    // Soft viability of resulting lineup
    const trial = input.onCourt.map((p) =>
      p.id === input.outPlayer.id ? candidate : p,
    );
    const viability = scoreLineupViability(trial, input.plan.rotationByPlayerId);

    const score =
      positionFit + inScore + priorityBoost + closingBoost + viability * 0.05;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function applySwap(
  onCourt: Player[],
  slots: PlayerPosition[],
  outIndex: number,
  incoming: Player,
): { onCourt: Player[]; slots: PlayerPosition[] } {
  const nextOnCourt = [...onCourt];
  nextOnCourt[outIndex] = incoming;
  const nextSlots = [...slots];
  return { onCourt: nextOnCourt, slots: nextSlots };
}

/**
 * Forced substitutions: unlimited until lineup is legal.
 */
function applyForcedSubstitutions(
  input: SubstitutionEngineInput,
): SubstitutionEngineResult {
  let onCourt = [...input.onCourt];
  let slots = [...input.slots];
  const decisions: SubstitutionDecision[] = [];
  const onCourtIds = () => new Set(onCourt.map((p) => p.id));

  const mustLeave = onCourt.filter(
    (player) =>
      input.fouledOutIds.has(player.id) ||
      input.unavailableIds.has(player.id) ||
      isFouledOut(input.foulsByPlayerId.get(player.id) ?? 0),
  );

  for (const outPlayer of mustLeave) {
    const outIndex = onCourt.findIndex((p) => p.id === outPlayer.id);
    if (outIndex < 0) {
      continue;
    }
    const slot = slots[outIndex] ?? outPlayer.position;
    const reason: RotationTraceReason = input.unavailableIds.has(outPlayer.id)
      ? "injury"
      : "foul_out";

    const tryPools = [false, true]; // active first, then emergency
    let incoming: Player | null = null;
    for (const allowEmergency of tryPools) {
      const candidates = input.benchPool.filter((player) =>
        isEligibleToEnter({
          player,
          onCourtIds: onCourtIds(),
          unavailableIds: input.unavailableIds,
          fouledOutIds: input.fouledOutIds,
          plan: input.plan,
          allowEmergency,
        }),
      );
      incoming = pickBestReplacement({
        slot,
        outPlayer,
        candidates,
        plan: input.plan,
        secondsOnCourt: input.secondsOnCourt,
        context: input.context,
        elapsedGameSeconds: input.elapsedGameSeconds,
        remainingGameMinutes: input.remainingGameMinutes,
        onCourt,
      });
      if (incoming != null) {
        break;
      }
    }

    if (incoming == null) {
      // Absolute last resort: any roster player not on court / not fouled out
      const fallback = input.benchPool.find(
        (player) =>
          !onCourtIds().has(player.id) &&
          !input.fouledOutIds.has(player.id) &&
          !input.unavailableIds.has(player.id),
      );
      if (fallback == null) {
        continue;
      }
      incoming = fallback;
    }

    const swapped = applySwap(onCourt, slots, outIndex, incoming);
    onCourt = swapped.onCourt;
    slots = swapped.slots;
    decisions.push({
      playerOutId: outPlayer.id,
      playerInId: incoming.id,
      forced: true,
      reason,
      detail: `Forced replacement for ${outPlayer.id}`,
    });
  }

  return { onCourt, slots, decisions };
}

function tacticalOutScore(
  player: Player,
  input: SubstitutionEngineInput,
): number {
  const entry = entryFor(input.plan, player.id);
  if (entry == null) {
    return 0;
  }
  const fouls = input.foulsByPlayerId.get(player.id) ?? 0;
  const trouble = foulTroubleLevel(fouls, input.context.periodNumber);
  const continuous =
    input.continuousSecondsOnCourt.get(player.id) ?? 0;
  const fatigue =
    input.fatigueByPlayerId.get(player.id) ??
    computeFatigue({
      player,
      continuousSecondsOnCourt: continuous,
      totalSecondsOnCourt: input.secondsOnCourt.get(player.id) ?? 0,
      secondsSinceLastRest: Math.max(
        0,
        input.elapsedGameSeconds -
          (input.lastSubElapsedSeconds.get(player.id) ?? 0),
      ),
    });

  let score =
    foulTroubleSitScore(trouble) +
    minuteBalanceOutScore({
      entry,
      actualMinutes: actualMinutes(input.secondsOnCourt, player.id),
      elapsedGameSeconds: input.elapsedGameSeconds,
      context: input.context,
    });

  if (isFatiguedForSubstitution(fatigue)) {
    score += 5 * fatigue * input.context.fatigueWeight;
  }
  if (continuous >= ROTATION_CONFIG.continuousStretchSeconds) {
    score += 3;
  }

  // Protect closing lineup in late close / OT
  if (
    input.context.closingLineupWeight > 1.5 &&
    input.plan.closingLineupIds.includes(player.id)
  ) {
    score -= 8;
  }

  // Minimum continuous time before tactical sub-out
  if (continuous < ROTATION_CONFIG.minContinuousSecondsBeforeTacticalSub) {
    score -= 20;
  }

  // Approaching absolute max — must sit even tactically
  const max = effectiveMaximum(entry, input.context);
  if (actualMinutes(input.secondsOnCourt, player.id) >= max) {
    score += 15;
  }

  return score;
}

/**
 * Tactical substitutions: capped per checkpoint.
 */
function applyTacticalSubstitutions(
  input: SubstitutionEngineInput,
  current: SubstitutionEngineResult,
): SubstitutionEngineResult {
  if (
    input.checkpoint === "foul_out" ||
    input.checkpoint === "injury"
  ) {
    // Forced-only checkpoints
    return current;
  }

  // Late close / OT: prefer closing lineup swaps only lightly
  const maxSubs = ROTATION_CONFIG.tacticalSubsPerCheckpoint;
  let onCourt = [...current.onCourt];
  let slots = [...current.slots];
  const decisions = [...current.decisions];
  let subsApplied = 0;

  while (subsApplied < maxSubs) {
    const onCourtIds = new Set(onCourt.map((p) => p.id));

    let worstIndex = -1;
    let worstScore = 2.5; // threshold — must meaningfully need to sit
    for (let index = 0; index < onCourt.length; index += 1) {
      const player = onCourt[index]!;
      const score = tacticalOutScore(player, {
        ...input,
        onCourt,
      });
      if (score > worstScore) {
        worstScore = score;
        worstIndex = index;
      }
    }

    if (worstIndex < 0) {
      break;
    }

    const outPlayer = onCourt[worstIndex]!;
    const slot = slots[worstIndex] ?? outPlayer.position;

    const allowEmergency =
      input.context.situation === "blowout_lead" ||
      input.checkpoint === "blowout_relief";

    const candidates = input.benchPool.filter((player) =>
      isEligibleToEnter({
        player,
        onCourtIds,
        unavailableIds: input.unavailableIds,
        fouledOutIds: input.fouledOutIds,
        plan: input.plan,
        allowEmergency,
      }),
    );

    // Prefer candidates under their max
    const underMax = candidates.filter((player) => {
      const entry = entryFor(input.plan, player.id);
      if (entry == null) {
        return true;
      }
      return (
        actualMinutes(input.secondsOnCourt, player.id) <
        effectiveMaximum(entry, input.context)
      );
    });

    const incoming = pickBestReplacement({
      slot,
      outPlayer,
      candidates: underMax.length > 0 ? underMax : candidates,
      plan: input.plan,
      secondsOnCourt: input.secondsOnCourt,
      context: input.context,
      elapsedGameSeconds: input.elapsedGameSeconds,
      remainingGameMinutes: input.remainingGameMinutes,
      onCourt,
    });

    if (incoming == null) {
      break;
    }

    // Validate resulting lineup
    const trialCourt = onCourt.map((p, i) =>
      i === worstIndex ? incoming : p,
    );
    const validation = validateLineup({
      onCourt: trialCourt,
      unavailableIds: input.unavailableIds,
      rotationByPlayerId: input.plan.rotationByPlayerId,
    });
    if (!validation.valid) {
      break;
    }

    const swapped = applySwap(onCourt, slots, worstIndex, incoming);
    onCourt = swapped.onCourt;
    slots = swapped.slots;

    let reason: RotationTraceReason = "rotation_window";
    if (input.checkpoint === "period_start") {
      reason = "period_start";
    } else if (input.checkpoint === "halftime") {
      reason = "halftime";
    } else if (input.checkpoint === "blowout_relief") {
      reason = "blowout_relief";
    } else if (worstScore >= 8) {
      reason = "fatigue";
    } else if (input.context.situation === "overtime") {
      reason = "overtime";
    } else {
      reason = "stagger";
    }

    decisions.push({
      playerOutId: outPlayer.id,
      playerInId: incoming.id,
      forced: false,
      reason,
    });
    subsApplied += 1;
  }

  // Closing lineup enforcement late
  if (
    (input.context.situation === "late_close" ||
      input.context.situation === "overtime") &&
    input.context.secondsRemainingInPeriod <=
      ROTATION_CONFIG.lateGameSecondsRemaining &&
    subsApplied < maxSubs
  ) {
    const closing = input.plan.closingLineupIds;
    for (let index = 0; index < onCourt.length && subsApplied < maxSubs; index += 1) {
      const onCourtPlayer = onCourt[index]!;
      if (closing.includes(onCourtPlayer.id)) {
        continue;
      }
      const missing = closing.find(
        (id) => !onCourt.some((p) => p.id === id),
      );
      if (missing == null) {
        break;
      }
      const incoming = input.benchPool.find((p) => p.id === missing);
      if (
        incoming == null ||
        input.fouledOutIds.has(incoming.id) ||
        input.unavailableIds.has(incoming.id)
      ) {
        continue;
      }
      const continuous =
        input.continuousSecondsOnCourt.get(onCourtPlayer.id) ?? 0;
      if (
        continuous < ROTATION_CONFIG.minContinuousSecondsBeforeTacticalSub &&
        !input.context.isOvertime
      ) {
        continue;
      }
      const swapped = applySwap(onCourt, slots, index, incoming);
      onCourt = swapped.onCourt;
      slots = swapped.slots;
      decisions.push({
        playerOutId: onCourtPlayer.id,
        playerInId: incoming.id,
        forced: false,
        reason: "closing_lineup",
      });
      subsApplied += 1;
    }
  }

  return { onCourt, slots, decisions };
}

/**
 * Evaluate substitutions at a checkpoint. Forced first (unlimited), then tactical (capped).
 */
export function evaluateSubstitutions(
  input: SubstitutionEngineInput,
): SubstitutionEngineResult {
  const afterForced = applyForcedSubstitutions(input);
  return applyTacticalSubstitutions(input, afterForced);
}

export function defaultSlotsForLineup(
  onCourt: readonly Player[],
): PlayerPosition[] {
  return onCourt.map((player) => player.position);
}

export { buildRotationMap };

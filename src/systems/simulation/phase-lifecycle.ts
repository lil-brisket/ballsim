/**
 * Date-driven phase synchronization for calendar-primary progression.
 *
 * syncPhaseForward advances at most ONE phase per call and always runs full
 * exit/enter lifecycle hooks. It never jumps across multiple phases in one step.
 */

import { hasBlockingOwnerDecision } from "@/domain/entities/owner-decision";
import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getOwnedFranchiseAssistance } from "@/state/owner-context";
import {
  getNextPhaseInOrder,
  phaseOrderIndex,
  resolvePhaseResolution,
  type PhaseResolution,
} from "@/systems/league-rules/league-calendar";
import {
  canAdvancePhase,
  getActivePhaseId,
  type LeaguePhaseId,
} from "@/systems/phase-engine";
import { canAiExecute } from "@/systems/simulation/management-policy";
import {
  advanceLeaguePhase,
  processPhaseEnter,
  processPhaseExit,
} from "@/systems/simulation/offseason-lifecycle";
import {
  beginRegularSeasonFromPreseason,
  enterOffseasonFromPostseason,
} from "@/systems/simulation/season-lifecycle";
import { runAiContinuity } from "@/systems/simulation/ai-continuity";

export type PhaseSyncStopReason =
  | "owner_decision"
  | "required_tasks"
  | "draft_clock"
  | "none";

export type PhaseSyncResult = SystemResult & {
  transitioned: boolean;
  fromPhaseId: LeaguePhaseId;
  toPhaseId: LeaguePhaseId;
  resolution: PhaseResolution;
  stopReason: PhaseSyncStopReason;
  stopMessage?: string;
};

function emptySync(
  state: GameState,
  resolution: PhaseResolution,
  stopReason: PhaseSyncStopReason = "none",
  stopMessage?: string,
): PhaseSyncResult {
  const phaseId = getActivePhaseId(state);
  return {
    ...systemResult(state),
    transitioned: false,
    fromPhaseId: phaseId,
    toPhaseId: phaseId,
    resolution,
    stopReason,
    stopMessage,
  };
}

/**
 * Align active phase with resolvePhaseResolution without advancing the calendar.
 * Safe on load and before/after multi-day simulation. At most one phase step.
 */
export function reconcilePhaseWithState(
  state: GameState,
  rng?: Rng,
): PhaseSyncResult {
  return syncPhaseForward(state, rng, { allowAiAssist: false });
}

export type SyncPhaseForwardOptions = {
  /**
   * When true, may run AI continuity for actions the user has delegated.
   * Never silently resolves mandatory owner decisions without assist permission.
   */
  allowAiAssist?: boolean;
};

/**
 * Advance at most one phase toward the resolver target, running full exit/enter hooks.
 */
export function syncPhaseForward(
  state: GameState,
  rng?: Rng,
  options: SyncPhaseForwardOptions = {},
): PhaseSyncResult {
  const allowAiAssist = options.allowAiAssist === true;
  const date = state.world.calendar.currentDate;
  const resolution = resolvePhaseResolution(state, date);
  const fromPhaseId = getActivePhaseId(state);

  if (hasBlockingOwnerDecision(state.user)) {
    return emptySync(
      state,
      resolution,
      "owner_decision",
      "A required owner decision must be resolved before the league can advance.",
    );
  }

  if (resolution.phaseId === fromPhaseId) {
    return emptySync(state, resolution);
  }

  // Never move backward via date sync.
  if (phaseOrderIndex(resolution.phaseId) < phaseOrderIndex(fromPhaseId)) {
    return emptySync(state, resolution);
  }

  const nextPhaseId = getNextPhaseInOrder(fromPhaseId);
  if (nextPhaseId === null) {
    return emptySync(state, resolution);
  }

  // Only take the immediate next step — never skip intermediate phases.
  if (phaseOrderIndex(nextPhaseId) > phaseOrderIndex(resolution.phaseId)) {
    return emptySync(state, resolution);
  }

  let current = state;
  const events: DomainEvent[] = [];

  // Optional AI assist for delegated responsibilities before gated advance.
  if (allowAiAssist && rng && !canAdvancePhase(current)) {
    const franchiseAssist = getOwnedFranchiseAssistance(current);

    if (fromPhaseId === "offseason.draft") {
      if (canAiExecute(current.settings, "DRAFT_PICK", franchiseAssist)) {
        const continuity = runAiContinuity(current, rng, {
          forcePhase: `date_sync_draft:${date}`,
        });
        current = continuity.state;
        events.push(...continuity.events);
      } else {
        return {
          ...emptySync(
            current,
            resolution,
            "draft_clock",
            "Your team is on the draft clock. Make a selection or enable draft assist.",
          ),
          events,
        };
      }
    } else if (
      canAiExecute(current.settings, "SIGN_ROUTINE_FA", franchiseAssist) ||
      canAiExecute(current.settings, "EXTEND_MINIMUM_CONTRACT", franchiseAssist) ||
      canAiExecute(current.settings, "RELEASE_FOR_ROSTER_RULES", franchiseAssist)
    ) {
      const continuity = runAiContinuity(current, rng, {
        forcePhase: `date_sync:${fromPhaseId}:${date}`,
      });
      current = continuity.state;
      events.push(...continuity.events);
    }

    if (hasBlockingOwnerDecision(current.user)) {
      return {
        ...emptySync(
          current,
          resolvePhaseResolution(current, date),
          "owner_decision",
          "A required owner decision must be resolved before the league can advance.",
        ),
        events,
      };
    }
  }

  // Postseason → offseason (replaces manual Begin Offseason gate for date sync).
  if (fromPhaseId === "postseason.season_review") {
    const entered = enterOffseasonFromPostseason(current);
    current = entered.state;
    events.push(...entered.events);
    return {
      state: current,
      events,
      transitioned: true,
      fromPhaseId,
      toPhaseId: getActivePhaseId(current),
      resolution: resolvePhaseResolution(current, date),
      stopReason: "none",
    };
  }

  if (!canAdvancePhase(current)) {
    return {
      ...emptySync(
        current,
        resolvePhaseResolution(current, date),
        "required_tasks",
        "Required phase decisions remain. Resolve them or enable AI assist for delegated actions.",
      ),
      events,
    };
  }

  try {
    const advanced = advanceLeaguePhase(current, rng);
    current = advanced.state;
    events.push(...advanced.events);
    return {
      state: current,
      events,
      transitioned: true,
      fromPhaseId,
      toPhaseId: getActivePhaseId(current),
      resolution: resolvePhaseResolution(
        current,
        current.world.calendar.currentDate,
      ),
      stopReason: "none",
    };
  } catch (error) {
    // Fallback: explicit exit → enter when advanceLeaguePhase rejects
    // after canAdvancePhase already passed (e.g. special-cased transitions).
    const exitResult = processPhaseExit(current, fromPhaseId, rng);
    current = exitResult.state;
    events.push(...exitResult.events);

    if (fromPhaseId === "preseason.preparation") {
      const begun = beginRegularSeasonFromPreseason(current);
      current = begun.state;
      events.push(...begun.events);
    } else {
      const enterResult = processPhaseEnter(current, nextPhaseId, rng);
      current = enterResult.state;
      events.push(...enterResult.events);
    }

    return {
      state: current,
      events,
      transitioned: true,
      fromPhaseId,
      toPhaseId: getActivePhaseId(current),
      resolution: resolvePhaseResolution(
        current,
        current.world.calendar.currentDate,
      ),
      stopReason: "none",
      stopMessage: error instanceof Error ? error.message : undefined,
    };
  }
}

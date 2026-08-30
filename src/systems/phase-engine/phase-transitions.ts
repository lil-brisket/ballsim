import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getPhaseDefinition } from "@/systems/phase-engine/phase-definitions";
import { evaluatePhaseTasks } from "@/systems/phase-engine/evaluate-phase-tasks";
import {
  getActivePhaseId,
  legacyOffseasonStageFromPhase,
  seasonPhaseFromLeaguePhase,
} from "@/systems/phase-engine/resolve-current-phase";
import type {
  LeaguePhaseId,
  PhaseAdvancePreview,
  PhaseAdvanceSummary,
} from "@/systems/phase-engine/phase-types";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import {
  canAdvanceFromPhase,
  canEnterPhase,
} from "@/systems/league-rules/phase-prerequisites";

/**
 * Write active phase into competition.phase and keep legacy season fields synced.
 */
export function setActivePhase(
  state: GameState,
  phaseId: LeaguePhaseId,
): GameState {
  const current = getActivePhaseId(state);
  if (
    current === phaseId &&
    state.competition.phase?.activePhaseId === phaseId
  ) {
    return state;
  }

  const seasonPhase = seasonPhaseFromLeaguePhase(phaseId);
  const offseasonStage = legacyOffseasonStageFromPhase(phaseId);
  const enteredDate = state.world.calendar.currentDate;

  let next: GameState = {
    ...state,
    competition: {
      ...state.competition,
      phase: {
        activePhaseId: phaseId,
        enteredDate,
      },
      season: {
        ...state.competition.season,
        offseasonStage:
          seasonPhase === "offseason" ? offseasonStage : "none",
        offseasonStageEnteredDate:
          seasonPhase === "offseason" ? enteredDate : null,
        freeAgencyExtendedUntil: null,
        // Preserve hard-lock snapshots across phase writes
        tradeDeadlineDate: state.competition.season.tradeDeadlineDate ?? null,
        rfaQualificationComplete:
          state.competition.season.rfaQualificationComplete === true,
      },
    },
    user: {
      ...state.user,
      franchisePhaseState: clearPhaseEndDismissals(
        state.user.franchisePhaseState ?? {},
        current,
      ),
    },
  };

  if (next.competition.season.phase !== seasonPhase) {
    // Only use transitionPhase when moving between SeasonPhase buckets.
    if (
      canTransitionSeasonPhase(next.competition.season.phase, seasonPhase)
    ) {
      const result = transitionPhase(next, seasonPhase);
      next = {
        ...result.state,
        competition: {
          ...result.state.competition,
          phase: {
            activePhaseId: phaseId,
            enteredDate,
          },
          season: {
            ...result.state.competition.season,
            offseasonStage:
              seasonPhase === "offseason" ? offseasonStage : "none",
            offseasonStageEnteredDate:
              seasonPhase === "offseason" ? enteredDate : null,
          },
        },
      };
    } else {
      next = {
        ...next,
        competition: {
          ...next.competition,
          season: {
            ...next.competition.season,
            phase: seasonPhase,
          },
        },
      };
    }
  }

  return next;
}

function canTransitionSeasonPhase(
  from: GameState["competition"]["season"]["phase"],
  to: GameState["competition"]["season"]["phase"],
): boolean {
  if (from === to) {
    return false;
  }
  // Valid graph from phase-machine — avoid throwing mid-set when already synced
  const allowed: Record<string, readonly string[]> = {
    preseason: ["regular"],
    regular: ["playoffs", "postseason"],
    playoffs: ["postseason"],
    postseason: ["offseason"],
    offseason: ["preseason"],
  };
  return (allowed[from] ?? []).includes(to);
}

function clearPhaseEndDismissals(
  franchisePhaseState: NonNullable<GameState["user"]["franchisePhaseState"]>,
  leavingPhaseId: LeaguePhaseId,
): NonNullable<GameState["user"]["franchisePhaseState"]> {
  const next: typeof franchisePhaseState = {};
  for (const [teamId, entry] of Object.entries(franchisePhaseState)) {
    next[teamId] = {
      dismissed: entry.dismissed.filter(
        (item) =>
          !(
            item.dismissedUntil === "phase_end" &&
            item.phaseId === leavingPhaseId
          ),
      ),
    };
  }
  return next;
}

/**
 * Preview whether the user can advance and what will happen.
 * Blocks only on required tasks across owned teams.
 */
export function previewAdvance(state: GameState): PhaseAdvancePreview {
  const fromPhaseId = getActivePhaseId(state);
  const def = getPhaseDefinition(fromPhaseId);
  const toPhaseId = def.nextPhaseId;

  let requiredRemaining = 0;
  let recommendedRemaining = 0;
  for (const teamId of state.user.ownedTeamIds) {
    const summary = evaluatePhaseTasks(state, teamId);
    requiredRemaining += summary.counts.required;
    recommendedRemaining += summary.counts.recommended;
  }

  if (toPhaseId === null) {
    return {
      fromPhaseId,
      toPhaseId: fromPhaseId,
      toPhaseName: def.name,
      consequences: [],
      recommendedRemaining,
      requiredRemaining,
      canAdvance: false,
      blockReason: "No next phase is defined.",
    };
  }

  const toDef = getPhaseDefinition(toPhaseId);
  const leaveCheck = canAdvanceFromPhase(state, fromPhaseId);
  const enterCheck = canEnterPhase(state, toPhaseId);
  const leaguePrereq = {
    allowed: leaveCheck.allowed && enterCheck.allowed,
    blockReason: leaveCheck.blockReason ?? enterCheck.blockReason,
  };
  const canAdvance = requiredRemaining === 0 && leaguePrereq.allowed;
  return {
    fromPhaseId,
    toPhaseId,
    toPhaseName: toDef.name,
    consequences: [...def.previewConsequences],
    recommendedRemaining,
    requiredRemaining,
    canAdvance,
    blockReason: !leaguePrereq.allowed
      ? leaguePrereq.blockReason
      : canAdvance
        ? null
        : `${requiredRemaining} required decision${requiredRemaining === 1 ? "" : "s"} must be resolved before advancing.`,
  };
}

export function canAdvancePhase(state: GameState): boolean {
  return previewAdvance(state).canAdvance;
}

export type AdvancePhaseResult = SystemResult & {
  preview: PhaseAdvancePreview;
  summary: PhaseAdvanceSummary;
};

/**
 * User-controlled phase advance. Callers must run exit hooks (AI, contract release, etc.) separately or via processPhaseExit.
 * This function only moves the phase pointer after validating required tasks.
 */
export function advancePhase(
  state: GameState,
  _rng?: Rng,
): AdvancePhaseResult {
  const preview = previewAdvance(state);
  if (!preview.canAdvance) {
    throw new Error(
      preview.blockReason ?? "Cannot advance phase while required tasks remain.",
    );
  }

  const fromDef = getPhaseDefinition(preview.fromPhaseId);
  const toDef = getPhaseDefinition(preview.toPhaseId);
  const next = setActivePhase(state, preview.toPhaseId);

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "LeaguePhaseAdvanced",
      occurredOn: next.world.calendar.currentDate,
      payload: {
        from: preview.fromPhaseId,
        to: preview.toPhaseId,
        reason: "user_advance",
      },
    }),
  ];

  const summary: PhaseAdvanceSummary = {
    fromPhaseId: preview.fromPhaseId,
    toPhaseId: preview.toPhaseId,
    fromPhaseName: fromDef.name,
    toPhaseName: toDef.name,
    ownerHighlights: [],
    leagueHighlights: [...fromDef.previewConsequences],
  };

  const result = systemResult(next, events);
  return {
    ...result,
    preview,
    summary,
  };
}

/**
 * Force-set phase without required-task checks (used by automatic lifecycle).
 */
export function enterPhase(
  state: GameState,
  phaseId: LeaguePhaseId,
  reason: string,
): SystemResult {
  const from = getActivePhaseId(state);
  const next = setActivePhase(state, phaseId);
  const events: DomainEvent[] = [];
  if (from !== phaseId) {
    events.push(
      createDomainEvent({
        type: "LeaguePhaseAdvanced",
        occurredOn: next.world.calendar.currentDate,
        payload: {
          from,
          to: phaseId,
          reason,
        },
      }),
    );
  }
  return systemResult(next, events);
}

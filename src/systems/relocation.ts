import type {
  RelocationProcess,
  RelocationStage,
  RelocationTarget,
} from "@/domain/entities/relocation";
import { createIdleRelocation } from "@/domain/entities/relocation";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { isCityOccupied } from "@/systems/market-catalog";
import { evaluateDestination } from "@/state/market-destination";
import { relocationFeeForTarget } from "@/state/relocation-assessment";
import {
  RELOCATION_COOLDOWN_SEASONS,
  RELOCATION_CANCELLABLE_STAGES,
  RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS,
  RELOCATION_FAN_SENTIMENT_SHOCK_BASE,
  RELOCATION_FAN_SENTIMENT_SHOCK_MAX,
  RELOCATION_FAN_SENTIMENT_SHOCK_PER_HISTORY_SEASON,
  RELOCATION_REPUTATION_LONG_TENURE_SEASONS,
  RELOCATION_REPUTATION_MIN_PRIOR,
  RELOCATION_REPUTATION_SHOCK_LONG_TENURE,
  RELOCATION_STAGE_ORDER,
} from "@/systems/relocation-config";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

function nextStage(current: RelocationStage): RelocationStage {
  const index = RELOCATION_STAGE_ORDER.indexOf(
    current as (typeof RELOCATION_STAGE_ORDER)[number],
  );
  if (index < 0 || index >= RELOCATION_STAGE_ORDER.length - 1) {
    return current;
  }
  return RELOCATION_STAGE_ORDER[index + 1]!;
}

function emitStageChange(
  state: GameState,
  teamId: TeamId,
  stage: RelocationStage,
  target: RelocationTarget | null,
): DomainEvent {
  return createDomainEvent({
    type: "RelocationStageChanged",
    occurredOn: state.world.calendar.currentDate,
    payload: { teamId, stage, target },
  });
}

function ensureProcess(
  state: GameState,
  teamId: TeamId,
): RelocationProcess {
  const existing = state.business.relocationByTeamId[teamId];
  if (existing) {
    return {
      ...existing,
      cityStartSeasonYear:
        existing.cityStartSeasonYear > 0
          ? existing.cityStartSeasonYear
          : state.competition.season.year,
      lastCompletedRelocationSeasonYear:
        existing.lastCompletedRelocationSeasonYear ?? null,
      failedAttemptCooldownSeasonsRemaining:
        existing.failedAttemptCooldownSeasonsRemaining ?? 0,
    };
  }
  return createIdleRelocation(teamId, state.competition.season.year);
}

/**
 * Advance one relocation stage.
 * When leaving `transition`, applies `completeRelocationTransition`
 * (identity, fee, fan shock) — do not mark complete without that path.
 */
export function advanceRelocationStage(
  state: GameState,
  teamId: TeamId,
  target?: RelocationTarget,
): SystemResult {
  const process = ensureProcess(state, teamId);
  if (process.cooldownSeasonsRemaining > 0 && process.stage === "none") {
    throw new Error("advanceRelocationStage: team is in relocation cooldown.");
  }
  if (
    process.failedAttemptCooldownSeasonsRemaining > 0 &&
    process.stage === "none"
  ) {
    throw new Error(
      "advanceRelocationStage: team is in failed-attempt cooldown.",
    );
  }

  // Transition → complete must run the completion helper.
  if (process.stage === "transition") {
    return completeRelocationTransition(state, teamId);
  }

  let next: RelocationProcess;
  const events: DomainEvent[] = [];
  const resolvedTarget = target ?? process.target;

  if (process.stage === "none") {
    const ops = state.business.franchiseOps[teamId];
    const fee = resolvedTarget
      ? relocationFeeForTarget(ops?.marketSize ?? 50, resolvedTarget.marketSize)
      : relocationFeeForTarget(ops?.marketSize ?? 50, ops?.marketSize ?? 50);
    next = {
      ...process,
      stage: "evaluate",
      target: resolvedTarget ?? null,
      fee,
    };
  } else if (process.stage === "rejected" || process.stage === "complete") {
    throw new Error(
      `advanceRelocationStage: cannot advance from "${process.stage}".`,
    );
  } else if (process.stage === "approved") {
    next = { ...process, stage: "transition", target: resolvedTarget };
  } else if (process.stage === "league_review") {
    const reviewTarget = resolvedTarget;
    if (!reviewTarget) {
      throw new Error("advanceRelocationStage: league review requires a target.");
    }
    if (isCityOccupied(state, reviewTarget.city)) {
      next = {
        ...process,
        stage: "rejected",
        target: reviewTarget,
        failedAttemptCooldownSeasonsRemaining:
          RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS,
      };
    } else {
      const ops = state.business.franchiseOps[teamId];
      const evaluation = evaluateDestination(
        {
          city: reviewTarget.city,
          name: reviewTarget.name,
          abbreviation: reviewTarget.abbreviation,
          marketSize: reviewTarget.marketSize,
        },
        ops?.marketSize ?? 50,
      );
      const approved = evaluation.credibleImprovement;
      next = {
        ...process,
        stage: approved ? "approved" : "rejected",
        target: reviewTarget,
        fee: relocationFeeForTarget(
          ops?.marketSize ?? 50,
          reviewTarget.marketSize,
        ),
        failedAttemptCooldownSeasonsRemaining: approved
          ? process.failedAttemptCooldownSeasonsRemaining
          : RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS,
      };
    }
  } else {
    next = {
      ...process,
      stage: nextStage(process.stage),
      target: resolvedTarget ?? process.target,
    };
    if (resolvedTarget && state.business.franchiseOps[teamId]) {
      next = {
        ...next,
        fee: relocationFeeForTarget(
          state.business.franchiseOps[teamId]!.marketSize,
          resolvedTarget.marketSize,
        ),
      };
    }
  }

  events.push(emitStageChange(state, teamId, next.stage, next.target));

  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        relocationByTeamId: {
          ...state.business.relocationByTeamId,
          [teamId]: next,
        },
      },
    },
    events,
  );
}

export function cancelRelocation(
  state: GameState,
  teamId: TeamId,
): SystemResult {
  const process = ensureProcess(state, teamId);
  if (!RELOCATION_CANCELLABLE_STAGES.has(process.stage)) {
    throw new Error(
      `cancelRelocation: stage "${process.stage}" is not cancellable.`,
    );
  }
  const next: RelocationProcess = {
    ...createIdleRelocation(teamId, process.cityStartSeasonYear),
    cityStartSeasonYear: process.cityStartSeasonYear,
    lastCompletedRelocationSeasonYear:
      process.lastCompletedRelocationSeasonYear,
    failedAttemptCooldownSeasonsRemaining:
      RELOCATION_FAILED_ATTEMPT_COOLDOWN_SEASONS,
  };
  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        relocationByTeamId: {
          ...state.business.relocationByTeamId,
          [teamId]: next,
        },
      },
    },
    [emitStageChange(state, teamId, "none", null)],
  );
}

/**
 * Apply relocation consequences: fee, identity, marketSize, primary fan shock.
 * One relocation event → one primary demand-facing stock (fanSentiment).
 * Reputation only gets a small contextual hit for long successful tenure.
 */
export function completeRelocationTransition(
  state: GameState,
  teamId: TeamId,
): SystemResult {
  const process = ensureProcess(state, teamId);
  if (process.stage !== "transition" || !process.target) {
    throw new Error(
      "completeRelocationTransition: team is not in transition with a target.",
    );
  }

  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  const impact = applyCashAndBooksImpact(
    current,
    teamId,
    -process.fee,
    year,
    { expenseCategory: "operations" },
  );
  current = impact.state;
  events.push(...impact.events);

  const team = current.world.teams[teamId];
  const ops = current.business.franchiseOps[teamId];
  if (!team || !ops) {
    throw new Error(`completeRelocationTransition: team "${teamId}" missing.`);
  }

  const target = process.target;
  const seasonsInCity = Math.max(
    1,
    year -
      (process.cityStartSeasonYear > 0
        ? process.cityStartSeasonYear
        : year) +
      1,
  );
  const sentimentShock = Math.min(
    RELOCATION_FAN_SENTIMENT_SHOCK_MAX,
    RELOCATION_FAN_SENTIMENT_SHOCK_BASE +
      seasonsInCity * RELOCATION_FAN_SENTIMENT_SHOCK_PER_HISTORY_SEASON,
  );
  const nextSentiment = Math.max(
    0,
    Math.round(ops.fanSentiment - sentimentShock),
  );

  // Contextual reputation only — avoid stacking demand-facing stocks.
  let nextReputation = team.reputation;
  if (
    seasonsInCity >= RELOCATION_REPUTATION_LONG_TENURE_SEASONS &&
    team.reputation >= RELOCATION_REPUTATION_MIN_PRIOR
  ) {
    nextReputation = Math.max(
      1,
      team.reputation - RELOCATION_REPUTATION_SHOCK_LONG_TENURE,
    );
  }

  current = {
    ...current,
    world: {
      ...current.world,
      teams: {
        ...current.world.teams,
        [teamId]: {
          ...team,
          city: target.city,
          name: target.name,
          abbreviation: target.abbreviation,
          reputation: nextReputation,
        },
      },
    },
    business: {
      ...current.business,
      franchiseOps: {
        ...current.business.franchiseOps,
        [teamId]: {
          ...ops,
          marketSize: target.marketSize,
          fanSentiment: nextSentiment,
        },
      },
      relocationByTeamId: {
        ...current.business.relocationByTeamId,
        [teamId]: {
          teamId,
          stage: "complete",
          target,
          cooldownSeasonsRemaining: RELOCATION_COOLDOWN_SEASONS,
          fee: 0,
          cityStartSeasonYear: year,
          lastCompletedRelocationSeasonYear: year,
          failedAttemptCooldownSeasonsRemaining: 0,
        },
      },
    },
  };

  events.push(emitStageChange(current, teamId, "complete", target));

  return systemResult(current, events);
}

/**
 * Decrement relocation cooldowns at season boundaries.
 * Rejected processes reset to none when failed-attempt cooldown hits 0.
 */
export function tickRelocationCooldowns(state: GameState): SystemResult {
  let relocationByTeamId = state.business.relocationByTeamId;
  let changed = false;

  for (const teamId of Object.keys(relocationByTeamId).sort()) {
    const process = ensureProcess(state, teamId as TeamId);
    let next = { ...process };
    let localChange = false;

    if (next.cooldownSeasonsRemaining > 0) {
      const wasComplete = next.stage === "complete";
      const remaining = next.cooldownSeasonsRemaining - 1;
      next = {
        ...next,
        cooldownSeasonsRemaining: remaining,
        ...(remaining === 0 && wasComplete
          ? { stage: "none" as const, target: null }
          : {}),
      };
      localChange = true;
    }

    if (next.failedAttemptCooldownSeasonsRemaining > 0) {
      const wasRejected = next.stage === "rejected";
      const failedRemaining = next.failedAttemptCooldownSeasonsRemaining - 1;
      next = {
        ...next,
        failedAttemptCooldownSeasonsRemaining: failedRemaining,
        ...(failedRemaining === 0 && wasRejected
          ? { stage: "none" as const, target: null }
          : {}),
      };
      localChange = true;
    }

    // Rejected with no failed cooldown still resets at season boundary.
    if (
      next.stage === "rejected" &&
      next.failedAttemptCooldownSeasonsRemaining <= 0
    ) {
      next = {
        ...next,
        stage: "none",
        target: null,
      };
      localChange = true;
    }

    if (localChange) {
      relocationByTeamId = {
        ...relocationByTeamId,
        [teamId]: next,
      };
      changed = true;
    }
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: { ...state.business, relocationByTeamId },
  });
}

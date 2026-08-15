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
import {
  RELOCATION_COOLDOWN_SEASONS,
  RELOCATION_CANCELLABLE_STAGES,
  RELOCATION_STAGE_ORDER,
  RELOCATION_TRANSITION_FEE,
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

export function advanceRelocationStage(
  state: GameState,
  teamId: TeamId,
  target?: RelocationTarget,
): SystemResult {
  const process =
    state.business.relocationByTeamId[teamId] ?? createIdleRelocation(teamId);
  if (process.cooldownSeasonsRemaining > 0 && process.stage === "none") {
    throw new Error("advanceRelocationStage: team is in relocation cooldown.");
  }

  let next: RelocationProcess;
  const events: DomainEvent[] = [];

  if (process.stage === "none") {
    next = {
      ...process,
      stage: "evaluate",
      target: target ?? null,
      fee: RELOCATION_TRANSITION_FEE,
    };
  } else if (process.stage === "rejected" || process.stage === "complete") {
    throw new Error(
      `advanceRelocationStage: cannot advance from "${process.stage}".`,
    );
  } else if (process.stage === "approved") {
    next = { ...process, stage: "transition" };
  } else if (process.stage === "league_review") {
    const approved = (target?.marketSize ?? process.target?.marketSize ?? 50) >= 40;
    next = {
      ...process,
      stage: approved ? "approved" : "rejected",
      target: target ?? process.target,
    };
  } else {
    next = {
      ...process,
      stage: nextStage(process.stage),
      target: target ?? process.target,
    };
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
  const process =
    state.business.relocationByTeamId[teamId] ?? createIdleRelocation(teamId);
  if (!RELOCATION_CANCELLABLE_STAGES.has(process.stage)) {
    throw new Error(
      `cancelRelocation: stage "${process.stage}" is not cancellable.`,
    );
  }
  const next = createIdleRelocation(teamId);
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
    [
      emitStageChange(state, teamId, "none", null),
    ],
  );
}

export function completeRelocationTransition(
  state: GameState,
  teamId: TeamId,
): SystemResult {
  const process =
    state.business.relocationByTeamId[teamId] ?? createIdleRelocation(teamId);
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
        },
      },
    },
    business: {
      ...current.business,
      franchiseOps: {
        ...current.business.franchiseOps,
        [teamId]: { ...ops, marketSize: target.marketSize },
      },
      relocationByTeamId: {
        ...current.business.relocationByTeamId,
        [teamId]: {
          teamId,
          stage: "complete",
          target,
          cooldownSeasonsRemaining: RELOCATION_COOLDOWN_SEASONS,
          fee: 0,
        },
      },
    },
  };

  events.push(emitStageChange(current, teamId, "complete", target));

  return systemResult(current, events);
}

/** Decrement relocation cooldown at season boundaries. */
export function tickRelocationCooldowns(state: GameState): SystemResult {
  let relocationByTeamId = state.business.relocationByTeamId;
  let changed = false;

  for (const teamId of Object.keys(relocationByTeamId).sort()) {
    const process = relocationByTeamId[teamId]!;
    if (process.cooldownSeasonsRemaining <= 0) {
      continue;
    }
    const remaining = process.cooldownSeasonsRemaining - 1;
    relocationByTeamId = {
      ...relocationByTeamId,
      [teamId]: {
        ...process,
        cooldownSeasonsRemaining: remaining,
        stage: remaining === 0 && process.stage === "complete" ? "none" : process.stage,
        target: remaining === 0 && process.stage === "complete" ? null : process.target,
      },
    };
    changed = true;
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    business: { ...state.business, relocationByTeamId },
  });
}

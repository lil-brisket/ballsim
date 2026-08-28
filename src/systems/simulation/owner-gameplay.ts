import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getOwnedTeamIds } from "@/state/owner-context";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { applyGameplayFinancialConsequences } from "@/systems/gameplay-financial-consequences";
import { evaluateOwnerObjectives } from "@/systems/owner-objectives";
import { generateOwnerNotifications } from "@/systems/owner-notifications";
import { processOwnershipConfidence } from "@/systems/ownership-confidence-engine";
import { runAiContinuity } from "@/systems/simulation/ai-continuity";

export type OwnerGameplayResult = SystemResult & {
  previousCash: number;
};

export type RunOwnerGameplayOptions = {
  /** Same-day domain events not yet in franchise eventLog (e.g. HomeGameDaySettled). */
  dayEvents?: readonly DomainEvent[];
};

/**
 * Owner Mode Phase B gameplay for one simulated day.
 *
 * Order (required):
 * 1. AI decisions (CPU teams)
 * 2. AI continuity (all owned franchises — never keys off activeOwnerTeamId)
 * 3. Financial consequences
 * 4. Owner objective evaluation (per owned franchise via active helpers until looped)
 * 5. Objective financial consequences (second finance pass)
 * 6. Ownership confidence / strategic posture
 * 7. Owner notifications
 *
 * Idempotent for the same simulation state/date when guards are present.
 */
export function runOwnerGameplay(
  state: GameState,
  rng: Rng,
  options: RunOwnerGameplayOptions = {},
): OwnerGameplayResult {
  const events: DomainEvent[] = [];
  let current = state;

  const ai = runAiTeamDecisions(current, rng);
  current = ai.state;
  events.push(...ai.events);

  // Processes every owned franchise (simulation rule).
  const continuity = runAiContinuity(current, rng);
  current = continuity.state;
  events.push(...continuity.events);

  // Snapshot cash for the first owned team for legacy previousCash return.
  const primaryTeamId = getOwnedTeamIds(current)[0]!;
  const previousCash = current.business.finances[primaryTeamId]?.cash ?? 0;

  const financesBeforeObjectives = applyGameplayFinancialConsequences(current);
  current = financesBeforeObjectives.state;
  events.push(...financesBeforeObjectives.events);

  // Evaluate objectives for each owned franchise by temporarily switching
  // active context only for systems that still read activeOwnerTeamId.
  // Prefer looping with teamId parameters as those systems are updated.
  for (const teamId of getOwnedTeamIds(current)) {
    const switched =
      current.user.activeOwnerTeamId === teamId
        ? current
        : {
            ...current,
            user: { ...current.user, activeOwnerTeamId: teamId },
          };
    const objectives = evaluateOwnerObjectives(switched);
    current = {
      ...objectives.state,
      user: {
        ...objectives.state.user,
        activeOwnerTeamId: state.user.activeOwnerTeamId,
      },
    };
    events.push(...objectives.events);
  }

  const financesAfterObjectives = applyGameplayFinancialConsequences(current);
  current = financesAfterObjectives.state;
  events.push(...financesAfterObjectives.events);

  for (const teamId of getOwnedTeamIds(current)) {
    const switched =
      current.user.activeOwnerTeamId === teamId
        ? current
        : {
            ...current,
            user: { ...current.user, activeOwnerTeamId: teamId },
          };
    const confidence = processOwnershipConfidence(switched);
    current = {
      ...confidence.state,
      user: {
        ...confidence.state.user,
        activeOwnerTeamId: state.user.activeOwnerTeamId,
      },
    };
    events.push(...confidence.events);
  }

  for (const teamId of getOwnedTeamIds(current)) {
    const switched =
      current.user.activeOwnerTeamId === teamId
        ? current
        : {
            ...current,
            user: { ...current.user, activeOwnerTeamId: teamId },
          };
    const teamPreviousCash =
      current.business.finances[teamId]?.cash ?? previousCash;
    const notifications = generateOwnerNotifications(switched, {
      previousCash: teamPreviousCash,
      dayEvents: options.dayEvents,
    });
    current = {
      ...notifications.state,
      user: {
        ...notifications.state.user,
        activeOwnerTeamId: state.user.activeOwnerTeamId,
      },
    };
    events.push(...notifications.events);
  }

  return {
    ...systemResult(current, events),
    previousCash,
  };
}

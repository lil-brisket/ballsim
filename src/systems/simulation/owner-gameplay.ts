import type { DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
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
  /** Same-day domain events not yet in user.eventLog (e.g. HomeGameDaySettled). */
  dayEvents?: readonly DomainEvent[];
};

/**
 * Owner Mode Phase B gameplay for one simulated day.
 *
 * Order (required):
 * 1. AI decisions (CPU teams)
 * 2. AI continuity (user team)
 * 3. Financial consequences
 * 4. Owner objective evaluation
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
  const teamId = current.user.controlledTeamId;

  const ai = runAiTeamDecisions(current, rng);
  current = ai.state;
  events.push(...ai.events);

  const continuity = runAiContinuity(current, rng);
  current = continuity.state;
  events.push(...continuity.events);

  const previousCash = current.business.finances[teamId]?.cash ?? 0;

  const financesBeforeObjectives = applyGameplayFinancialConsequences(current);
  current = financesBeforeObjectives.state;
  events.push(...financesBeforeObjectives.events);

  const objectives = evaluateOwnerObjectives(current);
  current = objectives.state;
  events.push(...objectives.events);

  const financesAfterObjectives = applyGameplayFinancialConsequences(current);
  current = financesAfterObjectives.state;
  events.push(...financesAfterObjectives.events);

  const confidence = processOwnershipConfidence(current);
  current = confidence.state;
  events.push(...confidence.events);

  const notifications = generateOwnerNotifications(current, {
    previousCash,
    dayEvents: options.dayEvents,
  });
  current = notifications.state;
  events.push(...notifications.events);

  return {
    ...systemResult(current, events),
    previousCash,
  };
}

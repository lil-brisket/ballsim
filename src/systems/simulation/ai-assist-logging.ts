/**
 * Rich logging for user-franchise AI assistance actions and declines.
 */

import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { PlayerId, StaffId, TeamId } from "@/domain/ids";
import type {
  ActionClassification,
  ManagementActionId,
} from "@/systems/simulation/management-actions";
import type {
  PolicyDecision,
  PolicyOutcome,
} from "@/systems/simulation/management-policy";
import type { ManagementPhase } from "@/domain/ai-management-presets";

export type AiAssistLogPayload = {
  phase: ManagementPhase;
  action: ManagementActionId;
  classification: ActionClassification;
  policy: string;
  phaseMode: string;
  outcome: PolicyOutcome;
  reason: string;
  trigger: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  teamId: TeamId;
  playerId?: PlayerId;
  staffId?: StaffId;
  role?: string;
};

export type CreateAiAssistLogInput = {
  decision: PolicyDecision;
  occurredOn: string;
  teamId: TeamId;
  reason?: string;
  trigger?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  playerId?: PlayerId;
  staffId?: StaffId;
  role?: string;
};

export function createAiAssistLogEvent(
  input: CreateAiAssistLogInput,
): DomainEvent {
  const { decision } = input;
  const payload: AiAssistLogPayload = {
    phase: decision.phase,
    action: decision.action.id,
    classification: decision.action.classification,
    policy: decision.preset,
    phaseMode: decision.phaseMode,
    outcome: decision.outcome,
    reason: input.reason ?? decision.action.logging.defaultReason,
    trigger: input.trigger ?? decision.action.logging.defaultTrigger,
    before: input.before ?? {},
    after: input.after ?? {},
    teamId: input.teamId,
    playerId: input.playerId,
    staffId: input.staffId,
    role: input.role,
  };

  return createDomainEvent({
    type: "AiAssistAction",
    occurredOn: input.occurredOn,
    payload: payload as unknown as Record<string, unknown>,
  });
}

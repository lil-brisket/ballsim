import { lookupInvariant } from "@/simulation/lab/invariant-registry";
import type {
  LabFailure,
  LabFailureContext,
  RawInvariantFailure,
} from "@/simulation/lab/types";

export function toLabFailure(
  raw: RawInvariantFailure,
  ctx: LabFailureContext,
): LabFailure {
  const entry = lookupInvariant(raw.rule);
  return {
    ...raw,
    severity: entry.severity,
    scope: entry.scope,
    seed: ctx.seed,
    scenarioId: ctx.scenarioId,
    reproCommand: ctx.reproCommand,
    engineIdentity: ctx.engineIdentity,
  };
}

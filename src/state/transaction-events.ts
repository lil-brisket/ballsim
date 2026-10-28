import type { DomainEvent } from "@/domain/events";

/** Events that name the signing; ContractSigned is the generic companion. */
const SPECIFIC_SIGNING_TYPES: ReadonlySet<string> = new Set([
  "FreeAgentSigned",
  "RfaOfferSheetSigned",
]);

function contractIdOf(event: DomainEvent): string | null {
  const id = (event.payload as Record<string, unknown>).contractId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * A free-agent signing emits FreeAgentSigned and ContractSigned for the same
 * contract. Listings show one move per contract: the ContractSigned is dropped
 * when a FreeAgentSigned / RfaOfferSheetSigned names the same contract. Every
 * other event, and the order, is kept. Apply before filtering by type.
 */
export function withoutDuplicateSigningEvents<T extends DomainEvent>(
  events: readonly T[],
): T[] {
  const named = new Set<string>();
  for (const event of events) {
    if (!SPECIFIC_SIGNING_TYPES.has(event.type)) continue;
    const contractId = contractIdOf(event);
    if (contractId) named.add(contractId);
  }
  if (named.size === 0) return [...events];
  return events.filter((event) => {
    if (event.type !== "ContractSigned") return true;
    const contractId = contractIdOf(event);
    return contractId === null || !named.has(contractId);
  });
}

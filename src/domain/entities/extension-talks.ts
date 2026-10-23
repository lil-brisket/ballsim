import type { ContractId, PlayerId, TeamId } from "@/domain/ids";

export type ExtensionResponseKind = "accept" | "counter" | "refuse";

export const EXTENSION_RESPONSE_KINDS: readonly ExtensionResponseKind[] = [
  "accept",
  "counter",
  "refuse",
];

/** The player's answer to the last extension offer. */
export type ExtensionResponseRecord = {
  kind: ExtensionResponseKind;
  /** What the team offered. */
  offeredSalary: number;
  offeredYears: number;
  /** Counter / ask terms (equal to the offer on accept). */
  askSalary: number;
  askYears: number;
  on: string;
};

/**
 * Extension negotiation memory for one player and his current contract.
 * Talks reset when the contract changes (a new contract id).
 */
export type ExtensionTalks = {
  playerId: PlayerId;
  teamId: TeamId;
  contractId: ContractId;
  /** Offers he turned down on this contract. */
  refusals: number;
  lastRefusedOn: string | null;
  /** After two refusals he stops talking and goes to free agency. */
  testingMarket: boolean;
  lastResponse: ExtensionResponseRecord | null;
};

/** Extension talks by player id (schema v72+). */
export type ExtensionTalksState = Record<string, ExtensionTalks>;

export function isExtensionResponseKind(
  value: unknown,
): value is ExtensionResponseKind {
  return (
    typeof value === "string" &&
    (EXTENSION_RESPONSE_KINDS as readonly string[]).includes(value)
  );
}

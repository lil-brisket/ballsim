/**
 * League expansion foundation (E12). Not a full expansion simulator.
 */

export type ExpansionStage =
  | "none"
  | "proposed"
  | "approved"
  | "draft"
  | "complete";

export const EXPANSION_STAGES: readonly ExpansionStage[] = [
  "none",
  "proposed",
  "approved",
  "draft",
  "complete",
] as const;

export type ExpansionCandidateMarket = {
  city: string;
  name: string;
  abbreviation: string;
  marketSize: number;
  conferenceId: string;
  divisionId: string;
};

export type ExpansionState = {
  stage: ExpansionStage;
  candidates: ExpansionCandidateMarket[];
  /** Selected candidate index when approved; -1 if none. */
  selectedCandidateIndex: number;
  /** Expansion fee (integer dollars) shared to pre-existing clubs. */
  fee: number;
  /** New team id once created; null until franchise exists. */
  newTeamId: string | null;
};

export function isExpansionStage(value: unknown): value is ExpansionStage {
  return (
    typeof value === "string" &&
    (EXPANSION_STAGES as readonly string[]).includes(value)
  );
}

export function createIdleExpansionState(): ExpansionState {
  return {
    stage: "none",
    candidates: [],
    selectedCandidateIndex: -1,
    fee: 150_000_000,
    newTeamId: null,
  };
}

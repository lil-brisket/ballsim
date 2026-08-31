import type {
  AwardDefinition,
  AwardDefinitionId,
} from "@/domain/entities/awards";

export const AWARD_DEFINITIONS: Record<AwardDefinitionId, AwardDefinition> = {
  player_of_month: {
    id: "player_of_month",
    cadence: "monthly",
    displayName: "Player of the Month",
    shortLabel: "POTM",
    subjectType: "player",
    tier: "monthly",
  },
  rookie_of_month: {
    id: "rookie_of_month",
    cadence: "monthly",
    displayName: "Rookie of the Month",
    shortLabel: "ROTM",
    subjectType: "player",
    tier: "monthly",
  },
  defensive_player_of_month: {
    id: "defensive_player_of_month",
    cadence: "monthly",
    displayName: "Defensive Player of the Month",
    shortLabel: "DPOTM",
    subjectType: "player",
    tier: "monthly",
  },
  mvp: {
    id: "mvp",
    cadence: "yearly",
    displayName: "Most Valuable Player",
    shortLabel: "MVP",
    subjectType: "player",
    tier: "major",
  },
  dpoy: {
    id: "dpoy",
    cadence: "yearly",
    displayName: "Defensive Player of the Year",
    shortLabel: "DPOY",
    subjectType: "player",
    tier: "major",
  },
  roy: {
    id: "roy",
    cadence: "yearly",
    displayName: "Rookie of the Year",
    shortLabel: "ROY",
    subjectType: "player",
    tier: "major",
  },
  sixth_man: {
    id: "sixth_man",
    cadence: "yearly",
    displayName: "Sixth Man of the Year",
    shortLabel: "6MOY",
    subjectType: "player",
    tier: "major",
  },
  most_improved: {
    id: "most_improved",
    cadence: "yearly",
    displayName: "Most Improved Player",
    shortLabel: "MIP",
    subjectType: "player",
    tier: "major",
  },
  coach_of_year: {
    id: "coach_of_year",
    cadence: "yearly",
    displayName: "Coach of the Year",
    shortLabel: "COTY",
    subjectType: "coach",
    tier: "major",
  },
};

export const MONTHLY_AWARD_IDS: readonly AwardDefinitionId[] = [
  "player_of_month",
  "rookie_of_month",
  "defensive_player_of_month",
] as const;

export const YEARLY_AWARD_IDS: readonly AwardDefinitionId[] = [
  "mvp",
  "dpoy",
  "roy",
  "sixth_man",
  "most_improved",
  "coach_of_year",
] as const;

export function getAwardDefinition(
  awardId: AwardDefinitionId,
): AwardDefinition {
  return AWARD_DEFINITIONS[awardId];
}

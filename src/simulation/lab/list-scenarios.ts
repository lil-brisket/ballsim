import { LAB_SCENARIO_IDS } from "@/simulation/lab/scenarios";
import {
  OWNER_CAREER_SCENARIO_ID,
  SCHEDULE_SCENARIO_ID,
  scenarioVersionFor,
} from "@/simulation/lab/scenario-version";

export type LabScenarioKind = "game" | "owner-career" | "schedule";

export type LabScenarioListing = {
  id: string;
  version: number;
  kind: LabScenarioKind;
};

export function listLabScenarios(): LabScenarioListing[] {
  const games: LabScenarioListing[] = LAB_SCENARIO_IDS.map((id) => ({
    id,
    version: scenarioVersionFor(id),
    kind: "game",
  }));
  return [
    ...games,
    {
      id: OWNER_CAREER_SCENARIO_ID,
      version: scenarioVersionFor(OWNER_CAREER_SCENARIO_ID),
      kind: "owner-career",
    },
    {
      id: SCHEDULE_SCENARIO_ID,
      version: scenarioVersionFor(SCHEDULE_SCENARIO_ID),
      kind: "schedule",
    },
  ];
}

export function formatLabScenarioList(
  listings: readonly LabScenarioListing[] = listLabScenarios(),
): string {
  return listings
    .map((item) => `${item.id}  v${item.version}  ${item.kind}`)
    .join("\n")
    .concat("\n");
}

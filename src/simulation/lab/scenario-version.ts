import {
  isLabScenarioId,
  type LabScenarioId,
} from "@/simulation/lab/scenarios";

export const DEFAULT_SCENARIO_VERSION = 1;

export const OWNER_CAREER_SCENARIO_ID = "owner-career";
export const SCHEDULE_SCENARIO_ID = "schedule";

export const LAB_SCENARIO_VERSIONS: Record<LabScenarioId, number> = {
  normal: DEFAULT_SCENARIO_VERSION,
  superteam: DEFAULT_SCENARIO_VERSION,
  weak: DEFAULT_SCENARIO_VERSION,
  shooting: DEFAULT_SCENARIO_VERSION,
  rebounding: DEFAULT_SCENARIO_VERSION,
  "min-roster": DEFAULT_SCENARIO_VERSION,
  "matchup-90-40": DEFAULT_SCENARIO_VERSION,
  "injury-heavy": DEFAULT_SCENARIO_VERSION,
  overtime: DEFAULT_SCENARIO_VERSION,
};

export function scenarioVersionFor(scenarioId: string): number {
  if (isLabScenarioId(scenarioId)) {
    return LAB_SCENARIO_VERSIONS[scenarioId];
  }
  if (scenarioId === OWNER_CAREER_SCENARIO_ID) {
    return DEFAULT_SCENARIO_VERSION;
  }
  if (scenarioId === SCHEDULE_SCENARIO_ID) {
    return DEFAULT_SCENARIO_VERSION;
  }
  throw new Error(`Unknown Lab scenario for version lookup: ${scenarioId}`);
}

export function compareScenarioVersions(left: number, right: number): void {
  if (left !== right) {
    throw new Error(
      `Cannot compare Lab runs: scenarioVersion ${left} !== ${right}. Re-run both on the same scenario definition.`,
    );
  }
}

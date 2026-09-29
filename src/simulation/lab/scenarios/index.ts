import { labRosterSeed } from "@/simulation/lab/lab-seeds";
import type { LabScenarioBuilder } from "@/simulation/lab/types";
import { buildInjuryHeavyRosters } from "@/simulation/lab/scenarios/injury-heavy";
import { buildMatchupScenarioRosters } from "@/simulation/lab/scenarios/matchup";
import { buildMinRosterRosters } from "@/simulation/lab/scenarios/min-roster";
import { buildNormalRosters } from "@/simulation/lab/scenarios/normal";
import { buildOvertimeRosters } from "@/simulation/lab/scenarios/overtime";
import { buildReboundingRosters } from "@/simulation/lab/scenarios/rebounding";
import { buildShootingRosters } from "@/simulation/lab/scenarios/shooting";
import { buildSuperteamRosters } from "@/simulation/lab/scenarios/superteam";
import { buildWeakRosters } from "@/simulation/lab/scenarios/weak";

export const LAB_SCENARIO_IDS = [
  "normal",
  "superteam",
  "weak",
  "shooting",
  "rebounding",
  "min-roster",
  "matchup-90-40",
  "injury-heavy",
  "overtime",
] as const;

export type LabScenarioId = (typeof LAB_SCENARIO_IDS)[number];

const BUILDERS: Record<LabScenarioId, LabScenarioBuilder> = {
  normal: (rng) => buildNormalRosters(rng),
  superteam: buildSuperteamRosters,
  weak: buildWeakRosters,
  shooting: buildShootingRosters,
  rebounding: buildReboundingRosters,
  "min-roster": buildMinRosterRosters,
  "matchup-90-40": buildMatchupScenarioRosters,
  "injury-heavy": buildInjuryHeavyRosters,
  overtime: buildOvertimeRosters,
};

export function isLabScenarioId(value: string): value is LabScenarioId {
  return (LAB_SCENARIO_IDS as readonly string[]).includes(value);
}

export function getScenarioBuilder(
  scenarioId: LabScenarioId,
): LabScenarioBuilder {
  return BUILDERS[scenarioId];
}

export function scenarioRngSeed(
  master: number | string,
  scenarioId: string,
): number {
  return labRosterSeed(master, scenarioId);
}

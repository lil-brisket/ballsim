import type { Player } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import type {
  CheckResult,
  ValidationAggregates,
} from "@/simulation/validation/types";

export type LabScenarioBuilder = (rng: Rng) => {
  homePlayers: Player[];
  awayPlayers: Player[];
};

export type InvariantSeverity = "HARD_FAILURE" | "WARNING" | "INFO";

export type LabScope =
  "game" | "player" | "team" | "season" | "league" | "economy";

export type RawInvariantFailure = {
  rule: string;
  detail: string;
  context?: Record<string, unknown>;
};

export type EngineIdentity = {
  packageVersion: string;
  schemaVersion: number;
  gameInvariantsChecksum: string;
  plausibilityChecksum: string;
};

export interface LabFailure extends RawInvariantFailure {
  severity: InvariantSeverity;
  scope: LabScope;
  seed: number | string;
  scenarioId: string;
  reproCommand: string;
  engineIdentity: EngineIdentity;
}

export type SimChannel = "pr" | "nightly";

export type LabRotationMode = "on" | "off";

export type LabReport = {
  seed: number | string;
  scenarioId: string;
  gamesSimulated: number;
  rotation: LabRotationMode;
  engineIdentity: EngineIdentity;
  reproCommand: string;
  hardFailures: LabFailure[];
  warnings: LabFailure[];
  statChecks: CheckResult[];
  checksum: string;
  aggregates: ValidationAggregates | null;
  overtimeHighCount: number;
  seasonsSimulated?: number;
};

export type LabFailureContext = {
  seed: number | string;
  scenarioId: string;
  reproCommand: string;
  engineIdentity: EngineIdentity;
};

export type FormatLabReportOptions = {
  json?: boolean;
  quiet?: boolean;
};

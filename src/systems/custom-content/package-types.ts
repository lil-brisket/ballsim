import type {
  PlayerArchetype,
  PlayerAttributes,
  PlayerNationality,
  PlayerPersonality,
  PlayerPosition,
  PlayerPotential,
} from "@/domain/entities/player";

export const CUSTOM_CONTENT_FORMAT_VERSION = 1 as const;

export type CustomContentType = "roster" | "draft_class";

export type CustomContentMetadata = {
  title: string;
  description?: string;
  author?: string;
  version: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomContentCompatibility = {
  gameStateSchemaVersion: number;
  minSchemaVersion: number;
};

export type CustomContentEnvelope<
  TType extends CustomContentType,
  TPayload,
> = {
  formatVersion: typeof CUSTOM_CONTENT_FORMAT_VERSION;
  type: TType;
  contentId: string;
  metadata: CustomContentMetadata;
  compatibility: CustomContentCompatibility;
  payload: TPayload;
};

export type RosterTeamSource = {
  sourceId: string;
  name: string;
  city?: string;
  abbreviation?: string;
};

export type PlayerContractSource = {
  years: number;
  annualSalary?: number;
};

export type PlayerSourceRecord = {
  sourceId: string;
  firstName: string;
  lastName: string;
  nationality: PlayerNationality;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: PlayerPosition;
  archetype: PlayerArchetype;
  attributes: PlayerAttributes;
  potential: PlayerPotential;
  personality: PlayerPersonality;
  durability?: number;
};

export type RosterPlayerSource = PlayerSourceRecord & {
  teamSourceId: string | null;
  contract?: PlayerContractSource;
};

export type RosterPackagePayload = {
  teams: RosterTeamSource[];
  players: RosterPlayerSource[];
};

export type DraftClassPackagePayload = {
  draftYear: number;
  prospects: PlayerSourceRecord[];
};

export type RosterPackage = CustomContentEnvelope<"roster", RosterPackagePayload>;

export type DraftClassPackage = CustomContentEnvelope<
  "draft_class",
  DraftClassPackagePayload
>;

export type CustomContentPackage = RosterPackage | DraftClassPackage;

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ImportValidationResult<T> = {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalized?: T;
};

export type RosterValidationContext = {
  teamCount: number;
  schemaVersion: number;
  seasonYear?: number;
  salaryCap?: number;
  salaryCapEnabled?: boolean;
  existingPlayerIds?: ReadonlySet<string>;
};

export type DraftClassValidationContext = {
  schemaVersion: number;
  seasonYear: number;
  draftHorizonYear: number;
  existingPlayerIds?: ReadonlySet<string>;
};

export function issue(
  path: string,
  code: string,
  message: string,
  severity: "error" | "warning" = "error",
): ValidationIssue {
  return { path, code, message, severity };
}

export function validationResult<T>(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  normalized?: T,
): ImportValidationResult<T> {
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: errors.length === 0 ? normalized : undefined,
  };
}

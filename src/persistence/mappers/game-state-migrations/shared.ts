import type { GameState } from "@/state/game-state";
import type {
  TeamId,
  TeamId as BrandTeamId,
  PlayerId,
  ContractId,
} from "@/domain/ids";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";
import type { GameTeamSnapshotV41 } from "@/persistence/mappers/game-state-migrations/v34-v41";
import type { ContractV15 } from "@/persistence/mappers/game-state-migrations/v08-v12";

/** Pre-v49 competition/user shapes — phase fields added only in migrateV48ToV49. */
export type CompetitionSlicePreV49 = Omit<
  GameState["competition"],
  "phase" | "seasonEvents"
>;

export type UserSlicePreV49 = Omit<
  GameState["user"],
  "franchisePhaseState" | "pendingDraftClassDecisions"
>;

export function legacyUserRecord(user: unknown): Record<string, unknown> {
  return user as Record<string, unknown>;
}

export function hasModernOwnershipUser(user: Record<string, unknown>): boolean {
  return (
    Array.isArray(user.ownedTeamIds) &&
    user.ownedTeamIds.length > 0 &&
    typeof user.ownedTeamIds[0] === "string" &&
    (user.ownedTeamIds[0] as string).length > 0 &&
    user.ownedFranchises != null &&
    typeof user.ownedFranchises === "object" &&
    typeof user.activeOwnerTeamId === "string" &&
    (user.activeOwnerTeamId as string).length > 0
  );
}

export function resolveLegacyControlledTeamId(
  user: Record<string, unknown>,
): TeamId | undefined {
  if (
    typeof user.controlledTeamId === "string" &&
    user.controlledTeamId.length > 0
  ) {
    return user.controlledTeamId as TeamId;
  }
  if (
    typeof user.activeOwnerTeamId === "string" &&
    user.activeOwnerTeamId.length > 0
  ) {
    return user.activeOwnerTeamId as TeamId;
  }
  if (
    Array.isArray(user.ownedTeamIds) &&
    typeof user.ownedTeamIds[0] === "string" &&
    (user.ownedTeamIds[0] as string).length > 0
  ) {
    return user.ownedTeamIds[0] as TeamId;
  }
  return undefined;
}

export function legacyUserArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function backfillSnapshotBranding(
  snapshot: GameTeamSnapshotV41 | null,
  teams: GameState["world"]["teams"],
): GameState["competition"]["games"][string]["homeTeamSnapshot"] {
  if (snapshot == null) {
    return null;
  }
  const live = teams[snapshot.teamId];
  const branding =
    snapshot.branding ??
    live?.branding ??
    deriveDefaultTeamBranding(snapshot.teamId, snapshot.city, snapshot.name);
  return {
    teamId: snapshot.teamId as BrandTeamId,
    city: snapshot.city,
    name: snapshot.name,
    abbreviation: snapshot.abbreviation,
    branding: {
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      logoId: branding.logoId,
    },
  };
}

export function findUniqueContractId(
  playerId: PlayerId,
  contracts: Record<string, ContractV15>,
): ContractId | null {
  const matches = Object.values(contracts).filter(
    (contract) => contract.playerId === playerId,
  );
  if (matches.length === 1) {
    return matches[0]!.id;
  }
  return null;
}

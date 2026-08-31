/**
 * Development League (DL) — secondary auto-simulated competition for
 * recently drafted prospects. Player.teamId = franchise ownership;
 * Team.roster = top-league roster only; DL assignment is a status flag.
 */

import type { TeamId } from "@/domain/ids";
import {
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonStatLine,
} from "@/domain/entities/player-history";

/** Maximum seasons a player may spend assigned to the Development League. */
export const DL_MAX_SEASONS = 3;

/**
 * Seasons from draft year during which a player may be assigned to the DL.
 * Separate from {@link DL_MAX_SEASONS} (actual seasons used).
 */
export const DL_DRAFT_ELIGIBILITY_SEASONS = 3;

/** Cap on incremental development opportunity bonus from DL minutes. */
export const DL_MAX_OPPORTUNITY_BONUS = 0.15;

export type DevelopmentLeagueStatus = "none" | "assigned";

export const DEVELOPMENT_LEAGUE_STATUSES: readonly DevelopmentLeagueStatus[] = [
  "none",
  "assigned",
] as const;

/** UI/auto-derived opportunity label — not a user-managed rotation system. */
export type DevelopmentLeagueRole = "starter" | "rotation" | "development";

export const DEVELOPMENT_LEAGUE_ROLES: readonly DevelopmentLeagueRole[] = [
  "starter",
  "rotation",
  "development",
] as const;

/** Derived (not persisted) promotion/readiness label. */
export type DevelopmentReadiness =
  | "not_ready"
  | "developing"
  | "near_ready"
  | "ready";

export const DEVELOPMENT_READINESS_LABELS: readonly DevelopmentReadiness[] = [
  "not_ready",
  "developing",
  "near_ready",
  "ready",
] as const;

/**
 * Per-player Development League state.
 * Does not duplicate the player record — lives on {@link Player}.
 */
export type DevelopmentLeagueProfile = {
  status: DevelopmentLeagueStatus;
  /** Franchise that owns the player while assigned (same as player.teamId). */
  parentTeamId: TeamId | null;
  role: DevelopmentLeagueRole;
  /** Completed DL seasons toward {@link DL_MAX_SEASONS} (0–3). */
  seasonsUsed: number;
  /** True if the player was assigned at any point during the current season. */
  assignedThisSeason: boolean;
  /**
   * Set on recall within a season — blocks re-assignment until season transition.
   * Prevents TOP→DL→TOP→DL cap/roster manipulation.
   */
  dlAssignmentLockedThisSeason: boolean;
  firstAssignedSeasonYear: number | null;
  /** Draft season year from DraftPickResult; null if never drafted / unknown. */
  draftSeasonYear: number | null;
  /**
   * Cache only — rebuild from DL games. Authoritative source is
   * competition.developmentLeague.games with competitionType development_league.
   */
  currentSeasonStats?: PlayerSeasonStatLine;
};

export function createDefaultDevelopmentLeagueProfile(): DevelopmentLeagueProfile {
  return {
    status: "none",
    parentTeamId: null,
    role: "development",
    seasonsUsed: 0,
    assignedThisSeason: false,
    dlAssignmentLockedThisSeason: false,
    firstAssignedSeasonYear: null,
    draftSeasonYear: null,
  };
}

export function isDevelopmentLeagueStatus(
  value: string,
): value is DevelopmentLeagueStatus {
  return (DEVELOPMENT_LEAGUE_STATUSES as readonly string[]).includes(value);
}

export function isDevelopmentLeagueRole(
  value: string,
): value is DevelopmentLeagueRole {
  return (DEVELOPMENT_LEAGUE_ROLES as readonly string[]).includes(value);
}

export function getDevelopmentLeagueSeasonsRemaining(
  profile: DevelopmentLeagueProfile | null | undefined,
): number {
  const used = profile?.seasonsUsed ?? 0;
  return Math.max(0, DL_MAX_SEASONS - used);
}

export function cloneDevelopmentLeagueProfile(
  profile: DevelopmentLeagueProfile,
): DevelopmentLeagueProfile {
  return {
    ...profile,
    currentSeasonStats:
      profile.currentSeasonStats == null
        ? undefined
        : { ...profile.currentSeasonStats },
  };
}

export function createEmptyDlSeasonStatsCache(): PlayerSeasonStatLine {
  return createEmptyPlayerSeasonStatLine();
}

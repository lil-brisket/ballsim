/**
 * Pure need detection for user-franchise management assistance.
 * Does not check permissions — callers ask management-policy separately.
 */

import type { StaffRole } from "@/domain/entities/staff";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { draftYearForSeason } from "@/systems/draft";
import { isUserOnDraftClock } from "@/systems/draft/draft-clock";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import { findTeamStaffByRole } from "@/systems/staff-effects";
import { STARTER_ROLES } from "@/systems/staff-generation";
import type { ManagementActionId } from "@/systems/simulation/management-actions";
import { isInLeaguePhase } from "@/systems/phase-engine";

export const COACHING_ROLES: readonly StaffRole[] = [
  "head_coach",
  "assistant_coach",
  "trainer",
];

export const FRONT_OFFICE_ROLES: readonly StaffRole[] = [
  "general_manager",
  "scout",
  "finance",
  "public_relations",
];

export type ManagementNeed = {
  id: string;
  actionId: ManagementActionId;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  /** Fingerprint for cooldown / re-evaluation. */
  needKey: string;
  metadata?: Record<string, unknown>;
};

/**
 * Detect management needs for the user-controlled franchise.
 */
export function detectManagementNeeds(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): ManagementNeed[] {
  const needs: ManagementNeed[] = [];

  needs.push(...detectRosterNeeds(state, teamId));
  needs.push(...detectRotationNeeds(state, teamId));
  needs.push(...detectStaffNeeds(state, teamId));
  needs.push(...detectDraftNeeds(state, teamId));

  return needs;
}

function detectRosterNeeds(
  state: GameState,
  teamId: TeamId,
): ManagementNeed[] {
  const team = state.world.teams[teamId];
  if (!team) {
    return [];
  }

  const needs: ManagementNeed[] = [];
  const healthyCount = countHealthyPlayers(state, team.roster);
  const injuredCount = team.roster.length - healthyCount;

  if (team.roster.length < DEFAULT_ROSTER_SIZE) {
    needs.push({
      id: "roster_below_min",
      actionId: "MAINTAIN_MIN_ROSTER",
      severity: "critical",
      title: "Roster below minimum",
      detail: `Roster has ${team.roster.length}/${DEFAULT_ROSTER_SIZE} players.`,
      needKey: `roster_below_min:${team.roster.length}`,
      metadata: {
        rosterSize: team.roster.length,
        minimum: DEFAULT_ROSTER_SIZE,
      },
    });
  }

  if (
    injuredCount > 0 &&
    healthyCount < GAME_SIMULATION_CONFIG.startingLineupSize
  ) {
    needs.push({
      id: "injury_roster_emergency",
      actionId: "SIGN_INJURY_REPLACEMENT",
      severity: "critical",
      title: "Injury emergency",
      detail: `Only ${healthyCount} healthy players available (need ${GAME_SIMULATION_CONFIG.startingLineupSize}).`,
      needKey: `injury_emergency:${healthyCount}`,
      metadata: { healthyCount, injuredCount },
    });
  }

  const inFaWindow = isInLeaguePhase(state, "offseason.free_agency");

  if (
    inFaWindow &&
    team.roster.length >= DEFAULT_ROSTER_SIZE &&
    hasObviousPositionalHole(state, teamId)
  ) {
    needs.push({
      id: "positional_fa_need",
      actionId: "SIGN_ROUTINE_FA",
      severity: "info",
      title: "Positional depth need",
      detail: "Roster has an obvious positional hole during free agency.",
      needKey: `positional_fa:${missingPositionKey(state, teamId)}`,
      metadata: {},
    });
  }

  return needs;
}

function detectRotationNeeds(
  state: GameState,
  teamId: TeamId,
): ManagementNeed[] {
  const team = state.world.teams[teamId];
  if (!team) {
    return [];
  }

  const healthy = team.roster.filter((playerId) => {
    const player = state.world.players[playerId];
    return player !== undefined && player.injury.kind === "healthy";
  });

  if (healthy.length < GAME_SIMULATION_CONFIG.startingLineupSize) {
    return [
      {
        id: "invalid_rotation",
        actionId: "FIX_INVALID_ROTATION",
        severity: "critical",
        title: "Invalid rotation",
        detail: `Fewer than ${GAME_SIMULATION_CONFIG.startingLineupSize} healthy players for a valid lineup.`,
        needKey: `invalid_rotation:${healthy.length}`,
        metadata: { healthyCount: healthy.length },
      },
    ];
  }

  // Injured players exist but enough healthy remain — continuity may rebalance.
  const injuredOnRoster = team.roster.some((playerId) => {
    const player = state.world.players[playerId];
    return player !== undefined && player.injury.kind === "injured";
  });
  if (injuredOnRoster) {
    return [
      {
        id: "injured_in_rotation",
        actionId: "FIX_INVALID_ROTATION",
        severity: "warning",
        title: "Injured player in rotation pool",
        detail: "Healthy substitutes should cover injured players for game validity.",
        needKey: `injured_rotation:${team.roster.filter((id) => state.world.players[id]?.injury.kind === "injured").length}`,
        metadata: {},
      },
    ];
  }

  return [];
}

function detectStaffNeeds(
  state: GameState,
  teamId: TeamId,
): ManagementNeed[] {
  const needs: ManagementNeed[] = [];

  for (const role of COACHING_ROLES) {
    if (findTeamStaffByRole(state, teamId, role) === null) {
      needs.push({
        id: `staff_gap_${role}`,
        actionId: "HIRE_REQUIRED_COACH",
        severity: "warning",
        title: "Coaching staff gap",
        detail: `Missing required coaching role: ${role}.`,
        needKey: `staff_gap:${role}`,
        metadata: { role },
      });
    }
  }

  for (const role of FRONT_OFFICE_ROLES) {
    if (findTeamStaffByRole(state, teamId, role) === null) {
      needs.push({
        id: `staff_gap_${role}`,
        actionId: "HIRE_REQUIRED_FRONT_OFFICE",
        severity: "warning",
        title: "Front office staff gap",
        detail: `Missing required front-office role: ${role}.`,
        needKey: `staff_gap:${role}`,
        metadata: { role },
      });
    }
  }

  // Ensure STARTER_ROLES coverage is complete (defensive).
  for (const role of STARTER_ROLES) {
    if (
      !COACHING_ROLES.includes(role) &&
      !FRONT_OFFICE_ROLES.includes(role) &&
      findTeamStaffByRole(state, teamId, role) === null
    ) {
      needs.push({
        id: `staff_gap_${role}`,
        actionId: "HIRE_REQUIRED_FRONT_OFFICE",
        severity: "warning",
        title: "Staff gap",
        detail: `Missing required staff role: ${role}.`,
        needKey: `staff_gap:${role}`,
        metadata: { role },
      });
    }
  }

  return needs;
}

function detectDraftNeeds(
  state: GameState,
  teamId: TeamId,
): ManagementNeed[] {
  if (!isUserOnDraftClock(state)) {
    return [];
  }

  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.status !== "active") {
    return [];
  }

  const onClock = draft.order.find((slot) => slot.status === "available");
  if (onClock === undefined || onClock.ownerTeamId !== teamId) {
    return [];
  }

  return [
    {
      id: "draft_clock",
      actionId: "DRAFT_PICK",
      severity: "critical",
      title: "Draft clock",
      detail: "Your team is on the draft clock.",
      needKey: `draft_clock:${onClock.draftPickId}`,
      metadata: { draftPickId: onClock.draftPickId },
    },
    {
      id: "draft_scout_on_clock",
      actionId: "DRAFT_SCOUT",
      severity: "info",
      title: "Draft recommendation",
      detail: "AI can recommend a prospect while you are on the clock.",
      needKey: `draft_scout:${onClock.draftPickId}`,
      metadata: { draftPickId: onClock.draftPickId },
    },
  ];
}

function countHealthyPlayers(
  state: GameState,
  roster: readonly PlayerId[],
): number {
  let count = 0;
  for (const playerId of roster) {
    const player = state.world.players[playerId];
    if (player && player.injury.kind === "healthy") {
      count += 1;
    }
  }
  return count;
}

function hasObviousPositionalHole(state: GameState, teamId: TeamId): boolean {
  return missingPositionKey(state, teamId) !== "none";
}

function missingPositionKey(state: GameState, teamId: TeamId): string {
  const team = state.world.teams[teamId];
  if (!team) {
    return "none";
  }
  const counts = new Map<string, number>();
  for (const playerId of team.roster) {
    const player = state.world.players[playerId];
    if (!player) {
      continue;
    }
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1);
  }
  for (const position of ["PG", "SG", "SF", "PF", "C"] as const) {
    if ((counts.get(position) ?? 0) === 0) {
      return position;
    }
  }
  return "none";
}

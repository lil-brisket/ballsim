/**
 * Atomic onboarding confirmation: select controlled franchises + apply identities.
 * Validates the full request before mutating any team.
 */

import { isTeamLogoId } from "@/data/team-branding/logo-catalog";
import {
  DEFAULT_OWNERSHIP_SETTINGS,
  maxControlledTeamCountForLeague,
} from "@/domain/game-settings";
import {
  validateTeamBranding,
  type TeamBranding,
} from "@/domain/entities/team-branding";
import type { TeamId } from "@/domain/ids";
import { asTeamId } from "@/domain/ids";
import { validateTeamNickname } from "@/domain/team-nickname";
import type { GameState } from "@/state/game-state";
import {
  getActiveOwnedFranchise,
  getOwnedFranchiseOrUndefined,
  withAddedOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";
import { createDefaultOwnedFranchiseState } from "@/state/owned-franchise-state";

export type ControlledFranchiseIdentityInput = {
  teamId: string;
  nickname: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: string;
};

export type ConfirmControlledFranchisesResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/**
 * Validate and apply controlled-franchise selection + identity in one transition.
 * Unselected teams are left unchanged. Anchor (activeOwnerTeamId) must be included.
 */
export function applyConfirmControlledFranchises(
  state: GameState,
  franchises: readonly ControlledFranchiseIdentityInput[],
): ConfirmControlledFranchisesResult {
  if (state.world.calendar.lastSimulatedDate !== null) {
    return {
      ok: false,
      error:
        "Franchise selection is locked after the first time advance for this save.",
    };
  }

  const anchorId = state.user.activeOwnerTeamId;
  const anchorFranchise = getActiveOwnedFranchise(state);
  if (!anchorFranchise.citySelectionConfirmed) {
    return {
      ok: false,
      error: "Choose a city before confirming controlled franchises.",
    };
  }
  if (anchorFranchise.franchiseIdentityConfirmed) {
    return {
      ok: false,
      error: "Controlled franchises are already confirmed for this save.",
    };
  }

  const teamCount = Object.keys(state.world.teams).length;
  const maxAllowed = maxControlledTeamCountForLeague(teamCount);
  const configuredCount =
    state.settings.ownership?.controlledTeamCount ??
    DEFAULT_OWNERSHIP_SETTINGS.controlledTeamCount;
  if (
    !Number.isInteger(configuredCount) ||
    configuredCount < 1 ||
    configuredCount > maxAllowed
  ) {
    return {
      ok: false,
      error: `Invalid ownership.controlledTeamCount (${configuredCount}).`,
    };
  }

  if (franchises.length !== configuredCount) {
    return {
      ok: false,
      error: `Select exactly ${configuredCount} franchise${configuredCount === 1 ? "" : "s"} to control.`,
    };
  }

  const seen = new Set<string>();
  for (const entry of franchises) {
    if (seen.has(entry.teamId)) {
      return { ok: false, error: "Duplicate franchise in selection." };
    }
    seen.add(entry.teamId);
  }

  if (!seen.has(anchorId)) {
    return {
      ok: false,
      error: "The initial franchise must remain selected.",
    };
  }

  // Build nickname uniqueness context that includes draft nicknames.
  const teamList = Object.values(state.world.teams).map((team) => ({
    id: team.id,
    city: team.city,
    name: team.name,
  }));

  type ResolvedIdentity = {
    teamId: TeamId;
    nickname: string;
    branding: TeamBranding;
  };

  const resolved: ResolvedIdentity[] = [];

  for (const entry of franchises) {
    const teamId = asTeamId(entry.teamId);
    const team = state.world.teams[teamId];
    if (!team) {
      return { ok: false, error: `Team "${entry.teamId}" does not exist.` };
    }

    if (!isTeamLogoId(entry.logoId)) {
      return { ok: false, error: `Unknown logo "${entry.logoId}".` };
    }

    const nick = validateTeamNickname(entry.nickname, {
      city: team.city,
      existingTeams: teamList,
      excludeTeamId: teamId,
    });
    if (!nick.ok) {
      return {
        ok: false,
        error: `${team.city}: ${nick.error}`,
      };
    }

    // Cross-check against other drafts in this payload.
    for (const other of resolved) {
      if (other.nickname.toLowerCase() === nick.value.toLowerCase()) {
        return {
          ok: false,
          error: `Nickname "${nick.value}" is used by more than one controlled franchise.`,
        };
      }
    }

    const brandingResult = validateTeamBranding({
      primaryColor: entry.primaryColor,
      secondaryColor: entry.secondaryColor,
      accentColor: entry.accentColor,
      logoId: entry.logoId,
    });
    if (!brandingResult.ok) {
      return {
        ok: false,
        error: `${team.city}: ${brandingResult.error}`,
      };
    }

    resolved.push({
      teamId,
      nickname: nick.value,
      branding: brandingResult.value,
    });

    // So subsequent nickname checks see this draft as taken for other teams.
    const listIndex = teamList.findIndex((t) => t.id === teamId);
    if (listIndex >= 0) {
      teamList[listIndex] = {
        ...teamList[listIndex]!,
        name: nick.value,
      };
    }
  }

  let working = state;
  const nextTeams = { ...working.world.teams };

  for (const entry of resolved) {
    const team = nextTeams[entry.teamId];
    if (!team) {
      return { ok: false, error: `Team "${entry.teamId}" does not exist.` };
    }
    nextTeams[entry.teamId] = {
      ...team,
      name: entry.nickname,
      branding: entry.branding,
    };
  }

  working = {
    ...working,
    world: {
      ...working.world,
      teams: nextTeams,
    },
  };

  for (const entry of resolved) {
    const existing = getOwnedFranchiseOrUndefined(working, entry.teamId);
    if (existing) {
      working = withOwnedFranchise(working, entry.teamId, {
        ...existing,
        citySelectionConfirmed: true,
        franchiseIdentityConfirmed: true,
      });
      continue;
    }
    const franchise = createDefaultOwnedFranchiseState({
      seasonYear: working.competition.season.year,
      currentDate: working.world.calendar.currentDate,
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
      aiAssistance: { ...working.settings.ai.assistance },
      managementPreset: working.settings.ai.managementPreset,
    });
    working = withAddedOwnedFranchise(working, entry.teamId, franchise);
  }

  // Keep anchor as active; ensure ownedTeamIds matches selection exactly.
  const ownedTeamIds = resolved.map((entry) => entry.teamId);
  if (!ownedTeamIds.includes(anchorId)) {
    return { ok: false, error: "The initial franchise must remain selected." };
  }

  const ownedFranchises: GameState["user"]["ownedFranchises"] = {};
  for (const teamId of ownedTeamIds) {
    const franchise = working.user.ownedFranchises[teamId];
    if (!franchise) {
      return {
        ok: false,
        error: `Owned franchise state missing for "${teamId}".`,
      };
    }
    ownedFranchises[teamId] = franchise;
  }

  working = {
    ...working,
    user: {
      ...working.user,
      ownedTeamIds,
      activeOwnerTeamId: anchorId,
      ownedFranchises,
    },
  };

  return { ok: true, state: working };
}

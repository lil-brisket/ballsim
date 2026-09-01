/**
 * Derived presentation projections run AFTER advanceSimulation and BEFORE persist.
 * Keeps media/social feed caches off the authoritative persistence write path itself.
 */

import {
  createEmptyMediaFeed,
  createEmptyMediaReadState,
} from "@/domain/entities/media-item";
import { createEmptySocialFeed } from "@/domain/entities/social-post";
import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { GameState, OwnedFranchiseState } from "@/state/game-state";
import { processMediaFromEvents } from "@/systems/media-hub/process-media-from-events";

function ensureMediaFields(franchise: OwnedFranchiseState): OwnedFranchiseState {
  return {
    ...franchise,
    mediaFeed: franchise.mediaFeed ?? createEmptyMediaFeed(),
    socialFeed: franchise.socialFeed ?? createEmptySocialFeed(),
    mediaReadState: franchise.mediaReadState ?? createEmptyMediaReadState(),
  };
}

/**
 * For each owned franchise, project league domain events into media + social feeds
 * with per-franchise relevance scoring.
 *
 * Call after {@link advanceSimulation} (or other event-emitting commands) and
 * before {@link persistWorkingState}. Do not invoke from inside persistence.
 */
export function processDerivedProjections(
  state: GameState,
  events: readonly DomainEvent[],
): GameState {
  if (events.length === 0) {
    return state;
  }

  const ownedTeamIds = state.user.ownedTeamIds;
  if (ownedTeamIds.length === 0) {
    return state;
  }

  let ownedFranchises = state.user.ownedFranchises;
  let changed = false;

  for (const teamId of [...ownedTeamIds].sort()) {
    const raw = ownedFranchises[teamId];
    if (!raw) {
      continue;
    }
    const franchise = ensureMediaFields(raw);
    const result = processMediaFromEvents(
      state,
      events,
      { teamId: teamId as TeamId },
      franchise.mediaFeed,
      franchise.socialFeed,
    );

    if (result.items.length === 0 && result.socialPosts.length === 0) {
      if (
        franchise.mediaFeed !== raw.mediaFeed ||
        franchise.socialFeed !== raw.socialFeed ||
        franchise.mediaReadState !== raw.mediaReadState
      ) {
        ownedFranchises = {
          ...ownedFranchises,
          [teamId]: franchise,
        };
        changed = true;
      }
      continue;
    }

    ownedFranchises = {
      ...ownedFranchises,
      [teamId]: {
        ...franchise,
        mediaFeed: result.mediaFeed,
        socialFeed: result.socialFeed,
      },
    };
    changed = true;
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    user: {
      ...state.user,
      ownedFranchises,
    },
  };
}

/**
 * Owner training camps: one camp (stored as a development focus) per player
 * on the owned team. The camp shifts how offseason growth and decline are
 * spread (see redistributeForFocus); it never adds growth.
 */

import {
  isDevelopmentFocus,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";

export function setDevelopmentFocus(
  state: GameState,
  playerId: PlayerId,
  focus: string,
): { ok: true; state: GameState } | { ok: false; error: string } {
  if (!isDevelopmentFocus(focus)) {
    return { ok: false, error: "Unknown training camp." };
  }
  const player = state.world.players[playerId];
  if (!player || player.teamId == null) {
    return { ok: false, error: "Player is not on a roster." };
  }
  if (
    player.teamId !== state.user.activeOwnerTeamId ||
    !isUserControlledTeam(state, player.teamId)
  ) {
    return { ok: false, error: "Player is not on your team." };
  }
  const plans = { ...(state.business.developmentPlans ?? {}) };
  if (focus === "balanced") {
    delete plans[playerId];
  } else {
    plans[playerId] = focus as DevelopmentFocus;
  }
  return {
    ok: true,
    state: {
      ...state,
      business: { ...state.business, developmentPlans: plans },
    },
  };
}

/**
 * Set several camps at once (the camps form). All or nothing: the first
 * invalid entry rejects the whole batch.
 */
export function setDevelopmentFocuses(
  state: GameState,
  entries: readonly { playerId: PlayerId; focus: string }[],
): { ok: true; state: GameState } | { ok: false; error: string } {
  let next = state;
  for (const entry of entries) {
    const result = setDevelopmentFocus(next, entry.playerId, entry.focus);
    if (!result.ok) return result;
    next = result.state;
  }
  return { ok: true, state: next };
}

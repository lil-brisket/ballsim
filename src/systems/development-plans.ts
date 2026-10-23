/**
 * Owner development plans: one focus per young player on an owned team.
 * The focus shifts how offseason growth is spread (see developPlayer); it
 * never adds growth.
 */

import {
  isDevelopmentFocus,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import { DEVELOPMENT_PLAN_MAX_AGE } from "@/systems/player-development";

export function setDevelopmentFocus(
  state: GameState,
  playerId: PlayerId,
  focus: string,
): { ok: true; state: GameState } | { ok: false; error: string } {
  if (!isDevelopmentFocus(focus)) {
    return { ok: false, error: "Unknown development focus." };
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
  if (player.age > DEVELOPMENT_PLAN_MAX_AGE) {
    return {
      ok: false,
      error: `Development plans are for players ${DEVELOPMENT_PLAN_MAX_AGE} and younger.`,
    };
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

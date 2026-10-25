/**
 * Offseason training camps (stored as development focuses). Every team can
 * send any player, up to the camp slots its trainer provides. A camp only
 * adds growth to its skills (see applyCampBonus).
 */

import {
  DEFAULT_FOCUS_BY_POSITION,
  isDevelopmentFocus,
  type DevelopmentFocus,
} from "@/domain/entities/development-plan";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import { findTeamStaffByRole } from "@/systems/staff-effects/find";
import { averageAttrs } from "@/systems/staff-effects/shared";

/** Camp slots without a trainer on staff. */
export const CAMP_SLOTS_WITHOUT_TRAINER = 1;
/** Trainer development score → camp slots (first threshold met wins). */
export const CAMP_SLOT_THRESHOLDS: readonly {
  minScore: number;
  slots: number;
}[] = [
  { minScore: 80, slots: 5 },
  { minScore: 65, slots: 4 },
  { minScore: 50, slots: 3 },
  { minScore: 0, slots: 2 },
];

/** How many players a team may send to camp, set by its trainer. */
export function campSlotsForTeam(state: GameState, teamId: TeamId): number {
  const trainer = findTeamStaffByRole(state, teamId, "trainer");
  if (!trainer) return CAMP_SLOTS_WITHOUT_TRAINER;
  const score = averageAttrs(trainer.attributes as Record<string, number>, [
    "playerDevelopment",
    "skillDevelopment",
    "potentialDevelopment",
  ]);
  return (
    CAMP_SLOT_THRESHOLDS.find((tier) => score >= tier.minScore)?.slots ??
    CAMP_SLOTS_WITHOUT_TRAINER
  );
}

/** Owner camps that count for a team: its rostered players, in roster order. */
function ownerCampEntries(
  state: GameState,
  teamId: TeamId,
): [PlayerId, DevelopmentFocus][] {
  const plans = state.business.developmentPlans ?? {};
  const roster = state.world.teams[teamId]?.roster ?? [];
  return roster.flatMap((playerId) => {
    const focus = plans[playerId];
    return focus && focus !== "balanced"
      ? [[playerId as PlayerId, focus] as [PlayerId, DevelopmentFocus]]
      : [];
  });
}

/**
 * Who attends camp this offseason, by player id. User teams send their
 * picks (the first `slots` in roster order, should the trainer have
 * changed); CPU teams send the players with the most room to grow to their
 * position's camp. Deterministic, no RNG.
 */
export function campAssignments(
  state: GameState,
): Record<string, DevelopmentFocus> {
  const result: Record<string, DevelopmentFocus> = {};
  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    const slots = campSlotsForTeam(state, teamId);
    if (isUserControlledTeam(state, teamId)) {
      for (const [playerId, focus] of ownerCampEntries(state, teamId).slice(
        0,
        slots,
      )) {
        result[playerId] = focus;
      }
      continue;
    }
    const candidates = (state.world.teams[teamId]?.roster ?? [])
      .map((playerId) => state.world.players[playerId])
      .filter((player) => player != null && player.retired !== true)
      .map((player) => ({
        player: player!,
        headroom:
          player!.potential.overall -
          calculatePlayerOverall(player!.position, player!.attributes),
      }))
      .sort(
        (a, b) =>
          b.headroom - a.headroom ||
          a.player.age - b.player.age ||
          a.player.id.localeCompare(b.player.id),
      );
    for (const { player } of candidates.slice(0, slots)) {
      result[player.id] = DEFAULT_FOCUS_BY_POSITION[player.position];
    }
  }
  return result;
}

export function setDevelopmentFocus(
  state: GameState,
  playerId: PlayerId,
  focus: string,
): { ok: true; state: GameState } | { ok: false; error: string } {
  return setDevelopmentFocuses(state, [{ playerId, focus }]);
}

/**
 * Set several camps at once (the camps form). All or nothing: any invalid
 * entry, or more campers than the trainer's slots, rejects the batch.
 */
export function setDevelopmentFocuses(
  state: GameState,
  entries: readonly { playerId: PlayerId; focus: string }[],
): { ok: true; state: GameState } | { ok: false; error: string } {
  const teamId = state.user.activeOwnerTeamId;
  const plans = { ...(state.business.developmentPlans ?? {}) };
  for (const { playerId, focus } of entries) {
    if (!isDevelopmentFocus(focus)) {
      return { ok: false, error: "Unknown training camp." };
    }
    const player = state.world.players[playerId];
    if (!player || player.teamId == null) {
      return { ok: false, error: "Player is not on a roster." };
    }
    if (player.teamId !== teamId || !isUserControlledTeam(state, teamId)) {
      return { ok: false, error: "Player is not on your team." };
    }
    if (focus === "balanced") {
      delete plans[playerId];
    } else {
      plans[playerId] = focus;
    }
  }
  const next: GameState = {
    ...state,
    business: { ...state.business, developmentPlans: plans },
  };
  const slots = campSlotsForTeam(state, teamId);
  if (ownerCampEntries(next, teamId).length > slots) {
    return {
      ok: false,
      error: `Your trainer can run ${slots} camp ${slots === 1 ? "spot" : "spots"}. Remove a player first.`,
    };
  }
  return { ok: true, state: next };
}

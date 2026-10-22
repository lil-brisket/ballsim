/**
 * Release dialog view: what waiving or buying out a player costs, season by
 * season. Presentation only; the math lives in systems/player-release.
 */

import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { getActionBlockReason } from "@/systems/league-rules";
import {
  getPlayerReleaseBlockReason,
  previewPlayerRelease,
  type ReleaseMode,
  type ReleaseSeasonCost,
} from "@/systems/player-release";

export type ReleaseOptionView = {
  mode: ReleaseMode;
  /** Buyout lump paid now (0 for a waive). */
  cashNow: number;
  /** Buyout: share of the remaining salary the player accepts. */
  buyoutRate: number | null;
  totalDeadMoney: number;
  seasons: ReleaseSeasonCost[];
  capSpaceAfter: number;
};

export type PlayerReleaseView = {
  playerId: string;
  /** Salary still owed under the contract. */
  remainingSalary: number;
  /** Why the release is not allowed right now, or null. */
  blockedReason: string | null;
  waive: ReleaseOptionView;
  buyout: ReleaseOptionView;
};

/**
 * Null when the player is not under contract with the active owner team.
 */
export function toPlayerReleaseView(
  state: GameState,
  playerId: string,
): PlayerReleaseView | null {
  const teamId = getActiveOwnerTeamId(state);
  const player = state.world.players[playerId];
  const contract =
    player?.contractId != null
      ? state.business.contracts[player.contractId]
      : undefined;
  if (!player || player.teamId !== teamId || contract?.teamId !== teamId) {
    return null;
  }
  const id = playerId as PlayerId;
  const option = (mode: ReleaseMode): ReleaseOptionView => {
    const preview = previewPlayerRelease(state, { playerId: id, teamId, mode });
    return {
      mode,
      cashNow: preview.cashNow,
      buyoutRate: preview.buyoutRate,
      totalDeadMoney: preview.entries.reduce((sum, e) => sum + e.amount, 0),
      seasons: preview.seasons,
      capSpaceAfter: preview.capSpaceAfter,
    };
  };
  const waive = option("waive");
  return {
    playerId,
    remainingSalary: previewPlayerRelease(state, {
      playerId: id,
      teamId,
      mode: "waive",
    }).remainingSalary,
    blockedReason:
      getActionBlockReason(state, {
        kind: "player_release",
        playerId: id,
        teamId,
      }) ?? getPlayerReleaseBlockReason(state, { playerId: id, teamId }),
    waive,
    buyout: option("buyout"),
  };
}

/**
 * Free-agent interest panel: what he cares about, how the owner team rates
 * on each factor, and roughly what he would sign for. Presentation only;
 * the scoring lives in systems/free-agency and free-agency-motivations.
 */

import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { computeAwardReputationBonus } from "@/systems/awards/award-reputation";
import { FREE_AGENCY_INTEREST_CONFIG } from "@/systems/free-agency-config";
import {
  readFreeAgentMotivations,
  topMotivations,
  type FreeAgentMotivation,
} from "@/systems/free-agency-motivations";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  REPLACEMENT_LEVEL_OVERALL,
  vetMinSalary,
} from "@/systems/salary-scale";
import { freeAgentAsk } from "@/systems/free-agent-market";

export const MOTIVATION_LABELS: Record<FreeAgentMotivation, string> = {
  winning: "winning",
  playingTime: "minutes",
  market: "a big market",
  loyalty: "loyalty",
  coach: "the coach",
};

export type FreeAgentInterestView = {
  /** His top two concerns, e.g. ["winning", "minutes"]. */
  caresAbout: string[];
  /** How the owner team scores on each factor (points, + helps). */
  factors: { label: string; points: number }[];
  /** First-year salary he would accept from the owner team, or null if none would do. */
  salaryToSign: number | null;
};

export function toFreeAgentInterestView(
  state: GameState,
  playerId: string,
  teamId: TeamId = getActiveOwnerTeamId(state),
): FreeAgentInterestView | null {
  const id = playerId as PlayerId;
  const player = state.world.players[id];
  if (!player) return null;
  const readings = readFreeAgentMotivations(state, id, teamId);
  const cfg = FREE_AGENCY_INTEREST_CONFIG;
  const rest =
    cfg.baselineScore +
    computeAwardReputationBonus(id, state) +
    readings.reduce((sum, r) => sum + r.points, 0);
  return {
    caresAbout: topMotivations(state, id).map((m) => MOTIVATION_LABELS[m]),
    factors: readings.map((r) => ({
      label: MOTIVATION_LABELS[r.motivation],
      points: r.points,
    })),
    salaryToSign: salaryToSign(state, id, rest),
  };
}

/** Invert the money score: the smallest salary that reaches the threshold. */
function salaryToSign(
  state: GameState,
  playerId: PlayerId,
  scoreWithoutMoney: number,
): number | null {
  const player = state.world.players[playerId]!;
  const cfg = FREE_AGENCY_INTEREST_CONFIG;
  const overall = calculatePlayerOverall(player.position, player.attributes);
  const cap = getLeagueSalaryCap(state);
  const market = freeAgentAsk(state, player);
  const needed = cfg.interestThreshold - scoreWithoutMoney;
  if (overall < REPLACEMENT_LEVEL_OVERALL && needed <= 0) {
    return vetMinSalary(cap);
  }
  // Money score = clamp((ratio - 0.7) * 80 - 20, -40, 20).
  if (needed > 20) return null;
  const money = Math.max(-40, needed);
  const ratio = (money + 20) / 80 + 0.7;
  const salary = Math.ceil((ratio * market) / 50_000) * 50_000;
  return Math.max(vetMinSalary(cap), salary);
}

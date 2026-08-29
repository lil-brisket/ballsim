/**
 * @deprecated Prefer src/systems/rotation/*. Kept for import compatibility.
 * Position-aware rotation substitutions driven by planned/target minutes.
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { buildRotationPlan } from "@/systems/rotation/rotation-planner";
import { evaluateSubstitutions } from "@/systems/rotation/substitution-engine";
import { buildRotationGameContext } from "@/systems/rotation/rotation-game-context";
import { isPlayerAvailable } from "@/systems/player-availability";

export type RotationSimSide = {
  teamId: TeamId;
  onCourt: Player[];
  /** Slot order matching onCourt (PG..C when possible). */
  slots: PlayerPosition[];
};

export type SubstitutionResult = {
  onCourt: Player[];
  slots: PlayerPosition[];
  substituted: boolean;
  playerOutId?: PlayerId;
  playerInId?: PlayerId;
  emergencyMismatch?: boolean;
};

/**
 * At period breaks / checkpoints: apply at most one tactical sub (compat shim).
 */
export function applyRotationSubstitutions(input: {
  state: GameState;
  side: RotationSimSide;
  secondsOnCourt: ReadonlyMap<string, number>;
  elapsedGameSeconds: number;
}): SubstitutionResult {
  const { state, side, secondsOnCourt, elapsedGameSeconds } = input;
  const team = state.world.teams[side.teamId];
  if (team == null || side.onCourt.length === 0) {
    return {
      onCourt: side.onCourt,
      slots: side.slots,
      substituted: false,
    };
  }

  const roster = team.roster
    .map((id) => state.world.players[id])
    .filter((p): p is Player => p != null);
  const available = new Set(
    roster
      .filter((p) => isPlayerAvailable(state, p.id, side.teamId))
      .map((p) => p.id as string),
  );
  const plan = buildRotationPlan({
    teamId: side.teamId,
    management: team.rosterManagement,
    rosterPlayers: roster,
    availablePlayerIds: available,
  });

  const context = buildRotationGameContext({
    periodNumber: Math.floor(elapsedGameSeconds / 720) + 1,
    secondsRemainingInPeriod: 720,
    elapsedGameSeconds,
    teamScore: 0,
    opponentScore: 0,
    competitionType: "regular_season",
  });

  const onCourtIds = new Set(side.onCourt.map((p) => p.id));
  const result = evaluateSubstitutions({
    teamId: side.teamId,
    onCourt: side.onCourt,
    slots: side.slots,
    benchPool: roster.filter((p) => !onCourtIds.has(p.id)),
    plan,
    secondsOnCourt,
    continuousSecondsOnCourt: new Map(),
    lastSubElapsedSeconds: new Map(),
    foulsByPlayerId: new Map(),
    fouledOutIds: new Set(),
    unavailableIds: new Set(
      roster
        .filter((p) => !isPlayerAvailable(state, p.id, side.teamId))
        .map((p) => p.id as string),
    ),
    fatigueByPlayerId: new Map(),
    elapsedGameSeconds,
    context,
    checkpoint: "period_start",
    remainingGameMinutes: Math.max(0, 48 - elapsedGameSeconds / 60),
  });

  const decision = result.decisions[0];
  if (decision == null) {
    return {
      onCourt: side.onCourt,
      slots: side.slots,
      substituted: false,
    };
  }

  return {
    onCourt: result.onCourt,
    slots: result.slots,
    substituted: true,
    playerOutId: decision.playerOutId,
    playerInId: decision.playerInId,
  };
}

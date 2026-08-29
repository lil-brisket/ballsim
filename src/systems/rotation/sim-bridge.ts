/**
 * Bridges GameSimState ↔ rotation planner / substitution engine.
 */

import type { Player } from "@/domain/entities/player";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import type { GameSimState } from "@/systems/game-sim-state";
import { GAME_SIMULATION_CONFIG } from "@/systems/game-simulation-config";
import { isPlayerAvailable } from "@/systems/player-availability";
import { cloneTeamRosterManagement } from "@/domain/entities/team-roster-management";
import { buildRotationPlan } from "@/systems/rotation/rotation-planner";
import {
  evaluateSubstitutions,
  type SubstitutionCheckpoint,
} from "@/systems/rotation/substitution-engine";
import {
  buildRotationGameContext,
  isInRotationWindow,
} from "@/systems/rotation/rotation-game-context";
import { computeFatigue } from "@/systems/rotation/rotation-fatigue";
import {
  foulTroubleLevel,
  isFouledOut,
} from "@/systems/rotation/rotation-foul-trouble";
import { appendTraceEntry } from "@/systems/rotation/rotation-trace";
import { buildMinuteExplanations } from "@/systems/rotation/rotation-explanations";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";

export function initializeRotationForSim(
  sim: GameSimState,
  state: GameState | undefined,
  homePlayers: readonly Player[],
  awayPlayers: readonly Player[],
): void {
  if (state == null) {
    return;
  }

  const homeTeam = state.world.teams[sim.homeTeamId];
  const awayTeam = state.world.teams[sim.awayTeamId];
  if (homeTeam == null || awayTeam == null) {
    return;
  }

  sim.homeRotationSnapshot = cloneTeamRosterManagement(
    homeTeam.rosterManagement,
  ).rotation;
  sim.awayRotationSnapshot = cloneTeamRosterManagement(
    awayTeam.rosterManagement,
  ).rotation;

  const homeAvailable = new Set(
    homePlayers
      .filter((player) => isPlayerAvailable(state, player.id, sim.homeTeamId))
      .map((player) => player.id as string),
  );
  const awayAvailable = new Set(
    awayPlayers
      .filter((player) => isPlayerAvailable(state, player.id, sim.awayTeamId))
      .map((player) => player.id as string),
  );

  sim.homeRotationPlan = buildRotationPlan({
    teamId: sim.homeTeamId,
    management: homeTeam.rosterManagement,
    rosterPlayers: homePlayers,
    availablePlayerIds: homeAvailable,
    regulationPeriodCount: GAME_SIMULATION_CONFIG.regulationPeriodCount,
  });
  sim.awayRotationPlan = buildRotationPlan({
    teamId: sim.awayTeamId,
    management: awayTeam.rosterManagement,
    rosterPlayers: awayPlayers,
    availablePlayerIds: awayAvailable,
    regulationPeriodCount: GAME_SIMULATION_CONFIG.regulationPeriodCount,
  });

  appendTraceEntry(sim.rotationTrace, {
    periodNumber: 1,
    secondsRemaining: GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
    teamId: sim.homeTeamId,
    playerOutId: null,
    playerInId: null,
    reason: "starting_lineup",
    detail: `Starting lineup: ${sim.homeOnCourt.map((p) => p.id).join(", ")}`,
    forced: false,
  });
  appendTraceEntry(sim.rotationTrace, {
    periodNumber: 1,
    secondsRemaining: GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
    teamId: sim.awayTeamId,
    playerOutId: null,
    playerInId: null,
    reason: "starting_lineup",
    detail: `Starting lineup: ${sim.awayOnCourt.map((p) => p.id).join(", ")}`,
    forced: false,
  });
}

function unavailableIdsForTeam(
  state: GameState | undefined,
  teamId: TeamId,
  roster: readonly Player[],
  fouledOut: ReadonlySet<string>,
): Set<string> {
  const ids = new Set<string>([...fouledOut]);
  if (state == null) {
    return ids;
  }
  for (const player of roster) {
    if (!isPlayerAvailable(state, player.id, teamId)) {
      ids.add(player.id);
    }
  }
  return ids;
}

function applySideSubstitutions(input: {
  sim: GameSimState;
  state: GameState | undefined;
  teamId: TeamId;
  onCourt: Player[];
  roster: readonly Player[];
  plan: NonNullable<GameSimState["homeRotationPlan"]>;
  checkpoint: SubstitutionCheckpoint;
  periodNumber: number;
  secondsRemaining: number;
}): Player[] {
  const {
    sim,
    state,
    teamId,
    onCourt,
    roster,
    plan,
    checkpoint,
    periodNumber,
    secondsRemaining,
  } = input;

  const isHome = teamId === sim.homeTeamId;
  const teamScore = isHome ? sim.homeScore : sim.awayScore;
  const oppScore = isHome ? sim.awayScore : sim.homeScore;

  const context = buildRotationGameContext({
    periodNumber,
    secondsRemainingInPeriod: secondsRemaining,
    elapsedGameSeconds: sim.elapsedGameSeconds,
    teamScore,
    opponentScore: oppScore,
    competitionType: sim.competitionType,
    regulationPeriodCount: GAME_SIMULATION_CONFIG.regulationPeriodCount,
  });
  sim.situationsSeen.add(context.situation);

  const foulsByPlayerId = new Map<string, number>();
  for (const playerId of sim.playerStatsOrder) {
    const row = sim.playerStatsById.get(playerId);
    if (row != null) {
      foulsByPlayerId.set(playerId, row.fouls);
    }
  }

  // Update fatigue for on-court players
  for (const player of onCourt) {
    const fatigue = computeFatigue({
      player,
      continuousSecondsOnCourt:
        sim.continuousSecondsOnCourt.get(player.id) ?? 0,
      totalSecondsOnCourt: sim.secondsOnCourt.get(player.id) ?? 0,
      secondsSinceLastRest: Math.max(
        0,
        sim.elapsedGameSeconds -
          (sim.lastSubElapsedSeconds.get(player.id) ?? 0),
      ),
    });
    sim.fatigueByPlayerId.set(player.id, fatigue);
    const peak = sim.peakFatigueByPlayerId.get(player.id) ?? 0;
    if (fatigue > peak) {
      sim.peakFatigueByPlayerId.set(player.id, fatigue);
    }
  }

  const unavailableIds = unavailableIdsForTeam(
    state,
    teamId,
    roster,
    sim.fouledOutPlayerIds,
  );

  const onCourtIds = new Set(onCourt.map((p) => p.id));
  const benchPool = roster.filter((player) => !onCourtIds.has(player.id));

  const remainingGameMinutes = Math.max(
    0,
    (GAME_SIMULATION_CONFIG.regulationPeriodCount *
      GAME_SIMULATION_CONFIG.regulationPeriodSeconds -
      Math.min(
        sim.elapsedGameSeconds,
        GAME_SIMULATION_CONFIG.regulationPeriodCount *
          GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
      )) /
      60 +
      sim.overtimePeriodCount * ROTATION_CONFIG.overtimePeriodMinutes,
  );

  const result = evaluateSubstitutions({
    teamId,
    onCourt,
    slots: onCourt.map((player) => player.position),
    benchPool,
    plan,
    secondsOnCourt: sim.secondsOnCourt,
    continuousSecondsOnCourt: sim.continuousSecondsOnCourt,
    lastSubElapsedSeconds: sim.lastSubElapsedSeconds,
    foulsByPlayerId,
    fouledOutIds: sim.fouledOutPlayerIds,
    unavailableIds,
    fatigueByPlayerId: sim.fatigueByPlayerId,
    elapsedGameSeconds: sim.elapsedGameSeconds,
    context,
    checkpoint,
    remainingGameMinutes,
  });

  for (const decision of result.decisions) {
    appendTraceEntry(sim.rotationTrace, {
      periodNumber,
      secondsRemaining,
      teamId,
      playerOutId: decision.playerOutId,
      playerInId: decision.playerInId,
      reason: decision.reason,
      detail: decision.detail,
      forced: decision.forced,
    });
    sim.events.push({
      sequence: sim.events.length + 1,
      type: "substitution",
      teamId,
      playerId: decision.playerInId,
    });
    if (!sim.secondsOnCourt.has(decision.playerInId)) {
      sim.secondsOnCourt.set(decision.playerInId, 0);
    }
    sim.continuousSecondsOnCourt.set(decision.playerOutId, 0);
    sim.continuousSecondsOnCourt.set(decision.playerInId, 0);
    sim.lastSubElapsedSeconds.set(
      decision.playerOutId,
      sim.elapsedGameSeconds,
    );
    sim.lastSubElapsedSeconds.set(
      decision.playerInId,
      sim.elapsedGameSeconds,
    );
  }

  return result.onCourt;
}

export function runSubstitutionCheckpoint(
  sim: GameSimState,
  state: GameState | undefined,
  checkpoint: SubstitutionCheckpoint,
  periodNumber: number,
  secondsRemaining: number,
  homeRoster: readonly Player[],
  awayRoster: readonly Player[],
): void {
  if (sim.homeRotationPlan != null) {
    sim.homeOnCourt = applySideSubstitutions({
      sim,
      state,
      teamId: sim.homeTeamId,
      onCourt: sim.homeOnCourt,
      roster: homeRoster,
      plan: sim.homeRotationPlan,
      checkpoint,
      periodNumber,
      secondsRemaining,
    });
  }
  if (sim.awayRotationPlan != null) {
    sim.awayOnCourt = applySideSubstitutions({
      sim,
      state,
      teamId: sim.awayTeamId,
      onCourt: sim.awayOnCourt,
      roster: awayRoster,
      plan: sim.awayRotationPlan,
      checkpoint,
      periodNumber,
      secondsRemaining,
    });
  }
}

export function maybeRunRotationWindow(
  sim: GameSimState,
  state: GameState | undefined,
  periodNumber: number,
  secondsRemaining: number,
  homeRoster: readonly Player[],
  awayRoster: readonly Player[],
): void {
  if (!isInRotationWindow(secondsRemaining)) {
    return;
  }
  const windowKey = `${periodNumber}:${Math.floor(secondsRemaining / 60)}`;
  if (sim.windowsFiredThisPeriod.has(windowKey)) {
    return;
  }
  sim.windowsFiredThisPeriod.add(windowKey);
  runSubstitutionCheckpoint(
    sim,
    state,
    "rotation_window",
    periodNumber,
    secondsRemaining,
    homeRoster,
    awayRoster,
  );
}

export function syncFoulOutsFromStats(sim: GameSimState): PlayerId[] {
  const newlyFouledOut: PlayerId[] = [];
  for (const playerId of sim.playerStatsOrder) {
    const row = sim.playerStatsById.get(playerId);
    if (row == null) {
      continue;
    }
    const level = foulTroubleLevel(
      row.fouls,
      // approximate period from elapsed
      Math.min(
        4,
        Math.floor(
          sim.elapsedGameSeconds /
            GAME_SIMULATION_CONFIG.regulationPeriodSeconds,
        ) + 1,
      ) + sim.overtimePeriodCount,
    );
    const prev = sim.peakFoulTroubleByPlayerId.get(playerId) ?? "none";
    const order = ["none", "caution", "trouble", "severe", "fouled_out"] as const;
    if (order.indexOf(level) > order.indexOf(prev)) {
      sim.peakFoulTroubleByPlayerId.set(playerId, level);
    }
    if (isFouledOut(row.fouls) && !sim.fouledOutPlayerIds.has(playerId)) {
      sim.fouledOutPlayerIds.add(playerId);
      newlyFouledOut.push(playerId);
    }
  }
  return newlyFouledOut;
}

export function accumulateOnCourtTime(
  sim: GameSimState,
  elapsedSeconds: number,
): void {
  for (const player of sim.homeOnCourt) {
    sim.secondsOnCourt.set(
      player.id,
      (sim.secondsOnCourt.get(player.id) ?? 0) + elapsedSeconds,
    );
    sim.continuousSecondsOnCourt.set(
      player.id,
      (sim.continuousSecondsOnCourt.get(player.id) ?? 0) + elapsedSeconds,
    );
  }
  for (const player of sim.awayOnCourt) {
    sim.secondsOnCourt.set(
      player.id,
      (sim.secondsOnCourt.get(player.id) ?? 0) + elapsedSeconds,
    );
    sim.continuousSecondsOnCourt.set(
      player.id,
      (sim.continuousSecondsOnCourt.get(player.id) ?? 0) + elapsedSeconds,
    );
  }
  sim.elapsedGameSeconds += elapsedSeconds;
}

export function finalizeRotationExplanations(sim: GameSimState): void {
  const situations = [...sim.situationsSeen];
  for (const entry of [
    ...sim.homeRotationSnapshot,
    ...sim.awayRotationSnapshot,
  ]) {
    const actual =
      (sim.secondsOnCourt.get(entry.playerId) ?? 0) / 60;
    const reasons = buildMinuteExplanations({
      entry,
      actualMinutes: actual,
      fouledOut: sim.fouledOutPlayerIds.has(entry.playerId),
      peakFoulTrouble:
        sim.peakFoulTroubleByPlayerId.get(entry.playerId) ?? "none",
      peakFatigue: sim.peakFatigueByPlayerId.get(entry.playerId) ?? 0,
      situationsSeen: situations,
      wasInjured: false,
    });
    if (reasons.length > 0) {
      sim.rotationExplanations.set(entry.playerId, reasons);
    }
  }
}

export function averageOnCourtFatigue(
  sim: GameSimState,
  players: readonly Player[],
): number {
  if (players.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const player of players) {
    sum += sim.fatigueByPlayerId.get(player.id) ?? 0;
  }
  return sum / players.length;
}

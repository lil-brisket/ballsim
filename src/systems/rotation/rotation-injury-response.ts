/**
 * Redistribute rotation minutes when availability changes (injury / suspension).
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import {
  type RotationEntry,
  type TeamRosterManagement,
  cloneTeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  canPlayerPlay,
  getPlayerAvailability,
} from "@/systems/player-availability";
import { deriveRotationConstraints } from "@/systems/rotation/derive-rotation-constraints";
import { playerCanCoverSlot } from "@/systems/rotation/lineup-validation";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import { getRegulationTeamMinutesTarget } from "@/systems/roster-management";

export type InjuryReplacementRecommendation = {
  position: string;
  injuredPlayerId: PlayerId;
  suggestedPlayerId: PlayerId;
  currentMpg: number;
  suggestedMpg: number;
  faSuggestion?: string;
};

export type RotationInjuryResponseResult = {
  management: TeamRosterManagement;
  recommendations: InjuryReplacementRecommendation[];
  changelog: string[];
};

function playerOverall(player: Player): number {
  return calculatePlayerOverall(player.position, player.attributes);
}

function normalizeToTarget(
  entries: RotationEntry[],
  teamTarget: number,
): RotationEntry[] {
  const active = entries.filter((e) => e.rotationStatus === "active");
  const sum = active.reduce((s, e) => s + e.targetMinutes, 0);
  const delta = teamTarget - sum;
  if (delta === 0 || active.length === 0) {
    return entries;
  }
  // Distribute delta across active players by priority (lower number = higher priority)
  const sorted = [...active].sort(
    (a, b) => a.rotationPriority - b.rotationPriority,
  );
  const adjusted = new Map<string, number>();
  let remaining = delta;
  for (let i = 0; i < sorted.length && remaining !== 0; i++) {
    const entry = sorted[i]!;
    const share =
      i === sorted.length - 1
        ? remaining
        : Math.trunc(remaining / (sorted.length - i));
    adjusted.set(entry.playerId, entry.targetMinutes + share);
    remaining -= share;
  }
  return entries.map((entry) => {
    const nextTarget = adjusted.get(entry.playerId);
    if (nextTarget == null) {
      return entry;
    }
    return deriveRotationConstraints({
      playerId: entry.playerId,
      targetMinutes: Math.max(0, nextTarget),
      role: entry.role,
      preferredPositions: entry.preferredPositions,
      secondaryPositions: entry.secondaryPositions,
      rotationPriority: entry.rotationPriority,
      minutePriorityBias: entry.minutePriorityBias,
      overrideMedicalRecommendation: entry.overrideMedicalRecommendation,
    });
  });
}

/**
 * Zero out unavailable players and redistribute their minutes to positional backups.
 */
export function redistributeRotationForInjuries(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement = state.world.teams[teamId]!
    .rosterManagement,
): RotationInjuryResponseResult {
  const team = state.world.teams[teamId];
  if (team == null) {
    return {
      management,
      recommendations: [],
      changelog: [],
    };
  }

  const changelog: string[] = [];
  const recommendations: InjuryReplacementRecommendation[] = [];
  const teamTarget = getRegulationTeamMinutesTarget();
  let rotation = management.rotation.map((entry) => ({ ...entry }));

  // Cap / zero unavailable or workload-restricted players
  for (let i = 0; i < rotation.length; i++) {
    const entry = rotation[i]!;
    const player = state.world.players[entry.playerId];
    if (player == null) {
      continue;
    }
    const availability = getPlayerAvailability(state, entry.playerId, teamId);
    if (!availability.canPlay) {
      if (entry.targetMinutes > 0) {
        changelog.push(
          `Removed ${player.firstName} ${player.lastName} from rotation (${availability.label})`,
        );
      }
      rotation[i] = deriveRotationConstraints({
        playerId: entry.playerId,
        targetMinutes: 0,
        role: "emergency",
        preferredPositions: entry.preferredPositions,
        secondaryPositions: entry.secondaryPositions,
        canPlay: false,
      });
      continue;
    }

    if (
      availability.maximumWorkloadMpg != null &&
      !entry.overrideMedicalRecommendation &&
      entry.targetMinutes > availability.maximumWorkloadMpg
    ) {
      changelog.push(
        `Capped ${player.firstName} ${player.lastName}: ${entry.targetMinutes} → ${availability.maximumWorkloadMpg} MPG (medical maximum)`,
      );
      rotation[i] = deriveRotationConstraints({
        playerId: entry.playerId,
        targetMinutes: availability.maximumWorkloadMpg,
        role: entry.role,
        preferredPositions: entry.preferredPositions,
        secondaryPositions: entry.secondaryPositions,
        rotationPriority: entry.rotationPriority,
        minutePriorityBias: entry.minutePriorityBias,
        maximumWorkloadMpg: availability.maximumWorkloadMpg,
        recommendedWorkloadMpg: availability.recommendedWorkloadMpg,
      });
    } else if (
      availability.recommendedWorkloadMpg != null &&
      entry.targetMinutes > availability.recommendedWorkloadMpg &&
      !entry.overrideMedicalRecommendation
    ) {
      // Soft: AI/redistribute pulls toward recommended
      const reduced = Math.round(
        (entry.targetMinutes + availability.recommendedWorkloadMpg) / 2,
      );
      if (reduced < entry.targetMinutes) {
        changelog.push(
          `Reduced ${player.firstName} ${player.lastName}: ${entry.targetMinutes} → ${reduced} MPG (medical recommendation)`,
        );
        rotation[i] = deriveRotationConstraints({
          playerId: entry.playerId,
          targetMinutes: reduced,
          role: entry.role,
          preferredPositions: entry.preferredPositions,
          secondaryPositions: entry.secondaryPositions,
          rotationPriority: entry.rotationPriority,
          minutePriorityBias: entry.minutePriorityBias,
          recommendedWorkloadMpg: availability.recommendedWorkloadMpg,
          maximumWorkloadMpg: availability.maximumWorkloadMpg,
        });
      }
    }
  }

  // Closing lineup: drop unavailable players
  const closingLineupIds = management.closingLineupIds.filter((id) =>
    canPlayerPlay(state, id, teamId),
  );
  if (closingLineupIds.length !== management.closingLineupIds.length) {
    changelog.push("Updated closing lineup to exclude unavailable players");
  }

  // Find positional gaps from zeroed starters
  const starterSlots = management.startingLineup;
  for (const slot of starterSlots) {
    const starterEntry = rotation.find((e) => e.playerId === slot.playerId);
    const starterAvail = getPlayerAvailability(state, slot.playerId, teamId);
    if (starterAvail.canPlay && (starterEntry?.targetMinutes ?? 0) > 0) {
      continue;
    }

    const candidates = rotation
      .filter((e) => e.playerId !== slot.playerId && e.targetMinutes >= 0)
      .map((e) => {
        const p = state.world.players[e.playerId];
        if (p == null || !canPlayerPlay(state, e.playerId, teamId)) {
          return null;
        }
        if (!playerCanCoverSlot(p, slot.slot, e)) {
          return null;
        }
        return { entry: e, player: p, overall: playerOverall(p) };
      })
      .filter((c): c is NonNullable<typeof c> => c != null)
      .sort((a, b) => b.overall - a.overall);

    const best = candidates[0];
    if (best == null) {
      changelog.push(
        `No healthy backup for ${slot.slot} — consider free agency`,
      );
      recommendations.push({
        position: slot.slot,
        injuredPlayerId: slot.playerId,
        suggestedPlayerId: slot.playerId,
        currentMpg: 0,
        suggestedMpg: 0,
        faSuggestion: `Consider adding another ${slot.slot} through Free Agency.`,
      });
      continue;
    }

    const suggestedMpg = Math.max(
      best.entry.targetMinutes,
      Math.min(
        28,
        Math.round(
          (starterEntry?.targetMinutes ?? 24) *
            (best.entry.role === "starter" ? 1 : 0.75),
        ),
      ),
    );
    if (suggestedMpg > best.entry.targetMinutes) {
      changelog.push(
        `Increased ${best.player.firstName} ${best.player.lastName}: ${best.entry.targetMinutes} → ${suggestedMpg} MPG — backup ${slot.slot} coverage`,
      );
      recommendations.push({
        position: slot.slot,
        injuredPlayerId: slot.playerId,
        suggestedPlayerId: best.player.id,
        currentMpg: best.entry.targetMinutes,
        suggestedMpg,
      });
      const idx = rotation.findIndex((e) => e.playerId === best.entry.playerId);
      if (idx >= 0) {
        const avail = getPlayerAvailability(state, best.entry.playerId, teamId);
        rotation[idx] = deriveRotationConstraints({
          playerId: best.entry.playerId,
          targetMinutes: suggestedMpg,
          role:
            best.entry.role === "emergency" || best.entry.role === "bench"
              ? "rotation"
              : best.entry.role,
          preferredPositions: best.entry.preferredPositions,
          secondaryPositions: best.entry.secondaryPositions,
          rotationPriority: Math.min(best.entry.rotationPriority, 3) as 1 | 2 | 3 | 4 | 5,
          recommendedWorkloadMpg: avail.recommendedWorkloadMpg,
          maximumWorkloadMpg: avail.maximumWorkloadMpg,
        });
      }
    }
  }

  rotation = normalizeToTarget(rotation, teamTarget);

  const next = cloneTeamRosterManagement({
    ...management,
    rotation,
    closingLineupIds,
  });

  return { management: next, recommendations, changelog };
}

/**
 * Live in-game redistribution of remaining target minutes after a mid-game injury.
 * Adjusts planned remaining minutes proportional to time left.
 */
export function redistributeLiveMinutesAfterInjury(input: {
  rotationByPlayerId: Map<string, RotationEntry>;
  injuredPlayerId: PlayerId;
  actualMinutesByPlayer: Map<string, number>;
  remainingGameMinutes: number;
  playersById: ReadonlyMap<string, Player>;
  position?: PlayerPosition;
}): Map<string, RotationEntry> {
  const next = new Map(input.rotationByPlayerId);
  const injured = next.get(input.injuredPlayerId);
  if (injured == null) {
    return next;
  }

  const actual = input.actualMinutesByPlayer.get(input.injuredPlayerId) ?? 0;
  const remainingPlanned = Math.max(0, injured.targetMinutes - actual);
  next.set(input.injuredPlayerId, {
    ...injured,
    targetMinutes: actual,
    minimumMinutes: 0,
    normalMaximumMinutes: actual,
    absoluteMaximumMinutes: actual,
    rotationStatus: "inactive",
  });

  if (remainingPlanned <= 0 || input.remainingGameMinutes <= 0) {
    return next;
  }

  const candidates = [...next.entries()]
    .filter(([id, entry]) => {
      if (id === input.injuredPlayerId) return false;
      if (entry.rotationStatus === "inactive") return false;
      const player = input.playersById.get(id);
      if (player == null) return false;
      if (input.position && !playerCanCoverSlot(player, input.position, entry)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a[1].rotationPriority - b[1].rotationPriority);

  if (candidates.length === 0) {
    return next;
  }

  let remaining = remainingPlanned;
  for (let i = 0; i < candidates.length && remaining > 0; i++) {
    const [id, entry] = candidates[i]!;
    const share =
      i === candidates.length - 1
        ? remaining
        : Math.max(
            ROTATION_CONFIG.meaningfulRotationMinutes,
            Math.floor(remaining / (candidates.length - i)),
          );
    const bump = Math.min(share, remaining);
    remaining -= bump;
    next.set(id, {
      ...entry,
      targetMinutes: entry.targetMinutes + bump,
      normalMaximumMinutes: Math.max(
        entry.normalMaximumMinutes,
        entry.targetMinutes + bump,
      ),
      absoluteMaximumMinutes: Math.max(
        entry.absoluteMaximumMinutes,
        entry.targetMinutes + bump + 4,
      ),
      rotationStatus: "active",
    });
  }

  return next;
}

/**
 * Rotation health analyzer — minutes balance, depth, position coverage, workload.
 */

import type { Player, PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type {
  RotationEntry,
  TeamRosterManagement,
} from "@/domain/entities/team-roster-management";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  getPlayerAvailability,
  listPlayableRosterPlayerIds,
} from "@/systems/player-availability";
import { allPositionsFor } from "@/systems/rotation/lineup-validation";
import { ROTATION_CONFIG } from "@/systems/rotation/rotation-config";
import type { InjuryReplacementRecommendation } from "@/systems/rotation/rotation-injury-response";
import { getRegulationTeamMinutesTarget } from "@/systems/roster-management";

export type RotationHealthLevel = "healthy" | "warning" | "invalid";

export type RotationHealthReport = {
  level: RotationHealthLevel;
  totalMinutes: number;
  targetMinutes: number;
  balanceLabel: "Balanced" | "Over" | "Under";
  rosterSize: number;
  availableCount: number;
  rotationTargetCount: number;
  meaningfulPlayerCount: number;
  availabilitySummary: string;
  summaryLine: string;
  issues: Array<{
    code: string;
    message: string;
    severity: "warning" | "error";
  }>;
  positionCoverage: Array<{
    position: string;
    level: "ok" | "limited" | "critical";
    message: string;
  }>;
  workloadWarnings: Array<{
    playerId: PlayerId;
    playerName: string;
    targetMpg: number;
    recommendedMpg: number | null;
    maximumMpg: number | null;
    reason: string;
    overridden: boolean;
  }>;
  replacementRecommendations: InjuryReplacementRecommendation[];
};

function desiredRotationSize(playableCount: number): number {
  return Math.min(
    ROTATION_CONFIG.targetRotationPlayerCount,
    Math.max(playableCount, 0),
  );
}

export function analyzeRotationHealth(
  state: GameState,
  teamId: TeamId,
  management: TeamRosterManagement = state.world.teams[teamId]!
    .rosterManagement,
  replacementRecommendations: InjuryReplacementRecommendation[] = [],
): RotationHealthReport {
  const team = state.world.teams[teamId];
  const targetMinutes = getRegulationTeamMinutesTarget();
  const issues: RotationHealthReport["issues"] = [];
  const workloadWarnings: RotationHealthReport["workloadWarnings"] = [];
  const positionCoverage: RotationHealthReport["positionCoverage"] = [];

  if (team == null) {
    return {
      level: "invalid",
      totalMinutes: 0,
      targetMinutes,
      balanceLabel: "Under",
      rosterSize: 0,
      availableCount: 0,
      rotationTargetCount: 0,
      meaningfulPlayerCount: 0,
      availabilitySummary: "No team",
      summaryLine: `0 / ${targetMinutes} MIN · 0 Players · Under`,
      issues: [{ code: "no_team", message: "Team not found.", severity: "error" }],
      positionCoverage: [],
      workloadWarnings: [],
      replacementRecommendations: [],
    };
  }

  const rosterSize = team.roster.length;
  const playableIds = listPlayableRosterPlayerIds(state, teamId);
  const availableCount = playableIds.length;
  const rotationTargetCount = desiredRotationSize(availableCount);

  let totalMinutes = 0;
  let meaningfulPlayerCount = 0;
  let limitedCount = 0;
  let outCount = 0;
  let questionableCount = 0;

  const coverCounts: Record<PlayerPosition, number> = {
    PG: 0,
    SG: 0,
    SF: 0,
    PF: 0,
    C: 0,
  };

  for (const entry of management.rotation) {
    const player = state.world.players[entry.playerId];
    if (player == null) continue;
    const avail = getPlayerAvailability(state, entry.playerId, teamId);

    if (avail.status === "out" || avail.status === "suspended") {
      outCount += 1;
    } else if (avail.status === "limited") {
      limitedCount += 1;
    } else if (avail.status === "questionable") {
      questionableCount += 1;
    }

    if (entry.rotationStatus === "active" || entry.targetMinutes > 0) {
      totalMinutes += entry.targetMinutes;
    }
    if (entry.targetMinutes >= ROTATION_CONFIG.meaningfulRotationMinutes) {
      meaningfulPlayerCount += 1;
      for (const pos of allPositionsFor(entry, player)) {
        coverCounts[pos] += 1;
      }
    }

    if (entry.targetMinutes > 0 && !avail.canPlay) {
      issues.push({
        code: "unavailable_minutes",
        message: `${player.firstName} ${player.lastName} is ${avail.label} but has ${entry.targetMinutes} target MPG.`,
        severity: "error",
      });
    }

    if (
      avail.recommendedWorkloadMpg != null &&
      entry.targetMinutes > avail.recommendedWorkloadMpg
    ) {
      const overridden = entry.overrideMedicalRecommendation === true;
      workloadWarnings.push({
        playerId: entry.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        targetMpg: entry.targetMinutes,
        recommendedMpg: avail.recommendedWorkloadMpg,
        maximumMpg: avail.maximumWorkloadMpg,
        reason:
          avail.limitReason ??
          `Medical recommendation is ${avail.recommendedWorkloadMpg} MPG.`,
        overridden,
      });
      if (!overridden) {
        issues.push({
          code: "workload_exceeded",
          message: `⚠️ Workload limited — ${player.firstName} ${player.lastName}: target ${entry.targetMinutes} exceeds recommended ${avail.recommendedWorkloadMpg} MPG.`,
          severity:
            avail.maximumWorkloadMpg != null &&
            entry.targetMinutes > avail.maximumWorkloadMpg
              ? "error"
              : "warning",
        });
      } else {
        issues.push({
          code: "workload_overridden",
          message: `⚠️ Medical recommendation overridden — ${player.firstName} ${player.lastName}: Target ${entry.targetMinutes} MPG · Recommended ${avail.recommendedWorkloadMpg} MPG.`,
          severity: "warning",
        });
      }
    }
  }

  const delta = totalMinutes - targetMinutes;
  const balanceLabel: RotationHealthReport["balanceLabel"] =
    delta === 0 ? "Balanced" : delta > 0 ? "Over" : "Under";

  if (delta !== 0) {
    issues.push({
      code: delta > 0 ? "too_many" : "not_enough",
      message:
        delta > 0
          ? `Too many minutes assigned (${totalMinutes} / ${targetMinutes}).`
          : `Not enough minutes assigned (${totalMinutes} / ${targetMinutes}).`,
      severity: "error",
    });
  }

  if (
    availableCount >= ROTATION_CONFIG.targetRotationPlayerCount &&
    meaningfulPlayerCount < rotationTargetCount - 1
  ) {
    issues.push({
      code: "thin_rotation",
      message: `Only ${meaningfulPlayerCount} meaningful rotation players — target is ~${rotationTargetCount}.`,
      severity: "warning",
    });
  }

  if (availableCount < 5) {
    issues.push({
      code: "not_enough_available",
      message: `Only ${availableCount} playable players — need at least 5.`,
      severity: "error",
    });
  }

  for (const position of PLAYER_POSITIONS) {
    const count = coverCounts[position];
    if (count === 0) {
      positionCoverage.push({
        position,
        level: "critical",
        message: `No healthy ${position} coverage in meaningful rotation`,
      });
      issues.push({
        code: `pos_${position}`,
        message: `🔴 No healthy backup ${position}`,
        severity: "error",
      });
    } else if (count === 1) {
      positionCoverage.push({
        position,
        level: "limited",
        message: `Backup ${position} coverage limited`,
      });
      issues.push({
        code: `pos_${position}_thin`,
        message: `🟡 Backup ${position} coverage limited`,
        severity: "warning",
      });
    } else {
      positionCoverage.push({
        position,
        level: "ok",
        message: `${position} depth adequate`,
      });
    }
  }

  for (const rec of replacementRecommendations) {
    if (rec.faSuggestion) {
      issues.push({
        code: "fa_suggestion",
        message: `🔴 Rotation Depth Problem — ${rec.faSuggestion}`,
        severity: "error",
      });
    } else {
      const player = state.world.players[rec.suggestedPlayerId];
      const name = player
        ? `${player.firstName} ${player.lastName}`
        : rec.suggestedPlayerId;
      issues.push({
        code: "replacement",
        message: `Recommended: increase ${name} from ${rec.currentMpg} → ${rec.suggestedMpg} MPG (${rec.position})`,
        severity: "warning",
      });
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  const level: RotationHealthLevel = hasError
    ? "invalid"
    : hasWarning
      ? "warning"
      : "healthy";

  let availabilitySummary: string;
  if (outCount === 0 && limitedCount === 0 && questionableCount === 0) {
    availabilitySummary = `🟢 ${availableCount} available · ${meaningfulPlayerCount}-player rotation`;
  } else {
    const parts: string[] = [];
    if (limitedCount > 0) {
      parts.push(
        `${limitedCount} player${limitedCount === 1 ? "" : "s"} limited`,
      );
    }
    if (questionableCount > 0) {
      parts.push(
        `${questionableCount} questionable`,
      );
    }
    if (outCount > 0) {
      parts.push(`${outCount} out`);
    }
    availabilitySummary = `🟡 ${parts.join(" · ")}`;
  }

  const summaryLine = `${totalMinutes} / ${targetMinutes} MIN · ${meaningfulPlayerCount} Players · ${balanceLabel}`;

  return {
    level,
    totalMinutes,
    targetMinutes,
    balanceLabel,
    rosterSize,
    availableCount,
    rotationTargetCount,
    meaningfulPlayerCount,
    availabilitySummary,
    summaryLine,
    issues,
    positionCoverage,
    workloadWarnings,
    replacementRecommendations,
  };
}

export function desiredRotationSizeForTeam(
  state: GameState,
  teamId: TeamId,
): number {
  return desiredRotationSize(listPlayableRosterPlayerIds(state, teamId).length);
}

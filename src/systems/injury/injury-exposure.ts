/**
 * Injury exposure events — risk is only evaluated when an exposure exists.
 */

import type { ExposureSource } from "@/domain/entities/injury";
import type { PlayerId, TeamId } from "@/domain/ids";

export type InjuryExposureKind =
  | "game_acute"
  | "game_overuse"
  | "practice"
  | "rehab"
  | "offseason_training"
  | "off_court";

export type InjuryExposureEvent = {
  playerId: PlayerId;
  teamId: TeamId | null;
  source: ExposureSource;
  /** YYYY-MM-DD */
  date: string;
  /** Minutes played in this game exposure (0 if N/A). */
  minutesPlayed?: number;
  /** On-court fatigue 0–1. */
  fatigue?: number;
  /** Recent average MPG. */
  recentWorkloadMpg?: number;
  /** True when this game is a back-to-back. */
  isBackToBack?: boolean;
  /** Practice intensity 0–1. */
  practiceIntensity?: number;
  /** Player already suffered an acute injury this game — skip overuse. */
  alreadyInjuredThisGame?: boolean;
};

export function createGameAcuteExposure(input: {
  playerId: PlayerId;
  teamId: TeamId | null;
  date: string;
  minutesPlayed: number;
  fatigue: number;
  recentWorkloadMpg?: number;
  isBackToBack?: boolean;
}): InjuryExposureEvent {
  return {
    playerId: input.playerId,
    teamId: input.teamId,
    source: "game_acute",
    date: input.date,
    minutesPlayed: input.minutesPlayed,
    fatigue: input.fatigue,
    recentWorkloadMpg: input.recentWorkloadMpg,
    isBackToBack: input.isBackToBack,
  };
}

export function createGameOveruseExposure(input: {
  playerId: PlayerId;
  teamId: TeamId | null;
  date: string;
  minutesPlayed: number;
  fatigue: number;
  recentWorkloadMpg?: number;
  isBackToBack?: boolean;
  alreadyInjuredThisGame?: boolean;
}): InjuryExposureEvent {
  return {
    playerId: input.playerId,
    teamId: input.teamId,
    source: "game_overuse",
    date: input.date,
    minutesPlayed: input.minutesPlayed,
    fatigue: input.fatigue,
    recentWorkloadMpg: input.recentWorkloadMpg,
    isBackToBack: input.isBackToBack,
    alreadyInjuredThisGame: input.alreadyInjuredThisGame,
  };
}

export function createPracticeExposure(input: {
  playerId: PlayerId;
  teamId: TeamId | null;
  date: string;
  practiceIntensity: number;
}): InjuryExposureEvent {
  return {
    playerId: input.playerId,
    teamId: input.teamId,
    source: "practice",
    date: input.date,
    practiceIntensity: input.practiceIntensity,
  };
}

export function createOffseasonTrainingExposure(input: {
  playerId: PlayerId;
  teamId: TeamId | null;
  date: string;
}): InjuryExposureEvent {
  return {
    playerId: input.playerId,
    teamId: input.teamId,
    source: "offseason_training",
    date: input.date,
    practiceIntensity: 0.5,
  };
}

export function createOffCourtExposure(input: {
  playerId: PlayerId;
  teamId: TeamId | null;
  date: string;
}): InjuryExposureEvent {
  return {
    playerId: input.playerId,
    teamId: input.teamId,
    source: "off_court",
    date: input.date,
  };
}

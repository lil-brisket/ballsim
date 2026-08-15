import type { DomainEvent } from "@/domain/events";
import type { SeasonPhase } from "@/domain/entities/season";
import type { GameState } from "@/state/game-state";

/**
 * Result of advancing the Owner Mode simulation.
 * Extends the SystemResult contract with metadata for application/UI callers.
 */
export type AdvanceSimulationResult = {
  state: GameState;
  events: DomainEvent[];
  previousDate: string;
  currentDate: string;
  daysAdvanced: number;
  phaseBefore: SeasonPhase;
  phaseAfter: SeasonPhase;
  phaseChanged: boolean;
  scheduledEventsProcessed: number;
  gamesSimulated: number;
  weeklyPipelineRan: boolean;
  monthlyPipelineRan: boolean;
};

export type AdvanceSimulationOptions = {
  /** Number of calendar days to advance. Defaults to 1. Also acts as max when stopOnPhaseChange is set. */
  days?: number;
  /**
   * Stop after the first day that changes Owner lifecycle identity
   * `{ season.phase, season.offseasonStage, season.year }`.
   * Does not treat draft-clock as a lifecycle identity change.
   */
  stopOnPhaseChange?: boolean;
};

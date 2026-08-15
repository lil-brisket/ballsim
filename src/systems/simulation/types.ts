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
};

export type AdvanceSimulationOptions = {
  /** Number of calendar days to advance. Defaults to 1. */
  days?: number;
};

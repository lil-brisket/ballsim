import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { getActivePhaseId } from "@/systems/phase-engine";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { resolvePendingOwnerDecision } from "@/systems/owner-decisions";

/**
 * Large date jumps must process day-by-day phase sync without calling
 * advanceLeaguePhase manually — calendar-driven progression only.
 */
describe("multi-year calendar-driven phase sync", () => {
  it("advances many days through the regular season without manual phase advance", () => {
    resetDomainEventSequenceForTests();
    const state = createInitialGameState({
      saveId: "multi_cal",
      rngSeed: 21,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    let next = bootstrapWorld(state, rng).state;
    next = beginRegularSeasonFromPreseason(next).state;

    const startDate = next.world.calendar.currentDate;
    const startPhase = getActivePhaseId(next);

    // CPU trade offers pause the sim; decline them like an owner would.
    let daysAdvanced = 0;
    while (daysAdvanced < 45) {
      const result = advanceSimulation(next, rng, { days: 45 - daysAdvanced });
      daysAdvanced += result.daysAdvanced;
      next = result.state;
      if (result.stopReason === undefined) break;
      expect(result.stopReason).toBe("pending_owner_decision");
      for (const decision of [...next.user.pendingOwnerDecisions]) {
        next = resolvePendingOwnerDecision(next, {
          decisionId: decision.id,
          status: "declined",
          decisionSource: "owner",
        }).state;
      }
    }

    expect(daysAdvanced).toBe(45);
    expect(next.world.calendar.currentDate > startDate).toBe(true);
    // Phase may stay regular or move forward via syncPhaseForward — never rollback.
    expect(next.competition.season.phase).not.toBe("preseason");
    expect(getActivePhaseId(next)).toBeTruthy();
    expect(startPhase).toBeTruthy();
  }, 60_000);
});

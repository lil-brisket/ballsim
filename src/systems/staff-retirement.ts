import { appendCareerEntry } from "@/domain/entities/staff-development";
import { createStaff } from "@/domain/entities/staff";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { fireStaff } from "@/systems/staff";

/**
 * Probabilistic retirement. Factors: age, overall, career stage.
 * Seeded RNG for reproducibility. Elite old staff may continue.
 */
export function processStaffRetirement(
  state: GameState,
  rng: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const year = current.competition.season.year;
  const staffIds = Object.keys(current.world.staff).sort();

  for (const staffId of staffIds) {
    const staff = current.world.staff[staffId]!;
    const chance = retirementProbability(staff.age, staff.overall);
    if (chance <= 0 || !rng.chance(chance)) {
      continue;
    }

    // Remove from team if employed
    if (staff.teamId !== null) {
      try {
        const fired = fireStaff(current, staff.teamId, staff.id);
        current = fired.state;
        events.push(...fired.events);
      } catch {
        // already unemployed
      }
    }

    const after = current.world.staff[staffId];
    if (!after) continue;

    // Mark retired by removing from staff pool (delete) after career entry
    const withHistory = createStaff({
      ...after,
      teamId: null,
      careerHistory: appendCareerEntry(after.careerHistory, {
        seasonYear: year,
        teamId: staff.teamId,
        role: after.role,
        overall: after.overall,
        kind: "retired",
      }),
    });

    events.push(
      createDomainEvent({
        type: "StaffRetired",
        occurredOn: current.world.calendar.currentDate,
        payload: {
          staffId,
          age: after.age,
          overall: after.overall,
          role: after.role,
        },
      }),
    );

    const { [staffId]: _removed, ...rest } = current.world.staff;
    // Keep retired record for history visibility but unemployed
    current = {
      ...current,
      world: {
        ...current.world,
        staff: {
          ...rest,
          [staffId]: withHistory,
        },
      },
    };
  }

  return systemResult(appendSeasonEventLog(current, events), events);
}

function retirementProbability(age: number, overall: number): number {
  if (age < 55) return 0;
  if (age < 60) {
    return overall >= 80 ? 0.02 : 0.08;
  }
  if (age < 65) {
    return overall >= 85 ? 0.05 : overall >= 70 ? 0.15 : 0.3;
  }
  if (age < 70) {
    return overall >= 90 ? 0.1 : overall >= 75 ? 0.35 : 0.55;
  }
  return overall >= 90 ? 0.25 : 0.7;
}

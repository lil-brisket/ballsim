import {
  computeStaffOverall,
  createStaff,
  type Staff,
} from "@/domain/entities/staff";
import { STAFF_ATTRIBUTE_KEYS } from "@/domain/entities/staff-roles";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";

function clampRating(value: number): number {
  return Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(value)));
}

/**
 * Offseason staff development tick.
 * Primary drivers: age, potential, current ability, experience, time in role.
 * Performance is a small secondary modifier only (avoids lose→decline feedback loops).
 */
export function processSeasonStaffDevelopment(
  state: GameState,
  rng: Rng,
): SystemResult {
  const events: DomainEvent[] = [];
  const nextStaff: Record<string, Staff> = { ...state.world.staff };
  const staffIds = Object.keys(nextStaff).sort();
  const year = state.competition.season.year;

  for (const staffId of staffIds) {
    const staff = nextStaff[staffId]!;
    const aged = createStaff({
      ...staff,
      age: Math.min(85, staff.age + 1),
      experience: staff.experience + 1,
    });

    const performanceMod = smallPerformanceModifier(state, aged, rng);
    const delta = computeAttributeDelta(aged, rng, performanceMod);

    const keys = STAFF_ATTRIBUTE_KEYS[aged.role] as readonly string[];
    const attrs = { ...(aged.attributes as Record<string, number>) };
    for (const key of keys) {
      attrs[key] = clampRating(attrs[key]! + delta);
    }
    const overall = computeStaffOverall(aged.role, attrs as Staff["attributes"]);
    const overallDelta = overall - aged.overall;

    let trend: Staff["development"]["trend"] = "stable";
    if (overallDelta >= 1) trend = "improving";
    else if (overallDelta <= -1) trend = "declining";

    const seasonsAtOverall =
      overallDelta === 0 ? aged.development.seasonsAtOverall + 1 : 0;

    nextStaff[staffId] = createStaff({
      ...aged,
      overall,
      attributes: attrs as Staff["attributes"],
      // Potential is a soft ceiling — overall can approach but rarely exceed
      potential: Math.max(aged.potential, overall),
      development: {
        trend,
        lastOverallDelta: overallDelta,
        seasonsAtOverall,
        timeInRole: aged.development.timeInRole + 1,
      },
    });

    if (overallDelta >= 1) {
      events.push(
        createDomainEvent({
          type: "StaffDeveloped",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            staffId,
            year,
            overallBefore: aged.overall,
            overallAfter: overall,
          },
        }),
      );
    } else if (overallDelta <= -1) {
      events.push(
        createDomainEvent({
          type: "StaffDeclined",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            staffId,
            year,
            overallBefore: aged.overall,
            overallAfter: overall,
          },
        }),
      );
    }
  }

  return systemResult(
    appendSeasonEventLog(
      {
        ...state,
        world: {
          ...state.world,
          staff: nextStaff,
        },
      },
      events,
    ),
    events,
  );
}

function computeAttributeDelta(
  staff: Staff,
  rng: Rng,
  performanceMod: number,
): number {
  const roomToGrow = Math.max(0, staff.potential - staff.overall);
  const ageFactor =
    staff.age <= 35 ? 1.15 : staff.age <= 50 ? 1.0 : staff.age <= 60 ? 0.7 : 0.35;
  const experienceFactor = 1 + Math.min(0.15, staff.experience * 0.005);
  const timeInRoleFactor = 1 + Math.min(0.1, staff.development.timeInRole * 0.01);

  let base = 0;
  if (roomToGrow >= 8 && staff.age <= 45) {
    base = rng.chance(0.55) ? rng.nextInt(0, 2) : 0;
  } else if (roomToGrow >= 3) {
    base = rng.chance(0.35) ? 1 : 0;
  } else if (staff.age >= 58) {
    base = rng.chance(0.4) ? -1 : rng.chance(0.15) ? -2 : 0;
  } else if (staff.age >= 50 && roomToGrow <= 2) {
    base = rng.chance(0.25) ? -1 : 0;
  }

  const scaled = Math.round(
    base * ageFactor * experienceFactor * timeInRoleFactor * performanceMod,
  );
  return Math.max(-2, Math.min(2, scaled));
}

/**
 * Performance modifier clamped to ±10% around 1.0.
 * Uses team win% when employed; unemployed staff get neutral.
 */
function smallPerformanceModifier(
  state: GameState,
  staff: Staff,
  rng: Rng,
): number {
  if (staff.teamId === null) {
    return 1;
  }
  const standing = state.competition.standings.byTeamId[staff.teamId];
  if (!standing) {
    return 1;
  }
  const games = standing.wins + standing.losses;
  if (games < 10) {
    return 1;
  }
  const winPct = standing.wins / games;
  // Map win% 0.3–0.7 → modifier 0.9–1.1
  const raw = 0.9 + (Math.max(0.3, Math.min(0.7, winPct)) - 0.3) * 0.5;
  // Tiny noise so it's not fully deterministic from standings alone
  const noise = rng.nextInt(-2, 2) / 100;
  return Math.max(0.9, Math.min(1.1, raw + noise));
}

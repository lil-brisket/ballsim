import {
  FACILITY_CATEGORIES,
  FACILITY_LEVEL_MAX,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  arenaCapacityForLevel,
  FACILITY_UPGRADE_WEEKS,
  facilityUpgradeCost,
  facilityWeeklyOpex,
} from "@/systems/facilities-config";
import { applyCashAndBooksImpact } from "@/systems/team-finances";
import { assertCapitalSpendingAllowed } from "@/systems/financial-spending";

export function arenaCapacity(state: GameState, teamId: TeamId): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`arenaCapacity: franchiseOps missing for "${teamId}".`);
  }
  return arenaCapacityForLevel(ops.facilities.arena.level);
}

/**
 * Development multiplier from practice, training, and medical facility levels.
 * Range roughly 1.0–1.35 at max levels.
 */
export function facilityDevelopmentMultiplier(
  state: GameState,
  teamId: TeamId,
): number {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    return 1;
  }
  const practice = ops.facilities.practice.level;
  const training = ops.facilities.training.level;
  const medical = ops.facilities.medical.level;
  const raw = (practice + training + medical) / (3 * FACILITY_LEVEL_MAX);
  return 1 + raw * 0.35;
}

export function startFacilityUpgrade(
  state: GameState,
  teamId: TeamId,
  category: FacilityCategory,
): SystemResult {
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`startFacilityUpgrade: franchiseOps missing for "${teamId}".`);
  }
  const facility = ops.facilities[category];
  if (facility.upgradeWeeksRemaining > 0) {
    throw new Error(
      `startFacilityUpgrade: ${category} upgrade already in progress.`,
    );
  }
  if (facility.level >= FACILITY_LEVEL_MAX) {
    throw new Error(
      `startFacilityUpgrade: ${category} is already at max level.`,
    );
  }

  const cost = facilityUpgradeCost(category, facility.level);
  assertCapitalSpendingAllowed(state, teamId, "Facility upgrades");
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  const impact = applyCashAndBooksImpact(current, teamId, -cost, year, {
    expenseCategory: "capital",
  });
  current = impact.state;
  events.push(...impact.events);

  const nextFacilities = {
    ...ops.facilities,
    [category]: {
      level: facility.level,
      upgradeWeeksRemaining: FACILITY_UPGRADE_WEEKS,
    },
  };

  events.push(
    createDomainEvent({
      type: "FacilityUpgradeStarted",
      occurredOn: current.world.calendar.currentDate,
      payload: { teamId, category, cost, weeks: FACILITY_UPGRADE_WEEKS },
    }),
  );

  return systemResult(
    {
      ...current,
      business: {
        ...current.business,
        franchiseOps: {
          ...current.business.franchiseOps,
          [teamId]: {
            ...ops,
            facilities: nextFacilities,
          },
        },
      },
    },
    events,
  );
}

export function processWeeklyFacilityOpex(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let current = state;

  for (const teamId of Object.keys(current.world.teams).sort()) {
    const ops = current.business.franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    let weeklyTotal = 0;
    for (const category of FACILITY_CATEGORIES) {
      weeklyTotal += facilityWeeklyOpex(
        category,
        ops.facilities[category].level,
      );
    }
    if (weeklyTotal <= 0) {
      continue;
    }
    const impact = applyCashAndBooksImpact(
      current,
      teamId as TeamId,
      -weeklyTotal,
      year,
      { expenseCategory: "facilities" },
    );
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
}

export function processWeeklyFacilityUpgrades(state: GameState): SystemResult {
  const events: DomainEvent[] = [];
  let current = state;
  const date = current.world.calendar.currentDate;
  let franchiseOps = current.business.franchiseOps;

  for (const teamId of Object.keys(current.world.teams).sort()) {
    const ops = franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    let changed = false;
    const nextFacilities = { ...ops.facilities };

    for (const category of FACILITY_CATEGORIES) {
      const facility = ops.facilities[category];
      if (facility.upgradeWeeksRemaining <= 0) {
        continue;
      }
      const remaining = facility.upgradeWeeksRemaining - 1;
      if (remaining <= 0) {
        const newLevel = Math.min(facility.level + 1, FACILITY_LEVEL_MAX);
        nextFacilities[category] = { level: newLevel, upgradeWeeksRemaining: 0 };
        changed = true;
        events.push(
          createDomainEvent({
            type: "FacilityUpgradeCompleted",
            occurredOn: date,
            payload: { teamId, category, level: newLevel },
          }),
        );
      } else {
        nextFacilities[category] = {
          level: facility.level,
          upgradeWeeksRemaining: remaining,
        };
        changed = true;
      }
    }

    if (changed) {
      franchiseOps = {
        ...franchiseOps,
        [teamId]: { ...ops, facilities: nextFacilities },
      };
    }
  }

  if (franchiseOps !== current.business.franchiseOps) {
    current = {
      ...current,
      business: { ...current.business, franchiseOps },
    };
  }

  return systemResult(current, events);
}

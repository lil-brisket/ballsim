import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  MARKETING_AWARENESS_DECAY,
  MARKETING_AWARENESS_SCALE,
  MARKETING_MAX_WEEKLY_AWARENESS_GAIN,
  MARKETING_WEEKS_PER_YEAR,
} from "@/systems/marketing-config";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

function clampAwareness(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function setMarketingBudget(
  state: GameState,
  teamId: TeamId,
  annualBudget: number,
): SystemResult {
  if (!Number.isInteger(annualBudget) || annualBudget < 0) {
    throw new Error("setMarketingBudget: budget must be a non-negative integer.");
  }
  const ops = state.business.franchiseOps[teamId];
  if (!ops) {
    throw new Error(`setMarketingBudget: franchiseOps missing for "${teamId}".`);
  }
  return systemResult({
    ...state,
    business: {
      ...state.business,
      franchiseOps: {
        ...state.business.franchiseOps,
        [teamId]: {
          ...ops,
          marketing: { ...ops.marketing, budget: annualBudget },
        },
      },
    },
  });
}

export function processWeeklyMarketing(state: GameState): SystemResult {
  const year = state.competition.season.year;
  let current = state;
  const events: SystemResult["events"] = [];

  for (const teamId of Object.keys(current.world.teams).sort()) {
    const ops = current.business.franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    const weeklySpend = Math.floor(
      ops.marketing.budget / MARKETING_WEEKS_PER_YEAR,
    );
    if (weeklySpend > 0) {
      const impact = applyCashAndBooksImpact(
        current,
        teamId as TeamId,
        -weeklySpend,
        year,
        { expenseCategory: "marketing" },
      );
      current = impact.state;
      events.push(...impact.events);
    }

    const diminishingGain = Math.min(
      MARKETING_MAX_WEEKLY_AWARENESS_GAIN,
      Math.sqrt(Math.max(0, weeklySpend)) * MARKETING_AWARENESS_SCALE * 1_000,
    );
    const decayTowardNeutral =
      (50 - ops.marketing.awareness) * MARKETING_AWARENESS_DECAY;
    const awareness = clampAwareness(
      Math.round(ops.marketing.awareness + diminishingGain + decayTowardNeutral),
    );

    if (awareness !== ops.marketing.awareness) {
      current = {
        ...current,
        business: {
          ...current.business,
          franchiseOps: {
            ...current.business.franchiseOps,
            [teamId]: {
              ...ops,
              marketing: { ...ops.marketing, awareness },
            },
          },
        },
      };
    }
  }

  return systemResult(current, events);
}

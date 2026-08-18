import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { asSponsorshipId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { FacilityCategory } from "@/domain/entities/franchise-ops";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/systems/ai-team-decisions";
import { startFacilityUpgrade } from "@/systems/facilities";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import {
  resolveFranchisePreferences,
  type EffectivePreferences,
  type PreferenceDebugSnapshot,
} from "@/systems/franchise-ai-preferences";
import {
  AI_FACILITY_CONSERVATIVE_CASH,
  AI_FACILITY_MIN_CASH,
  AI_MARKETING_BUDGET_STEP_MAX,
  AI_TICKET_PRICE_STEP_MAX,
  clampPreference,
} from "@/systems/franchise-ai-preferences-config";
import { setMarketingBudget } from "@/systems/marketing";
import { signSponsorship } from "@/systems/sponsorships";
import { AI_SPONSOR_MEDIA_VALUE_PER_POINT } from "@/systems/sponsorships-config";
import { setPremiumTicketPrice, setTicketPrice } from "@/systems/ticket-pricing";
import {
  PREMIUM_TICKET_PRICE_MAX,
  PREMIUM_TICKET_PRICE_MIN,
} from "@/systems/demand/demand-config";

export type AiFranchiseDecisionTrace = {
  teamId: TeamId;
  debug: PreferenceDebugSnapshot;
  ticketAction: "changed" | "noop";
  marketingAction: "changed" | "noop";
  facilityAction: FacilityCategory | "noop";
  sponsorAction: "signed" | "noop";
};

/**
 * Preference-driven franchise ops decisions using the SAME commands as the owner.
 * Never mutates the user-controlled team. Idempotent per week via consequence keys.
 * Inaction is a valid outcome. Does not re-inject marketSize into choosers.
 */
export function runAiFranchiseDecisions(
  state: GameState,
  _rng: Rng,
): SystemResult {
  const weekId = state.world.calendar.lastSimulatedWeekId ?? "pre";
  const events: DomainEvent[] = [];
  let current = state;

  const teamIds = Object.keys(current.world.teams).sort() as TeamId[];
  for (const teamId of teamIds) {
    if (isUserControlledTeam(current, teamId)) {
      continue;
    }
    const key = `ai_franchise:${teamId}:${weekId}`;
    if (hasAppliedGameplayConsequence(current, key)) {
      continue;
    }

    const ops = current.business.franchiseOps[teamId];
    if (!ops) {
      continue;
    }
    const resolved = resolveFranchisePreferences(current, teamId);
    if (!resolved) {
      continue;
    }
    const prefs = resolved.preferences;
    const cash = current.business.finances[teamId]?.cash ?? 0;

    const ticketTarget = ticketPriceFromPreferences(
      ops.ticketPrice,
      ops.fanSentiment,
      prefs,
    );
    if (ticketTarget !== ops.ticketPrice) {
      const priceResult = setTicketPrice(current, teamId, ticketTarget);
      current = priceResult.state;
      events.push(...priceResult.events);
    }

    const premiumTarget = premiumTicketPriceFromPreferences(
      ops.premiumTicketPrice,
      prefs,
    );
    if (premiumTarget !== ops.premiumTicketPrice) {
      const premiumResult = setPremiumTicketPrice(
        current,
        teamId,
        premiumTarget,
      );
      current = premiumResult.state;
      events.push(...premiumResult.events);
    }

    const marketingTarget = marketingBudgetFromPreferences(
      ops.marketing.budget,
      cash,
      prefs,
    );
    if (marketingTarget !== ops.marketing.budget) {
      const marketingResult = setMarketingBudget(
        current,
        teamId,
        marketingTarget,
      );
      current = marketingResult.state;
      events.push(...marketingResult.events);
    }

    const upgradeCategory = facilityUpgradeFromPreferences(
      current.business.franchiseOps[teamId]!,
      cash,
      prefs,
    );
    if (upgradeCategory) {
      try {
        const upgrade = startFacilityUpgrade(current, teamId, upgradeCategory);
        current = upgrade.state;
        events.push(...upgrade.events);
      } catch {
        // Insufficient cash or maxed — skip (inaction).
      }
    }

    if (shouldSignSponsorFromPreferences(current, teamId, cash, prefs)) {
      try {
        const year = current.competition.season.year;
        const latestOps = current.business.franchiseOps[teamId]!;
        const sponsor = signSponsorship(current, teamId, {
          id: asSponsorshipId(`sponsor_ai_${teamId}_${year}`),
          sponsorName: `Regional Partners ${year}`,
          // Existing formula uses marketSize as deal economics (sim), not as an
          // extra AI preference stack — identity only gates willingness.
          annualValue: Math.round(
            1_500_000 +
              latestOps.marketSize * 40_000 +
              latestOps.fanSentiment * 10_000 +
              latestOps.mediaAttention * AI_SPONSOR_MEDIA_VALUE_PER_POINT,
          ),
          startYear: year,
          endYear: year + 2,
          reputationFloor: 35,
          playoffBonus: 250_000,
        });
        current = sponsor.state;
        events.push(...sponsor.events);
      } catch {
        // Already has sponsor id or validation failure — skip.
      }
    }

    current = withAppliedGameplayConsequence(current, key);
  }

  return systemResult(current, events);
}

export function ticketPriceFromPreferences(
  current: number,
  sentiment: number,
  prefs: EffectivePreferences,
): number {
  // attendancePriority → lower prices; spendWillingness → higher gate.
  const attendancePull = (prefs.attendancePriority - 0.5) * 2; // -1..1
  const revenuePull = (prefs.spendWillingness - prefs.cashPreservation) ; // roughly -1..1
  const rawStep =
    -attendancePull * AI_TICKET_PRICE_STEP_MAX * 0.6 +
    revenuePull * AI_TICKET_PRICE_STEP_MAX * 0.4;
  let step = Math.round(
    Math.max(-AI_TICKET_PRICE_STEP_MAX, Math.min(AI_TICKET_PRICE_STEP_MAX, rawStep)),
  );
  if (sentiment < 35 && step > 0) {
    step = Math.min(step, 0);
  }
  // Conservative / high cash preservation: prefer no-op when step tiny
  if (prefs.cashPreservation > 0.65 && Math.abs(step) <= 1) {
    return current;
  }
  if (step === 0) {
    return current;
  }
  return Math.round(Math.max(20, Math.min(120, current + step)));
}

export function premiumTicketPriceFromPreferences(
  current: number,
  prefs: EffectivePreferences,
): number {
  const attendancePull = (prefs.attendancePriority - 0.5) * 2;
  const revenuePull = prefs.spendWillingness - prefs.cashPreservation;
  const rawStep =
    -attendancePull * 15 + revenuePull * 20;
  let step = Math.round(Math.max(-25, Math.min(25, rawStep)));
  if (prefs.cashPreservation > 0.65 && Math.abs(step) <= 5) {
    return current;
  }
  if (step === 0) {
    return current;
  }
  return Math.round(
    Math.max(
      PREMIUM_TICKET_PRICE_MIN,
      Math.min(PREMIUM_TICKET_PRICE_MAX, current + step),
    ),
  );
}

export function marketingBudgetFromPreferences(
  current: number,
  cash: number,
  prefs: EffectivePreferences,
): number {
  if (prefs.cashPreservation > 0.7 && prefs.marketingPriority < 0.45) {
    return current;
  }
  const desire =
    (prefs.marketingPriority - prefs.cashPreservation) *
    AI_MARKETING_BUDGET_STEP_MAX;
  let step = Math.round(
    Math.max(
      -AI_MARKETING_BUDGET_STEP_MAX,
      Math.min(AI_MARKETING_BUDGET_STEP_MAX, desire),
    ),
  );
  if (Math.abs(step) < 100_000) {
    return current;
  }
  const affordableCap = Math.max(250_000, Math.floor(cash * 0.08));
  const target = Math.max(250_000, Math.min(affordableCap, current + step));
  return Math.round(target);
}

export function facilityUpgradeFromPreferences(
  ops: GameState["business"]["franchiseOps"][string],
  cash: number,
  prefs: EffectivePreferences,
): FacilityCategory | null {
  if (cash < AI_FACILITY_MIN_CASH) {
    return null;
  }
  if (prefs.cashPreservation > 0.75 && cash < AI_FACILITY_CONSERVATIVE_CASH) {
    return null;
  }
  // Low spend willingness: sometimes skip (inaction)
  if (prefs.spendWillingness < 0.35 && cash < AI_FACILITY_CONSERVATIVE_CASH) {
    return null;
  }

  const scores: { category: FacilityCategory; score: number }[] = [
    {
      category: "practice",
      score: prefs.developmentPriority,
    },
    {
      category: "training",
      score: prefs.developmentPriority * 0.9 + prefs.winNowPressure * 0.2,
    },
    {
      category: "youth",
      score: prefs.developmentPriority * 0.85 + prefs.youthValue * 0.2,
    },
    {
      category: "medical",
      score: prefs.winNowPressure * 0.7 + prefs.establishedPlayerValue * 0.2,
    },
    {
      category: "arena",
      score: prefs.marketingPriority * 0.4 + prefs.attendancePriority * 0.4,
    },
    {
      category: "fan",
      score: prefs.attendancePriority * 0.7 + prefs.marketingPriority * 0.2,
    },
  ];

  scores.sort((a, b) => b.score - a.score);
  for (const { category, score } of scores) {
    if (score < 0.4) {
      continue;
    }
    const f = ops.facilities[category];
    if (f.level < 5 && f.upgradeWeeksRemaining === 0) {
      return category;
    }
  }
  return null;
}

export function shouldSignSponsorFromPreferences(
  state: GameState,
  teamId: TeamId,
  cash: number,
  prefs: EffectivePreferences,
): boolean {
  const active = Object.values(state.business.sponsorships).filter(
    (s) => s.teamId === teamId && s.status === "active",
  );
  if (active.length > 0) {
    return false;
  }
  if (cash < 3_000_000 && prefs.cashPreservation > 0.5) {
    // Still may want guaranteed revenue when cash-poor
    return prefs.cashPreservation > 0.6;
  }
  const willingness = clampPreference(
    prefs.cashPreservation * 0.45 +
      prefs.marketingPriority * 0.25 +
      (1 - prefs.riskAppetite) * 0.2 +
      prefs.spendWillingness * 0.1,
  );
  return willingness >= 0.45;
}

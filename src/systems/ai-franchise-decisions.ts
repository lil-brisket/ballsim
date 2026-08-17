import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { asSponsorshipId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import type { GameState } from "@/state/game-state";
import { isUserControlledTeam } from "@/systems/ai-team-decisions";
import { startFacilityUpgrade } from "@/systems/facilities";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import { setMarketingBudget } from "@/systems/marketing";
import { signSponsorship } from "@/systems/sponsorships";
import { AI_SPONSOR_MEDIA_VALUE_PER_POINT } from "@/systems/sponsorships-config";
import { setTicketPrice } from "@/systems/ticket-pricing";

/**
 * Profile-driven franchise ops decisions using the SAME commands as the owner.
 * Never mutates the user-controlled team. Idempotent per week via consequence keys.
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
    const profile = ops.aiProfile;
    const cash = current.business.finances[teamId]?.cash ?? 0;

    const priceResult = setTicketPrice(
      current,
      teamId,
      ticketPriceForProfile(profile, ops.ticketPrice, ops.fanSentiment),
    );
    current = priceResult.state;
    events.push(...priceResult.events);

    const marketingResult = setMarketingBudget(
      current,
      teamId,
      marketingBudgetForProfile(profile, ops.marketing.budget, cash),
    );
    current = marketingResult.state;
    events.push(...marketingResult.events);

    const upgradeCategory = facilityUpgradeForProfile(profile, ops, cash);
    if (upgradeCategory) {
      try {
        const upgrade = startFacilityUpgrade(current, teamId, upgradeCategory);
        current = upgrade.state;
        events.push(...upgrade.events);
      } catch {
        // Insufficient cash or maxed — skip.
      }
    }

    if (shouldSignSponsor(profile, current, teamId) && cash > 5_000_000) {
      try {
        const year = current.competition.season.year;
        const sponsor = signSponsorship(current, teamId, {
          id: asSponsorshipId(`sponsor_ai_${teamId}_${year}`),
          sponsorName: `Regional Partners ${year}`,
          annualValue: Math.round(
            1_500_000 +
              ops.marketSize * 40_000 +
              ops.fanSentiment * 10_000 +
              ops.mediaAttention * AI_SPONSOR_MEDIA_VALUE_PER_POINT,
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

function ticketPriceForProfile(
  profile: AiProfile,
  current: number,
  sentiment: number,
): number {
  let target = current;
  switch (profile) {
    case "aggressive":
    case "win_now":
      target = Math.min(120, Math.max(55, current + 5));
      break;
    case "market_growth":
      target = Math.max(25, Math.min(50, current - 3));
      break;
    case "conservative":
      target = sentiment < 40 ? Math.max(20, current - 5) : current;
      break;
    case "development":
      target = Math.max(30, Math.min(55, current));
      break;
  }
  return Math.round(target);
}

function marketingBudgetForProfile(
  profile: AiProfile,
  current: number,
  cash: number,
): number {
  let target = current;
  switch (profile) {
    case "market_growth":
    case "aggressive":
      target = Math.min(8_000_000, Math.max(3_000_000, current + 500_000));
      break;
    case "conservative":
      target = Math.min(current, Math.max(500_000, Math.floor(cash * 0.01)));
      break;
    case "win_now":
      target = Math.max(1_000_000, Math.min(2_500_000, current));
      break;
    case "development":
      target = Math.max(1_500_000, Math.min(4_000_000, current));
      break;
  }
  return Math.round(target);
}

function facilityUpgradeForProfile(
  profile: AiProfile,
  ops: GameState["business"]["franchiseOps"][string],
  cash: number,
): "practice" | "training" | "medical" | "arena" | "youth" | "fan" | null {
  if (cash < 8_000_000) {
    return null;
  }
  const pick = (
    category: "practice" | "training" | "medical" | "arena" | "youth" | "fan",
  ) => {
    const f = ops.facilities[category];
    return f.level < 5 && f.upgradeWeeksRemaining === 0 ? category : null;
  };

  switch (profile) {
    case "development":
      return pick("practice") ?? pick("training") ?? pick("youth");
    case "win_now":
      return pick("medical") ?? pick("training");
    case "market_growth":
      return pick("arena") ?? pick("fan");
    case "aggressive":
      return pick("arena") ?? pick("practice");
    case "conservative":
      return cash > 25_000_000 ? pick("practice") : null;
  }
}

function shouldSignSponsor(
  profile: AiProfile,
  state: GameState,
  teamId: TeamId,
): boolean {
  const active = Object.values(state.business.sponsorships).filter(
    (s) => s.teamId === teamId && s.status === "active",
  );
  if (active.length > 0) {
    return false;
  }
  return (
    profile === "market_growth" ||
    profile === "aggressive" ||
    profile === "conservative"
  );
}

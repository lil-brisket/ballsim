import { createSponsorship, type Sponsorship } from "@/domain/entities/sponsorship";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { SponsorshipId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  sponsorshipClimateFactor,
  sponsorshipMediaFactor,
} from "@/systems/sponsorships-config";
import {
  hasAppliedGameplayConsequence,
  withAppliedGameplayConsequence,
} from "@/systems/gameplay-financial-consequences";
import { applyCashAndBooksImpact } from "@/systems/team-finances";

export type SignSponsorshipInput = {
  id: SponsorshipId;
  sponsorName: string;
  annualValue: number;
  startYear: number;
  endYear: number;
  reputationFloor: number;
  playoffBonus: number;
};

export function signSponsorship(
  state: GameState,
  teamId: TeamId,
  input: SignSponsorshipInput,
): SystemResult {
  const team = state.world.teams[teamId];
  if (!team) {
    throw new Error(`signSponsorship: team "${teamId}" not found.`);
  }
  const sponsorship = createSponsorship({
    ...input,
    teamId,
    status: "active",
  });

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "SponsorshipSigned",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        teamId,
        sponsorshipId: sponsorship.id,
        sponsorName: sponsorship.sponsorName,
        annualValue: sponsorship.annualValue,
      },
    }),
  ];

  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        sponsorships: {
          ...state.business.sponsorships,
          [sponsorship.id]: sponsorship,
        },
      },
    },
    events,
  );
}

function isTeamInPlayoffs(state: GameState, teamId: TeamId): boolean {
  return state.competition.playoffs.qualifiedTeams.some(
    (seed) => seed.teamId === teamId,
  );
}

export function playoffSponsorshipBonusKey(
  teamId: TeamId,
  year: number,
  sponsorshipId: string,
): string {
  return `playoff_sponsor_bonus:${teamId}:${year}:${sponsorshipId}`;
}

/** Monthly scaled base payout for a team (no playoff bonus). */
export function estimateMonthlySponsorshipPayout(
  state: GameState,
  teamId: string,
): number {
  const year = state.competition.season.year;
  const climate = state.business.leagueEconomy.sponsorshipClimate;
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  const mediaAttention = ops?.mediaAttention ?? 50;
  let monthlyBase = 0;
  for (const sponsorship of Object.values(state.business.sponsorships)) {
    if (sponsorship.status !== "active") {
      continue;
    }
    if (sponsorship.teamId !== teamId) {
      continue;
    }
    if (year < sponsorship.startYear || year > sponsorship.endYear) {
      continue;
    }
    if (!team || team.reputation < sponsorship.reputationFloor) {
      continue;
    }
    monthlyBase += Math.floor(sponsorship.annualValue / 12);
  }
  return Math.round(
    monthlyBase *
      sponsorshipMediaFactor(mediaAttention) *
      sponsorshipClimateFactor(climate),
  );
}

/**
 * Monthly sponsorship cash. Scales payout by media + league climate
 * without mutating stored annualValue. Playoff bonus is paid once per
 * deal per season when the team is qualified — not every month.
 */
export function processMonthlySponsorshipRevenue(
  state: GameState,
): SystemResult {
  const year = state.competition.season.year;
  const climate = state.business.leagueEconomy.sponsorshipClimate;
  let current = state;
  const events: DomainEvent[] = [];

  const byTeam = new Map<TeamId, Sponsorship[]>();
  for (const sponsorship of Object.values(current.business.sponsorships)) {
    if (sponsorship.status !== "active") {
      continue;
    }
    if (year < sponsorship.startYear || year > sponsorship.endYear) {
      continue;
    }
    const team = current.world.teams[sponsorship.teamId];
    if (!team || team.reputation < sponsorship.reputationFloor) {
      continue;
    }
    const list = byTeam.get(sponsorship.teamId) ?? [];
    list.push(sponsorship);
    byTeam.set(sponsorship.teamId, list);
  }

  for (const [teamId, sponsorships] of [...byTeam.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const monthlyBase = sponsorships.reduce(
      (sum, s) => sum + Math.floor(s.annualValue / 12),
      0,
    );
    const ops = current.business.franchiseOps[teamId];
    const mediaAttention = ops?.mediaAttention ?? 50;
    const scaledBase = Math.round(
      monthlyBase *
        sponsorshipMediaFactor(mediaAttention) *
        sponsorshipClimateFactor(climate),
    );
    let amount = scaledBase;
    if (isTeamInPlayoffs(current, teamId)) {
      for (const sponsorship of sponsorships) {
        if (sponsorship.playoffBonus <= 0) {
          continue;
        }
        const bonusKey = playoffSponsorshipBonusKey(
          teamId,
          year,
          sponsorship.id,
        );
        if (hasAppliedGameplayConsequence(current, bonusKey)) {
          continue;
        }
        amount += sponsorship.playoffBonus;
        current = withAppliedGameplayConsequence(current, bonusKey);
      }
    }
    if (amount <= 0) {
      continue;
    }
    const impact = applyCashAndBooksImpact(current, teamId, amount, year, {
      revenueCategory: "sponsorships",
    });
    current = impact.state;
    events.push(...impact.events);
  }

  return systemResult(current, events);
}

export function expireSponsorshipsAtSeason(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const events: DomainEvent[] = [];
  let sponsorships = state.business.sponsorships;
  let changed = false;

  for (const [id, sponsorship] of Object.entries(sponsorships)) {
    if (sponsorship.status !== "active") {
      continue;
    }
    if (year > sponsorship.endYear) {
      sponsorships = {
        ...sponsorships,
        [id]: { ...sponsorship, status: "expired" },
      };
      changed = true;
      events.push(
        createDomainEvent({
          type: "SponsorshipExpired",
          occurredOn: state.world.calendar.currentDate,
          payload: {
            teamId: sponsorship.teamId,
            sponsorshipId: sponsorship.id,
          },
        }),
      );
    }
  }

  if (!changed) {
    return systemResult(state);
  }

  return systemResult(
    {
      ...state,
      business: { ...state.business, sponsorships },
    },
    events,
  );
}

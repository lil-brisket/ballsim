import { createSponsorship, type Sponsorship } from "@/domain/entities/sponsorship";
import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { SponsorshipId, TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
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

export function processMonthlySponsorshipRevenue(
  state: GameState,
): SystemResult {
  const year = state.competition.season.year;
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
    let amount = monthlyBase;
    if (isTeamInPlayoffs(current, teamId)) {
      amount += sponsorships.reduce((sum, s) => sum + s.playoffBonus, 0);
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

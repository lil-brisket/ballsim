import type {
  AwardDefinitionId,
  AwardResult,
} from "@/domain/entities/awards";
import type { PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatPeriodLabel(period: string | null): string | null {
  if (!period) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const year = match[1]!;
  const monthIndex = Number(match[2]) - 1;
  const monthName = MONTH_NAMES[monthIndex];
  if (!monthName) return period;
  return `${monthName} ${year}`;
}

export type PlayerAwardRowView = {
  awardId: AwardDefinitionId;
  displayName: string;
  shortLabel: string;
  seasonYear: number;
  period: string | null;
  periodLabel: string | null;
  teamId: string | null;
  teamName: string | null;
  cadence: "monthly" | "yearly";
  tier: "major" | "monthly";
};

export type PlayerAwardCareerTotalView = {
  awardId: AwardDefinitionId;
  displayName: string;
  shortLabel: string;
  count: number;
};

export type LeagueAwardRowView = {
  result: AwardResult;
  displayName: string;
  winnerName: string;
  winnerHref: string | null;
  teamName: string | null;
  finalists: Array<{
    name: string;
    href: string | null;
    score: number;
    rank: number;
  }>;
};

function subjectName(state: GameState, result: AwardResult): string {
  if (result.winner.subjectType === "coach") {
    const coach = state.world.coaches[result.winner.subjectId];
    return coach ? `${coach.firstName} ${coach.lastName}` : result.winner.subjectId;
  }
  const player = state.world.players[result.winner.subjectId];
  return player
    ? `${player.firstName} ${player.lastName}`
    : result.winner.subjectId;
}

function subjectHref(
  saveId: string,
  result: AwardResult,
): string | null {
  if (result.winner.subjectType === "player") {
    return `/dashboard/${saveId}/players/${result.winner.subjectId}`;
  }
  return null;
}

function teamName(state: GameState, teamId: string | null): string | null {
  if (!teamId) return null;
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

export function listAwardResults(
  state: GameState,
  filters?: {
    seasonYear?: number;
    awardId?: AwardDefinitionId;
    cadence?: "monthly" | "yearly";
  },
): AwardResult[] {
  let results = Object.values(state.business.awards?.results ?? {});
  if (filters?.seasonYear != null) {
    results = results.filter((r) => r.seasonYear === filters.seasonYear);
  }
  if (filters?.awardId) {
    results = results.filter((r) => r.awardId === filters.awardId);
  }
  if (filters?.cadence) {
    results = results.filter((r) => r.cadence === filters.cadence);
  }
  return results.sort((a, b) => {
    if (b.seasonYear !== a.seasonYear) return b.seasonYear - a.seasonYear;
    const ap = a.period ?? "";
    const bp = b.period ?? "";
    if (bp !== ap) return bp.localeCompare(ap);
    return a.awardId.localeCompare(b.awardId);
  });
}

export function getPlayerAwards(
  state: GameState,
  playerId: PlayerId,
): PlayerAwardRowView[] {
  return listAwardResults(state)
    .filter(
      (r) =>
        r.winner.subjectType === "player" && r.winner.subjectId === playerId,
    )
    .map((r) => {
      const def = AWARD_DEFINITIONS[r.awardId];
      return {
        awardId: r.awardId,
        displayName: def.displayName,
        shortLabel: def.shortLabel,
        seasonYear: r.seasonYear,
        period: r.period,
        periodLabel: formatPeriodLabel(r.period),
        teamId: r.winner.teamId,
        teamName: teamName(state, r.winner.teamId),
        cadence: r.cadence,
        tier: def.tier,
      };
    });
}

export function getPlayerAwardCareerTotals(
  state: GameState,
  playerId: PlayerId,
): PlayerAwardCareerTotalView[] {
  const counts = new Map<AwardDefinitionId, number>();
  for (const row of getPlayerAwards(state, playerId)) {
    counts.set(row.awardId, (counts.get(row.awardId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([awardId, count]) => {
      const def = AWARD_DEFINITIONS[awardId];
      return {
        awardId,
        displayName: def.displayName,
        shortLabel: def.shortLabel,
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.awardId.localeCompare(b.awardId));
}

export function toPlayerAwardsView(state: GameState, playerId: PlayerId) {
  return {
    awards: getPlayerAwards(state, playerId),
    awardCareerTotals: getPlayerAwardCareerTotals(state, playerId),
  };
}

export function toLeagueAwardsView(
  state: GameState,
  saveId: string,
  filters?: {
    seasonYear?: number;
    awardId?: AwardDefinitionId;
  },
): {
  seasons: number[];
  rows: LeagueAwardRowView[];
} {
  const all = listAwardResults(state);
  const seasons = [...new Set(all.map((r) => r.seasonYear))].sort(
    (a, b) => b - a,
  );
  const filtered = listAwardResults(state, filters);
  const rows: LeagueAwardRowView[] = filtered.map((result) => {
    const def = AWARD_DEFINITIONS[result.awardId];
    const finalists = result.candidates
      .filter((c) => c.rank > 1)
      .map((c) => {
        let name: string = String(c.subjectId);
        let href: string | null = null;
        if (
          result.winner.subjectType === "player" ||
          def.subjectType === "player"
        ) {
          const player = state.world.players[c.subjectId];
          if (player) {
            name = `${player.firstName} ${player.lastName}`;
            href = `/dashboard/${saveId}/players/${c.subjectId}`;
          }
        } else {
          const coach = state.world.coaches[c.subjectId];
          if (coach) {
            name = `${coach.firstName} ${coach.lastName}`;
          }
        }
        return { name, href, score: c.score, rank: c.rank };
      });
    return {
      result,
      displayName: def.displayName,
      winnerName: subjectName(state, result),
      winnerHref: subjectHref(saveId, result),
      teamName: teamName(state, result.winner.teamId),
      finalists,
    };
  });
  return { seasons, rows };
}

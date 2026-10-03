/**
 * Team-first simulation summary for calendar simulate-to-date completion.
 */

import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import { getTeamTransactions } from "@/state/team-transaction-selectors";
import { buildSimulationHighlights } from "@/systems/simulation/simulation-highlights";

export type SimulationSummaryItem = {
  date: string;
  headline: string;
  kind: "team" | "league";
  gameId?: string;
};

export type SimulationSummary = {
  fromDate: string;
  toDate: string;
  teamId: TeamId | null;
  teamLabel: string | null;
  record: {
    wins: number;
    losses: number;
    gamesPlayed: number;
  } | null;
  standingsDelta: number | null;
  teamGames: SimulationSummaryItem[];
  teamEvents: SimulationSummaryItem[];
  leagueEvents: SimulationSummaryItem[];
  transactionCount: number;
  injuryNotes: string[];
};

export type BuildSimulationSummaryOptions = {
  fromDate: string;
  toDate: string;
  teamId?: TeamId;
};

function teamLabel(state: GameState, teamId: TeamId): string {
  const team = state.world.teams[teamId];
  return team ? `${team.city} ${team.name}` : String(teamId);
}

function countTeamGamesInRange(
  state: GameState,
  teamId: TeamId,
  fromDate: string,
  toDate: string,
): { wins: number; losses: number; gamesPlayed: number } {
  const games = listTeamGamesInRange(state, teamId, fromDate, toDate);
  let wins = 0;
  let losses = 0;
  for (const game of games) {
    const isHome = game.homeTeamId === teamId;
    const homeScore = game.score.home;
    const awayScore = game.score.away;
    const won = isHome ? homeScore > awayScore : awayScore > homeScore;
    if (won) wins += 1;
    else losses += 1;
  }
  return { wins, losses, gamesPlayed: wins + losses };
}

function listTeamGamesInRange(
  state: GameState,
  teamId: TeamId,
  fromDate: string,
  toDate: string,
) {
  return Object.values(state.competition.games)
    .filter((game) => {
      if (game.status !== "final") return false;
      if (game.date < fromDate || game.date > toDate) return false;
      return game.homeTeamId === teamId || game.awayTeamId === teamId;
    })
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.id.localeCompare(b.id);
    });
}

function teamGameHeadline(
  state: GameState,
  teamId: TeamId,
  game: GameState["competition"]["games"][string],
): string {
  const isHome = game.homeTeamId === teamId;
  const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
  const opponent = state.world.teams[opponentId];
  const opponentLabel = opponent
    ? opponent.abbreviation
    : String(opponentId);
  const teamScore = isHome ? game.score.home : game.score.away;
  const opponentScore = isHome ? game.score.away : game.score.home;
  const result =
    teamScore === opponentScore
      ? "T"
      : teamScore > opponentScore
        ? "W"
        : "L";
  return `${result} ${teamScore}–${opponentScore} vs ${opponentLabel}`;
}

function eventHeadline(event: DomainEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.headline === "string") return payload.headline;
  return event.type;
}

/**
 * Build a team-centric simulation completion summary.
 */
export function buildSimulationSummary(
  state: GameState,
  events: readonly DomainEvent[],
  options: BuildSimulationSummaryOptions,
): SimulationSummary {
  const teamId = options.teamId ?? getActiveOwnerTeamId(state);
  const team = teamId ? state.world.teams[teamId] : null;

  const transactions = teamId
    ? getTeamTransactions(
        state,
        teamId,
        {
          from: options.fromDate,
          to: options.toDate,
        },
        events,
      )
    : [];

  const teamGames: SimulationSummaryItem[] = teamId
    ? listTeamGamesInRange(state, teamId, options.fromDate, options.toDate).map(
        (game) => ({
          date: game.date,
          headline: teamGameHeadline(state, teamId, game),
          kind: "team" as const,
          gameId: game.id,
        }),
      )
    : [];

  const teamEvents: SimulationSummaryItem[] = transactions
    .slice(-8)
    .map((row) => ({
      date: row.event.occurredOn,
      headline: eventHeadline(row.event),
      kind: "team" as const,
    }));

  const highlights = buildSimulationHighlights(state, events);
  const leagueEvents: SimulationSummaryItem[] = [];
  for (const highlight of highlights) {
    if (leagueEvents.length >= 5) break;
    const involvesTeam =
      teamId != null &&
      events.some(
        (event) =>
          event.id === highlight.sourceEventId &&
          getTeamTransactions(
            state,
            teamId,
            { from: options.fromDate, to: options.toDate },
            [event],
          ).length > 0,
      );
    if (involvesTeam) continue;
    leagueEvents.push({
      date: highlight.date,
      headline: highlight.headline,
      kind: "league",
    });
  }

  const injuryNotes: string[] = [];
  if (teamId) {
    for (const event of events) {
      if (event.type !== "PlayerInjured") {
        continue;
      }
      const payload = event.payload as Record<string, unknown>;
      if (payload.teamId !== teamId) continue;
      injuryNotes.push(eventHeadline(event));
      if (injuryNotes.length >= 5) break;
    }
  }

  return {
    fromDate: options.fromDate,
    toDate: options.toDate,
    teamId: teamId ?? null,
    teamLabel: teamId && team ? teamLabel(state, teamId) : null,
    record: teamId
      ? countTeamGamesInRange(state, teamId, options.fromDate, options.toDate)
      : null,
    standingsDelta: null,
    teamGames,
    teamEvents,
    leagueEvents,
    transactionCount: transactions.length,
    injuryNotes,
  };
}

/**
 * Personalization scoring for Media Hub items (0–100).
 * Heuristics are intentionally simple for MVP.
 */

import type { TeamId, PlayerId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

export type RelevanceOptions = {
  /** Franchise viewing the feed (owner team). */
  viewerTeamId: TeamId;
  /** Look-ahead window (days) for upcoming-opponent bonus. Default 14. */
  upcomingDays?: number;
};

const USER_TEAM_BONUS = 40;
const DIVISION_CONFERENCE_BONUS = 15;
const UPCOMING_OPPONENT_BONUS = 20;
const PLAYOFF_IMPLICATIONS_BONUS = 25;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function teamIdsInvolved(
  state: GameState,
  teamIds: readonly TeamId[] | undefined,
  playerIds: readonly PlayerId[] | undefined,
): TeamId[] {
  const set = new Set<string>();
  for (const teamId of teamIds ?? []) {
    set.add(teamId);
  }
  for (const playerId of playerIds ?? []) {
    const player = state.world.players[playerId];
    if (player?.teamId) {
      set.add(player.teamId);
    }
  }
  return [...set] as TeamId[];
}

function isSameDivisionOrConference(
  state: GameState,
  viewerTeamId: TeamId,
  otherTeamId: TeamId,
): boolean {
  const viewer = state.world.teams[viewerTeamId];
  const other = state.world.teams[otherTeamId];
  if (!viewer || !other) {
    return false;
  }
  return (
    viewer.divisionId === other.divisionId ||
    viewer.conferenceId === other.conferenceId
  );
}

function isUpcomingOpponent(
  state: GameState,
  viewerTeamId: TeamId,
  otherTeamIds: readonly TeamId[],
  upcomingDays: number,
): boolean {
  if (otherTeamIds.length === 0) {
    return false;
  }
  const otherSet = new Set(otherTeamIds);
  const currentDate = state.world.calendar.currentDate;
  const horizonMs =
    Date.parse(`${currentDate}T00:00:00Z`) + upcomingDays * 86_400_000;

  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game || game.status === "final") {
      continue;
    }
    const involvesViewer =
      game.homeTeamId === viewerTeamId || game.awayTeamId === viewerTeamId;
    if (!involvesViewer) {
      continue;
    }
    const gameMs = Date.parse(`${game.date}T00:00:00Z`);
    if (Number.isNaN(gameMs) || gameMs > horizonMs) {
      continue;
    }
    const opponentId =
      game.homeTeamId === viewerTeamId ? game.awayTeamId : game.homeTeamId;
    if (otherSet.has(opponentId)) {
      return true;
    }
  }
  return false;
}

/**
 * Simple playoff-race heuristic: viewer or involved team is in the top half
 * of its conference by win%, or competition is already in postseason.
 */
function hasPlayoffImplications(
  state: GameState,
  viewerTeamId: TeamId,
  involvedTeamIds: readonly TeamId[],
): boolean {
  const phase = state.competition.season.phase;
  if (phase === "playoffs" || phase === "postseason") {
    return true;
  }

  const conferenceId = state.world.teams[viewerTeamId]?.conferenceId;
  if (!conferenceId) {
    return false;
  }

  const conferenceTeams = Object.values(state.world.teams).filter(
    (team) => team.conferenceId === conferenceId,
  );
  if (conferenceTeams.length < 2) {
    return false;
  }

  const ranked = conferenceTeams
    .map((team) => ({
      teamId: team.id,
      winPercentage:
        state.competition.standings.byTeamId[team.id]?.winPercentage ?? 0,
    }))
    .sort((a, b) => b.winPercentage - a.winPercentage || a.teamId.localeCompare(b.teamId));

  const cutline = Math.ceil(ranked.length / 2);
  const inRace = new Set(ranked.slice(0, cutline).map((row) => row.teamId));

  if (inRace.has(viewerTeamId)) {
    for (const teamId of involvedTeamIds) {
      if (teamId !== viewerTeamId && inRace.has(teamId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Compute a 0–100 relevance score for a media story relative to a franchise.
 */
export function computeRelevanceScore(
  state: GameState,
  teamIds: readonly TeamId[] | undefined,
  playerIds: readonly PlayerId[] | undefined,
  opts: RelevanceOptions,
): number {
  const viewerTeamId = opts.viewerTeamId;
  const upcomingDays = opts.upcomingDays ?? 14;
  const involved = teamIdsInvolved(state, teamIds, playerIds);

  let score = 0;

  if (involved.includes(viewerTeamId)) {
    score += USER_TEAM_BONUS;
  }

  const others = involved.filter((id) => id !== viewerTeamId);
  if (
    others.some((id) => isSameDivisionOrConference(state, viewerTeamId, id))
  ) {
    score += DIVISION_CONFERENCE_BONUS;
  }

  if (isUpcomingOpponent(state, viewerTeamId, others, upcomingDays)) {
    score += UPCOMING_OPPONENT_BONUS;
  }

  if (hasPlayoffImplications(state, viewerTeamId, involved)) {
    score += PLAYOFF_IMPLICATIONS_BONUS;
  }

  return clampScore(score);
}

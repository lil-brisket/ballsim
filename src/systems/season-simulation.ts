import type { DomainEvent } from "@/domain/events";
import type { SeasonId, TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { simulateGamesForDate } from "@/systems/game-simulation";
import {
  simulatePlayoffs,
  startPlayoffs,
} from "@/systems/playoff-simulation";
import { generateSchedule } from "@/systems/schedule-generation";
import { MIN_TEAM_COUNT } from "@/systems/schedule-generation-config";
import { updateStandings } from "@/systems/standings";
import { transitionPhase } from "@/systems/simulation/phase-machine";

/**
 * Simulates an entire regular season: ensure schedule, sim remaining scheduled
 * games via {@link simulateGamesForDate}, then rebuild standings.
 * When the league is large enough for playoffs, continues into the postseason
 * and produces a champion.
 *
 * Does not mutate the caller-provided state. Callers persist `rng.getState()`.
 */
export function simulateSeason(
  state: GameState,
  rng: Rng,
  seasonId?: SeasonId,
): SystemResult {
  validatePreSchedule(state, seasonId);

  const events: DomainEvent[] = [];
  let current = state;

  if (current.competition.playoffs.status === "complete") {
    return systemResult(current);
  }

  if (current.competition.playoffs.status === "in_progress") {
    const playoffResult = simulatePlayoffs(current, rng);
    return systemResult(playoffResult.state, playoffResult.events);
  }

  if (current.competition.schedule.gameIds.length === 0) {
    if (current.competition.season.phase === "preseason") {
      const phaseResult = transitionPhase(current, "regular");
      current = phaseResult.state;
      events.push(...phaseResult.events);
    }
    const scheduleResult = generateSchedule(current);
    current = scheduleResult.state;
    events.push(...scheduleResult.events);
  }

  validatePostSchedule(current);

  const dates = uniqueDatesInScheduleOrder(current);
  for (const date of dates) {
    const dayResult = simulateGamesForDate(current, rng, date);
    current = dayResult.state;
    events.push(...dayResult.events);
  }

  const standingsResult = updateStandings(current);
  current = standingsResult.state;
  events.push(...standingsResult.events);

  assertAllScheduledGamesFinal(current);

  const playoffTeams = current.settings.playoffs.playoffTeams;
  const liveTeamCount = Object.keys(current.world.teams).length;
  if (playoffTeams <= 0 || playoffTeams > liveTeamCount) {
    return systemResult(current, events);
  }

  const started = startPlayoffs(current, rng);
  current = started.state;
  events.push(...started.events);

  if (current.competition.season.phase === "regular") {
    const phaseResult = transitionPhase(current, "playoffs");
    current = phaseResult.state;
    events.push(...phaseResult.events);
  }

  const playoffResult = simulatePlayoffs(current, rng);
  current = playoffResult.state;
  events.push(...playoffResult.events);

  return systemResult(current, events);
}

function validatePreSchedule(state: GameState, seasonId?: SeasonId): void {
  const season = state.competition.season;

  if (seasonId !== undefined && seasonId !== season.id) {
    throw new Error(
      `simulateSeason seasonId ${seasonId} does not match competition season ${season.id}.`,
    );
  }

  const teamCount = Object.keys(state.world.teams).length;
  if (teamCount < MIN_TEAM_COUNT) {
    throw new Error(
      `simulateSeason requires at least ${MIN_TEAM_COUNT} teams; found ${teamCount}.`,
    );
  }

  const { phase } = season;
  const scheduleEmpty = state.competition.schedule.gameIds.length === 0;
  const playoffs = state.competition.playoffs;

  if (phase === "offseason") {
    throw new Error(
      `simulateSeason cannot run while season phase is "${phase}".`,
    );
  }

  if (phase === "playoffs" && playoffs.status === "not_started") {
    throw new Error(
      'simulateSeason: season phase "playoffs" with playoffs not started is inconsistent.',
    );
  }

  if (phase === "preseason" && !scheduleEmpty) {
    throw new Error(
      'simulateSeason: season phase "preseason" with an existing schedule is inconsistent.',
    );
  }
}

function validatePostSchedule(state: GameState): void {
  const { season, schedule, games } = state.competition;
  const { teams } = state.world;

  if (schedule.seasonId !== season.id) {
    throw new Error(
      `Schedule seasonId ${schedule.seasonId} does not match competition season ${season.id}.`,
    );
  }

  if (schedule.gameIds.length === 0) {
    throw new Error("simulateSeason requires a non-empty schedule.");
  }

  const seenGameIds = new Set<string>();
  for (const gameId of schedule.gameIds) {
    if (seenGameIds.has(gameId)) {
      throw new Error(`Schedule contains duplicate game id ${gameId}.`);
    }
    seenGameIds.add(gameId);
  }

  const matchupKeys = new Set<string>();
  const participatingTeamIds = new Set<TeamId>();

  for (const gameId of schedule.gameIds) {
    const game = games[gameId];
    if (!game) {
      throw new Error(`Scheduled game ${gameId} is missing from competition.games.`);
    }

    if (game.seasonId !== season.id) {
      throw new Error(
        `Game ${gameId} seasonId ${game.seasonId} does not match competition season ${season.id}.`,
      );
    }

    if (game.homeTeamId === game.awayTeamId) {
      throw new Error(`Game ${gameId} has the same home and away team.`);
    }

    if (!teams[game.homeTeamId]) {
      throw new Error(
        `Game ${gameId} references unknown home team ${game.homeTeamId}.`,
      );
    }
    if (!teams[game.awayTeamId]) {
      throw new Error(
        `Game ${gameId} references unknown away team ${game.awayTeamId}.`,
      );
    }

    if (game.status !== "scheduled" && game.status !== "final") {
      throw new Error(
        `Game ${gameId} has invalid status "${game.status}" for season simulation.`,
      );
    }

    const matchupKey = `${game.date}\0${game.homeTeamId}\0${game.awayTeamId}`;
    if (matchupKeys.has(matchupKey)) {
      throw new Error(
        `Duplicate matchup on ${game.date}: ${game.homeTeamId} vs ${game.awayTeamId}.`,
      );
    }
    matchupKeys.add(matchupKey);

    participatingTeamIds.add(game.homeTeamId);
    participatingTeamIds.add(game.awayTeamId);
  }

  for (const teamId of participatingTeamIds) {
    validateParticipatingTeamRoster(state, teamId);
  }
}

function validateParticipatingTeamRoster(
  state: GameState,
  teamId: TeamId,
): void {
  const team = state.world.teams[teamId];
  if (!team) {
    throw new Error(`Participating team ${teamId} is missing from world.teams.`);
  }

  for (const playerId of team.roster) {
    if (!state.world.players[playerId]) {
      throw new Error(
        `Team ${teamId} roster references missing player ${playerId}.`,
      );
    }
  }

  const playersForTeam = Object.values(state.world.players).filter(
    (player) => player.teamId === teamId,
  );

  if (team.roster.length === 0 && playersForTeam.length === 0) {
    throw new Error(`Team ${teamId} has no players available for simulation.`);
  }

  if (team.roster.length > 0) {
    const resolvedCount = team.roster.filter(
      (playerId) => state.world.players[playerId] != null,
    ).length;
    if (resolvedCount === 0) {
      throw new Error(`Team ${teamId} has no players available for simulation.`);
    }
  }
}

function uniqueDatesInScheduleOrder(state: GameState): string[] {
  const dates: string[] = [];
  const seen = new Set<string>();

  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game) {
      continue;
    }
    if (!seen.has(game.date)) {
      seen.add(game.date);
      dates.push(game.date);
    }
  }

  return dates;
}

function assertAllScheduledGamesFinal(state: GameState): void {
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game || game.status !== "final") {
      throw new Error(
        `simulateSeason completed without every scheduled game final; ${gameId} is ${game?.status ?? "missing"}.`,
      );
    }
  }
}

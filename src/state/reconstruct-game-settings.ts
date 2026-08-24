import {
  cloneGameSettings,
  DEFAULT_GAME_SETTINGS,
  isSupportedGamesPerTeam,
  isSupportedPlayoffTeamCount,
  type GameSettings,
  type SeriesLength,
} from "@/domain/game-settings";
import { tryResolveLeagueShape } from "@/domain/league-shape";
import { defaultSeasonLength } from "@/systems/schedule-generation-config";
import { getLegacyPlayoffTeamCount } from "@/systems/playoff-config";
import type { GameState } from "@/state/game-state";

type ReconstructInput = {
  world: {
    conferences: Record<string, { divisionIds: readonly string[] }>;
    divisions: Record<string, unknown>;
    teams: Record<string, unknown>;
  };
  competition: {
    schedule: { gameIds: readonly string[] };
    games: Record<string, { homeTeamId: string; awayTeamId: string }>;
  };
};

/**
 * Rebuild GameSettings from a pre-v25 save's live league.
 * Does not stamp Standard 30/82/16 onto old 12-team CBL careers.
 */
export function reconstructGameSettingsFromState(
  state: ReconstructInput,
): GameSettings {
  const teamCount = Object.keys(state.world.teams).length;
  const conferenceCount = Math.max(
    1,
    Object.keys(state.world.conferences).length,
  );
  let divisionsEnabled = Object.values(state.world.conferences).some(
    (conference) => conference.divisionIds.length > 1,
  );

  let resolvedConferenceCount = conferenceCount;
  if (![1, 2, 4].includes(resolvedConferenceCount)) {
    resolvedConferenceCount = teamCount % 2 === 0 ? 2 : 1;
  }
  if (teamCount > 0 && teamCount % resolvedConferenceCount !== 0) {
    resolvedConferenceCount = 1;
    divisionsEnabled = false;
  }
  if (divisionsEnabled) {
    const shape = tryResolveLeagueShape({
      teamCount: Math.max(teamCount, 2),
      conferenceCount: resolvedConferenceCount,
      divisionsEnabled: true,
    });
    if (!shape.ok) {
      divisionsEnabled = false;
    }
  }

  let gamesPerTeam = defaultSeasonLength(Math.max(teamCount, 2));
  if (state.competition.schedule.gameIds.length > 0) {
    const counts = new Map<string, number>();
    for (const teamId of Object.keys(state.world.teams)) {
      counts.set(teamId, 0);
    }
    for (const gameId of state.competition.schedule.gameIds) {
      const game = state.competition.games[gameId];
      if (!game) {
        continue;
      }
      counts.set(game.homeTeamId, (counts.get(game.homeTeamId) ?? 0) + 1);
      counts.set(game.awayTeamId, (counts.get(game.awayTeamId) ?? 0) + 1);
    }
    const values = [...counts.values()];
    if (values.length > 0) {
      const first = values[0]!;
      if (values.every((value) => value === first) && first > 0) {
        gamesPerTeam = first;
      }
    }
  }

  if (!isSupportedGamesPerTeam(gamesPerTeam)) {
    // Prefer nearest supported value when schedule length is exotic.
    const supported = [14, 20, 22, 30, 40, 60, 72, 82] as const;
    gamesPerTeam = supported.reduce((best, candidate) =>
      Math.abs(candidate - gamesPerTeam) < Math.abs(best - gamesPerTeam)
        ? candidate
        : best,
    );
  }

  let playoffTeams = getLegacyPlayoffTeamCount(teamCount);
  if (playoffTeams === 0) {
    playoffTeams = teamCount >= 4 ? 4 : teamCount;
  }
  if (
    !isSupportedPlayoffTeamCount(playoffTeams) &&
    playoffTeams !== teamCount
  ) {
    const supported = [4, 6, 8, 12, 16] as const;
    const fit = supported.filter((n) => n <= teamCount);
    playoffTeams = fit.at(-1) ?? Math.min(teamCount, 4);
  }

  const seriesLength: SeriesLength = 7;

  return {
    league: {
      teamCount: teamCount > 0 ? teamCount : DEFAULT_GAME_SETTINGS.league.teamCount,
      conferenceCount: resolvedConferenceCount,
      divisionsEnabled,
      area: DEFAULT_GAME_SETTINGS.league.area,
    },
    injuriesEnabled: DEFAULT_GAME_SETTINGS.injuriesEnabled,
    regularSeason: {
      gamesPerTeam,
      tradeDeadlineRule: { ...DEFAULT_GAME_SETTINGS.regularSeason.tradeDeadlineRule },
    },
    playoffs: {
      playoffTeams,
      seriesLength,
      playInEnabled: false,
    },
    simulation: {
      frequency: "daily",
    },
    ai: {
      difficulty: "normal",
    },
    financialRules: {
      salaryCapEnabled: true,
      luxuryTaxEnabled: true,
      revenueSharingEnabled: true,
    },
    draft: { ...DEFAULT_GAME_SETTINGS.draft },
    history: { ...DEFAULT_GAME_SETTINGS.history },
  };
}

export function withDefaultSettings(
  settings: GameSettings | undefined,
): GameSettings {
  return cloneGameSettings(settings ?? DEFAULT_GAME_SETTINGS);
}

/** Type guard helper for full GameState after migration. */
export function assertHasSettings(
  state: Omit<GameState, "settings"> & { settings?: GameSettings },
): asserts state is GameState {
  if (state.settings === undefined) {
    throw new Error("GameState.settings is required.");
  }
}

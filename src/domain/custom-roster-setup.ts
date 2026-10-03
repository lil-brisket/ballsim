import {
  cloneGameSettings,
  isSupportedTeamCount,
  maxControlledTeamCountForLeague,
  SUPPORTED_PLAYOFF_TEAM_COUNTS,
  type GameSettings,
  type SupportedTeamCount,
} from "@/domain/game-settings";
import { tryResolveLeagueShape } from "@/domain/league-shape";

function clampPlayoffTeams(current: number, teamCount: number): number {
  if (
    (SUPPORTED_PLAYOFF_TEAM_COUNTS as readonly number[]).includes(current) &&
    current <= teamCount
  ) {
    return current;
  }
  const supported = SUPPORTED_PLAYOFF_TEAM_COUNTS.filter(
    (count) => count <= teamCount,
  );
  return supported.at(-1) ?? 4;
}

function leagueShapeForRoster(
  teamCount: SupportedTeamCount,
  settings: GameSettings,
): { conferenceCount: number; divisionsEnabled: boolean } {
  const currentConference = settings.league.conferenceCount;
  const conferenceCount =
    currentConference === 1 || currentConference === 2
      ? teamCount % currentConference === 0
        ? currentConference
        : teamCount % 2 === 0
          ? 2
          : 1
      : teamCount % 2 === 0
        ? 2
        : 1;

  if (
    tryResolveLeagueShape({
      teamCount,
      conferenceCount,
      divisionsEnabled: settings.league.divisionsEnabled,
    }).ok
  ) {
    return {
      conferenceCount,
      divisionsEnabled: settings.league.divisionsEnabled,
    };
  }

  if (
    tryResolveLeagueShape({
      teamCount,
      conferenceCount,
      divisionsEnabled: false,
    }).ok
  ) {
    return { conferenceCount, divisionsEnabled: false };
  }

  return { conferenceCount: 1, divisionsEnabled: false };
}

export function applyCustomRosterTeamCount(
  settings: GameSettings,
  teamCount: SupportedTeamCount,
): GameSettings {
  const next = cloneGameSettings(settings);
  const shape = leagueShapeForRoster(teamCount, next);
  const maxControlled = maxControlledTeamCountForLeague(teamCount);
  return {
    ...next,
    league: {
      ...next.league,
      teamCount,
      conferenceCount: shape.conferenceCount,
      divisionsEnabled: shape.divisionsEnabled,
    },
    playoffs: {
      ...next.playoffs,
      playoffTeams: clampPlayoffTeams(next.playoffs.playoffTeams, teamCount),
    },
    ownership: {
      controlledTeamCount: Math.min(
        Math.max(1, next.ownership.controlledTeamCount),
        maxControlled,
      ),
    },
    draft: {
      ...next.draft,
      mode: "custom",
      userPickPosition: null,
      randomizeUserPick: false,
    },
  };
}

export function isLockedCustomRosterTeamCount(
  teamCount: number | null,
): teamCount is SupportedTeamCount {
  return teamCount !== null && isSupportedTeamCount(teamCount);
}

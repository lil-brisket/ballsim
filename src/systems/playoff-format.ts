import type { ConferenceId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

/**
 * How the playoff field is qualified and bracketed.
 *
 * - `conference`: each conference sends its top `spotsPerConference` teams
 *   into its own sub-bracket; conference champions meet in the Finals
 *   (or semifinals first with four conferences).
 * - `league`: top `playoffTeams` league-wide in one bracket (1-conference
 *   leagues and field/conference combinations that cannot split evenly).
 */
export type PlayoffFormat =
  | {
      kind: "conference";
      playoffTeams: number;
      conferenceIds: ConferenceId[];
      spotsPerConference: number;
    }
  | { kind: "league"; playoffTeams: number };

export type PlayoffFormatInput = {
  playoffTeams: number;
  playInEnabled: boolean;
  /** League conference order; conferences without teams are ignored. */
  conferenceOrder: readonly ConferenceId[];
  teamConferenceById: ReadonlyMap<TeamId, ConferenceId>;
};

const SUPPORTED_CONFERENCE_BRACKET_COUNTS = new Set([2, 4]);

/** Per-conference field sizes with a bracket template. */
export function isSupportedConferenceFieldSize(spots: number): boolean {
  if (!Number.isInteger(spots) || spots < 1) {
    return false;
  }
  return spots === 3 || spots === 6 || (spots & (spots - 1)) === 0;
}

export function resolvePlayoffFormatFor(
  input: PlayoffFormatInput,
): PlayoffFormat {
  const { playoffTeams } = input;
  const league: PlayoffFormat = { kind: "league", playoffTeams };
  if (input.playInEnabled) {
    return league;
  }

  const teamCounts = new Map<ConferenceId, number>();
  for (const conferenceId of input.teamConferenceById.values()) {
    teamCounts.set(conferenceId, (teamCounts.get(conferenceId) ?? 0) + 1);
  }
  const conferenceIds = input.conferenceOrder.filter((id) =>
    teamCounts.has(id),
  );
  const unlisted = [...teamCounts.keys()]
    .filter((id) => !conferenceIds.includes(id))
    .sort();
  conferenceIds.push(...unlisted);

  if (!SUPPORTED_CONFERENCE_BRACKET_COUNTS.has(conferenceIds.length)) {
    return league;
  }
  if (playoffTeams % conferenceIds.length !== 0) {
    return league;
  }
  const spotsPerConference = playoffTeams / conferenceIds.length;
  if (!isSupportedConferenceFieldSize(spotsPerConference)) {
    return league;
  }
  if (
    conferenceIds.some((id) => (teamCounts.get(id) ?? 0) < spotsPerConference)
  ) {
    return league;
  }

  return {
    kind: "conference",
    playoffTeams,
    conferenceIds,
    spotsPerConference,
  };
}

export function teamConferenceMap(state: GameState): Map<TeamId, ConferenceId> {
  const map = new Map<TeamId, ConferenceId>();
  for (const team of Object.values(state.world.teams)) {
    map.set(team.id, team.conferenceId);
  }
  return map;
}

/** Playoff format for the configured field and current league shape. */
export function resolvePlayoffFormat(state: GameState): PlayoffFormat {
  return resolvePlayoffFormatFor({
    playoffTeams: state.settings.playoffs.playoffTeams,
    playInEnabled: state.settings.playoffs.playInEnabled,
    conferenceOrder: state.world.league.conferenceIds,
    teamConferenceById: teamConferenceMap(state),
  });
}

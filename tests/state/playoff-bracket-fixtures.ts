import type { PlayoffTournament } from "@/domain/entities/playoffs";
import {
  createEmptyTeamStanding,
  type TeamStanding,
} from "@/domain/entities/standings";
import type { Team } from "@/domain/entities/team";
import { asConferenceId, asTeamId, type ConferenceId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import {
  generateBracket,
  generateConferenceBracket,
} from "@/systems/playoff-bracket";
import {
  qualifyAndSeed,
  qualifyAndSeedByConference,
} from "@/systems/playoff-qualification";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

const CONFERENCES = ["east", "west", "north", "south"].map((name) =>
  asConferenceId(`conf_${name}`),
);

export type Synthetic = {
  state: GameState;
  conferenceIds: ConferenceId[];
  standings: TeamStanding[];
};

/**
 * Synthetic league: `perConference` teams in each of `conferenceCount`
 * conferences. Records interleave conferences (east_1 best, west_1 next...),
 * so overall seeds differ from conference seeds. No playoffs are started.
 */
export function syntheticLeague(
  conferenceCount: number,
  perConference: number,
  playoffTeams: number,
  saveId: string,
): Synthetic {
  const base = bootstrapWorld(
    createTestGameState({ saveId }),
    createSeededRng(saveId),
  ).state;
  const template: Team = Object.values(base.world.teams)[0]!;
  const conferenceIds = CONFERENCES.slice(0, conferenceCount);
  const total = conferenceCount * perConference;
  const teams: Record<string, Team> = {};
  const standings: TeamStanding[] = [];
  for (let index = 0; index < perConference; index += 1) {
    conferenceIds.forEach((conferenceId, confIndex) => {
      const id = asTeamId(`${conferenceId}_${index + 1}`);
      teams[id] = {
        ...template,
        id,
        city: conferenceId,
        name: `T${index + 1}`,
        abbreviation: `T${index + 1}`,
        conferenceId,
      };
      const wins = total - (index * conferenceCount + confIndex);
      standings.push({
        ...createEmptyTeamStanding(id),
        wins,
        losses: total - wins,
        winPercentage: wins / total,
      });
    });
  }
  const firstTeam = asTeamId(`${conferenceIds[0]}_1`);
  const state: GameState = {
    ...base,
    world: {
      ...base.world,
      teams,
      conferences: Object.fromEntries(
        conferenceIds.map((id) => [
          id,
          {
            id,
            leagueId: base.world.league.id,
            name: id.replace("conf_", "").toUpperCase(),
            divisionIds: [],
          },
        ]),
      ),
      league: { ...base.world.league, conferenceIds },
    },
    settings: {
      ...base.settings,
      playoffs: {
        ...base.settings.playoffs,
        playoffTeams,
        playInEnabled: false,
      },
    },
    user: {
      ...base.user,
      ownedTeamIds: [firstTeam],
      activeOwnerTeamId: firstTeam,
    },
    competition: {
      ...base.competition,
      standings: {
        byTeamId: Object.fromEntries(standings.map((s) => [s.teamId, s])),
      },
    },
  };
  return { state, conferenceIds, standings };
}

export function withPlayoffs(
  state: GameState,
  tournament: PlayoffTournament,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      playoffs: { ...tournament, status: "in_progress" },
    },
  };
}

export function conferenceBracketState(
  conferenceCount: number,
  perConference: number,
  spots: number,
  saveId: string,
): GameState {
  const league = syntheticLeague(
    conferenceCount,
    perConference,
    spots * conferenceCount,
    saveId,
  );
  const { seeds, groups } = qualifyAndSeedByConference(
    league.standings,
    new Map(
      Object.values(league.state.world.teams).map((t) => [
        t.id,
        t.conferenceId,
      ]),
    ),
    league.conferenceIds,
    spots,
  );
  return withPlayoffs(league.state, generateConferenceBracket(groups, seeds));
}

export function leagueWideState(
  conferenceCount: number,
  perConference: number,
  field: number,
  saveId: string,
): GameState {
  const league = syntheticLeague(conferenceCount, perConference, field, saveId);
  return withPlayoffs(
    league.state,
    generateBracket(qualifyAndSeed(league.standings, field)),
  );
}

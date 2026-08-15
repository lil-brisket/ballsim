import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { GameState } from "@/state/game-state";
import { generateDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import { createPlayer } from "../../factories/player";
import { createContract } from "@/domain/entities/contract";
import {
  asContractId,
  asPlayerId,
  asTeamId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { TEST_NOW_ISO, TEST_RNG_SEED } from "../../helpers/determinism";
import { ensureDraftPicks } from "@/systems/world-pipeline";

export type DraftFixtureOptions = {
  rosterSize?: number;
};

/**
 * World with rosters, contracts, standings, and draft picks ready for createDraft.
 */
export function createDraftFixture(
  options: DraftFixtureOptions = {},
): GameState {
  const rosterSize = options.rosterSize ?? 10;
  const base = createInitialGameState({
    saveId: "save_draft",
    rngSeed: TEST_RNG_SEED,
    nowIso: TEST_NOW_ISO,
    settings: CBL_GAME_SETTINGS,
  });

  const year = base.competition.season.year;
  const teamIdList = Object.keys(base.world.teams).sort() as TeamId[];
  const players = { ...base.world.players };
  const contracts = { ...base.business.contracts };
  const teams = { ...base.world.teams };
  const standingsByTeam = { ...base.competition.standings.byTeamId };

  for (let teamIndex = 0; teamIndex < teamIdList.length; teamIndex += 1) {
    const teamId = teamIdList[teamIndex]!;
    const roster: PlayerId[] = [];
    for (let i = 0; i < rosterSize; i += 1) {
      const playerId = asPlayerId(`player_${teamId}_${i}`);
      const contractId = asContractId(`contract_${playerId}`);
      players[playerId] = createPlayer({
        id: playerId,
        teamId,
        contractId,
      });
      contracts[contractId] = createContract({
        id: contractId,
        playerId,
        teamId,
        startYear: year,
        endYear: year + 1,
        salaryByYear: {
          [String(year)]: 5_000_000,
          [String(year + 1)]: 5_000_000,
        },
      });
      roster.push(playerId);
    }
    teams[teamId] = { ...teams[teamId]!, roster };
    // Distinct win totals for reverse-standings order (worst first).
    standingsByTeam[teamId] = {
      ...standingsByTeam[teamId]!,
      wins: teamIndex,
      losses: 10 - teamIndex,
    };
  }

  let state: GameState = {
    ...base,
    world: {
      ...base.world,
      teams,
      players,
      draftPicks: generateDraftPicksForSeason(Object.values(teams), year),
      drafts: {},
    },
    competition: {
      ...base.competition,
      standings: { byTeamId: standingsByTeam },
    },
    business: {
      ...base.business,
      contracts,
    },
    user: {
      ...base.user,
      controlledTeamId: asTeamId(teamIdList[0]!),
    },
  };

  state = ensureDraftPicks(state);
  return state;
}

export function sortedTeamIds(state: GameState): TeamId[] {
  return Object.keys(state.world.teams).sort() as TeamId[];
}

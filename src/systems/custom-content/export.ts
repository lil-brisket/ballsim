import {
  CUSTOM_CONTENT_FORMAT_VERSION,
  type DraftClassPackage,
  type PlayerSourceRecord,
  type RosterPackage,
  type RosterPlayerSource,
} from "@/systems/custom-content/package-types";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import type { GameState } from "@/state/game-state";
import { draftClassIdFor } from "@/domain/entities/draft";
import type { Player } from "@/domain/entities/player";

function isoNow(): string {
  return new Date().toISOString();
}

function playerToSource(player: Player, sourceId: string): PlayerSourceRecord {
  return {
    sourceId,
    firstName: player.firstName,
    lastName: player.lastName,
    nationality: player.nationality,
    age: player.age,
    heightInches: player.heightInches,
    weightPounds: player.weightPounds,
    position: player.position,
    archetype: player.archetype,
    attributes: { ...player.attributes },
    potential: { ...player.potential },
    personality: { ...player.personality },
    durability: player.physical.durability,
  };
}

export function exportRoster(state: GameState, title?: string): RosterPackage {
  const now = isoNow();
  const contentId = crypto.randomUUID();
  const teams = Object.values(state.world.teams)
    .slice()
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map((team) => ({
      sourceId: team.id,
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
    }));
  const teamIdSet = new Set(teams.map((team) => team.sourceId));
  const players: RosterPlayerSource[] = Object.values(state.world.players)
    .filter((player) => player.retired !== true)
    .slice()
    .sort((left, right) => (left.id < right.id ? -1 : 1))
    .map((player) => {
      const contract =
        player.contractId === null
          ? undefined
          : state.business.contracts[player.contractId];
      const teamSourceId =
        player.teamId !== null && teamIdSet.has(player.teamId)
          ? player.teamId
          : null;
      const annualSalary =
        contract === undefined
          ? undefined
          : contract.salaryByYear[String(contract.startYear)];
      return {
        ...playerToSource(player, player.id),
        teamSourceId,
        contract:
          contract === undefined
            ? undefined
            : {
                years: contract.endYear - contract.startYear + 1,
                annualSalary,
              },
      };
    });
  return {
    formatVersion: CUSTOM_CONTENT_FORMAT_VERSION,
    type: "roster",
    contentId,
    metadata: {
      title: title ?? `${state.world.league.name} Roster`,
      version: "1.0.0",
      createdAt: now,
      updatedAt: now,
    },
    compatibility: {
      gameStateSchemaVersion: GAME_STATE_SCHEMA_VERSION,
      minSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    },
    payload: { teams, players },
  };
}

export function exportDraftClass(
  state: GameState,
  draftYear: number,
  title?: string,
): DraftClassPackage {
  const draft = state.world.drafts[draftClassIdFor(draftYear)];
  if (draft === undefined) {
    throw new Error(`No draft class exists for year ${draftYear}.`);
  }
  const now = isoNow();
  const contentId = crypto.randomUUID();
  const prospects = Object.values(draft.prospects)
    .slice()
    .sort((left, right) => left.ranking - right.ranking)
    .map((prospect) => playerToSource(prospect.player, prospect.playerId));
  return {
    formatVersion: CUSTOM_CONTENT_FORMAT_VERSION,
    type: "draft_class",
    contentId,
    metadata: {
      title: title ?? `${draftYear} Draft Class`,
      version: "1.0.0",
      createdAt: now,
      updatedAt: now,
    },
    compatibility: {
      gameStateSchemaVersion: GAME_STATE_SCHEMA_VERSION,
      minSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    },
    payload: {
      draftYear,
      prospects,
    },
  };
}

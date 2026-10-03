import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";
import type { PlayerAttributes } from "@/domain/entities/player";
import {
  CUSTOM_CONTENT_FORMAT_VERSION,
  type DraftClassPackage,
  type PlayerSourceRecord,
  type RosterPackage,
  type RosterPlayerSource,
  type RosterTeamSource,
} from "@/systems/custom-content/package-types";

const DEFAULT_ATTRIBUTES: PlayerAttributes = {
  speed: 73,
  strength: 66,
  athleticism: 73,
  stamina: 70,
  finishing: 70,
  midRange: 68,
  threePoint: 67,
  freeThrow: 72,
  ballHandling: 71,
  passing: 72,
  perimeterDefense: 69,
  interiorDefense: 65,
  steal: 64,
  block: 60,
  rebounding: 64,
  basketballIq: 70,
  offensiveIq: 69,
  defensiveIq: 67,
  consistency: 68,
};

void PLAYER_ATTRIBUTE_KEYS;

export function makePlayerSource(
  overrides: Partial<PlayerSourceRecord> & { sourceId: string },
): PlayerSourceRecord {
  return {
    firstName: "Test",
    lastName: overrides.sourceId,
    nationality: "USA",
    age: 24,
    heightInches: 78,
    weightPounds: 215,
    position: "SF",
    archetype: "two_way_forward",
    attributes: { ...DEFAULT_ATTRIBUTES },
    potential: { overall: 80 },
    personality: {
      workEthic: 60,
      loyalty: 55,
      competitiveness: 65,
      leadership: 50,
      composure: 58,
    },
    ...overrides,
  };
}

export function makeRosterPackage(input: {
  contentId?: string;
  teams: RosterTeamSource[];
  players: RosterPlayerSource[];
}): RosterPackage {
  const now = "2026-10-02T00:00:00.000Z";
  return {
    formatVersion: CUSTOM_CONTENT_FORMAT_VERSION,
    type: "roster",
    contentId: input.contentId ?? "11111111-1111-4111-8111-111111111111",
    metadata: {
      title: "Test Roster",
      version: "1.0.0",
      createdAt: now,
      updatedAt: now,
      author: "test",
      description: "test roster",
    },
    compatibility: {
      gameStateSchemaVersion: GAME_STATE_SCHEMA_VERSION,
      minSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    },
    payload: {
      teams: input.teams,
      players: input.players,
    },
  };
}

export function makeDraftClassPackage(input: {
  contentId?: string;
  draftYear: number;
  prospects: PlayerSourceRecord[];
}): DraftClassPackage {
  const now = "2026-10-02T00:00:00.000Z";
  return {
    formatVersion: CUSTOM_CONTENT_FORMAT_VERSION,
    type: "draft_class",
    contentId: input.contentId ?? "22222222-2222-4222-8222-222222222222",
    metadata: {
      title: "Test Class",
      version: "1.0.0",
      createdAt: now,
      updatedAt: now,
      author: "test",
      description: "test class",
    },
    compatibility: {
      gameStateSchemaVersion: GAME_STATE_SCHEMA_VERSION,
      minSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    },
    payload: {
      draftYear: input.draftYear,
      prospects: input.prospects,
    },
  };
}

const SLOT_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const SLOT_ARCHETYPES = [
  "floor_general",
  "scoring_guard",
  "two_way_forward",
  "stretch_big",
  "rim_protector",
] as const;
const SLOT_HEIGHT = [74, 76, 78, 80, 82] as const;
const SLOT_WEIGHT = [190, 200, 215, 235, 245] as const;

export function makeFullRosterPackage(input: {
  teamCount: number;
  playersPerTeam?: number;
  contentId?: string;
}): RosterPackage {
  const playersPerTeam = input.playersPerTeam ?? 15;
  const teams: RosterTeamSource[] = [];
  const players: RosterPlayerSource[] = [];
  for (let teamIndex = 0; teamIndex < input.teamCount; teamIndex += 1) {
    const sourceId = `t${teamIndex}`;
    teams.push({
      sourceId,
      name: `Team ${teamIndex}`,
      city: `City ${teamIndex}`,
      abbreviation: `T${teamIndex}`,
    });
    for (let slot = 0; slot < playersPerTeam; slot += 1) {
      const pos = SLOT_POSITIONS[slot % 5]!;
      players.push({
        ...makePlayerSource({
          sourceId: `${sourceId}_p${slot}`,
          lastName: `Player${teamIndex}_${slot}`,
          position: pos,
          archetype: SLOT_ARCHETYPES[slot % 5]!,
          heightInches: SLOT_HEIGHT[slot % 5]!,
          weightPounds: SLOT_WEIGHT[slot % 5]!,
        }),
        teamSourceId: sourceId,
      });
    }
  }
  return makeRosterPackage({
    contentId: input.contentId,
    teams,
    players,
  });
}

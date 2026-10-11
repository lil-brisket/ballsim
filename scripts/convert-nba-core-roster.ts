import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  CUSTOM_CONTENT_FORMAT_VERSION,
  CUSTOM_ROSTER_BODY_ENVELOPE,
  validateRosterPackage,
} from "@/systems/custom-content";
import type { PlayerNationality } from "@/domain/entities/player";
import { isPlayerNationality } from "@/domain/entities/player-nationality";

const SOURCE = resolve("NBA_2027_28_Projected_Core_Roster.json");
const OUTPUT = resolve("NBA_2027_28_Projected_Core_Roster.package.json");

const RATING_MIN = 1;
const RATING_MAX = 99;

const TEAM_IDENTITY: Record<string, { city: string; name: string }> = {
  atl: { city: "Atlanta", name: "Hawks" },
  bos: { city: "Boston", name: "Celtics" },
  brk: { city: "Brooklyn", name: "Nets" },
  nyk: { city: "New York", name: "Knicks" },
  phi: { city: "Philadelphia", name: "76ers" },
  tor: { city: "Toronto", name: "Raptors" },
  chi: { city: "Chicago", name: "Bulls" },
  cle: { city: "Cleveland", name: "Cavaliers" },
  det: { city: "Detroit", name: "Pistons" },
  ind: { city: "Indianapolis", name: "Pacers" },
  mil: { city: "Milwaukee", name: "Bucks" },
  cha: { city: "Charlotte", name: "Hornets" },
  mia: { city: "Miami", name: "Heat" },
  orl: { city: "Orlando", name: "Magic" },
  was: { city: "Washington", name: "Wizards" },
  den: { city: "Denver", name: "Nuggets" },
  min: { city: "Minneapolis", name: "Timberwolves" },
  okc: { city: "Oklahoma City", name: "Thunder" },
  por: { city: "Portland", name: "Trail Blazers" },
  uta: { city: "Salt Lake City", name: "Jazz" },
  gsw: { city: "San Francisco", name: "Warriors" },
  lac: { city: "Los Angeles", name: "Clippers" },
  lal: { city: "Los Angeles", name: "Lakers" },
  pho: { city: "Phoenix", name: "Suns" },
  sac: { city: "Sacramento", name: "Kings" },
  dal: { city: "Dallas", name: "Mavericks" },
  hou: { city: "Houston", name: "Rockets" },
  mem: { city: "Memphis", name: "Grizzlies" },
  nop: { city: "New Orleans", name: "Pelicans" },
  sas: { city: "San Antonio", name: "Spurs" },
};

const NATIONALITY_ALIASES: Record<string, PlayerNationality> = {
  Austria: "Germany",
  Bahamas: "USA",
  Belgium: "France",
  Bosnia: "Serbia",
  Cameroon: "Senegal",
  "DR Congo": "Senegal",
  Finland: "Germany",
  Georgia: "Greece",
  Israel: "Greece",
  Latvia: "Germany",
  Lithuania: "Germany",
  Poland: "Germany",
  Portugal: "Spain",
  Russia: "Serbia",
  Slovenia: "Serbia",
  "South Sudan": "Nigeria",
  Sweden: "Germany",
  Switzerland: "France",
  Turkey: "Greece",
  UK: "USA",
};

type SourceTeam = {
  id: string;
  abbreviation: string;
  name: string;
};

type SourcePlayer = {
  id: string;
  teamId: string;
  displayName: string;
  nationality: string;
  age: number;
  heightInches: number;
  weightPounds: number;
  position: string;
  archetype: string;
  attributes: Record<string, number>;
  potential: number | { overall: number };
  personality: Record<string, number>;
  durability?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asRating(value: number): number {
  return clamp(Math.round(value), RATING_MIN, RATING_MAX);
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: parts[0]! };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function mapNationality(raw: string): PlayerNationality {
  if (isPlayerNationality(raw)) {
    return raw;
  }
  const aliased = NATIONALITY_ALIASES[raw];
  if (aliased !== undefined) {
    return aliased;
  }
  return "USA";
}

function potentialOverall(raw: SourcePlayer["potential"]): number {
  if (typeof raw === "number") {
    return asRating(raw);
  }
  return asRating(raw.overall);
}

function dedupePlayersByName<T extends { firstName: string; lastName: string }>(
  players: T[],
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const player of players) {
    const key = `${player.firstName.toLowerCase()}|${player.lastName.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(player);
  }
  return unique;
}

const source = JSON.parse(readFileSync(SOURCE, "utf8")) as {
  metadata?: { name?: string; targetSeason?: string };
  teams: SourceTeam[];
  players: SourcePlayer[];
};

const now = new Date().toISOString();
const pkg = {
  formatVersion: CUSTOM_CONTENT_FORMAT_VERSION,
  type: "roster" as const,
  contentId: randomUUID(),
  metadata: {
    title: source.metadata?.name ?? "NBA 2027-28 Projected Core Roster",
    version: "1.0.0",
    createdAt: now,
    updatedAt: now,
    author: "converted",
    description:
      "Converted from NBA_2027_28_Projected_Core_Roster.json for Owner Mode custom roster import.",
  },
  compatibility: {
    gameStateSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    minSchemaVersion: GAME_STATE_SCHEMA_VERSION,
  },
  payload: {
    teams: source.teams.map((team) => {
      const identity = TEAM_IDENTITY[team.id];
      return {
        sourceId: team.id,
        name: identity?.name ?? team.name,
        city: identity?.city,
        abbreviation: team.abbreviation,
      };
    }),
    players: dedupePlayersByName(
      source.players.map((player) => {
        const { firstName, lastName } = splitDisplayName(player.displayName);
        return {
          sourceId: player.id,
          teamSourceId: player.teamId,
          firstName,
          lastName,
          nationality: mapNationality(player.nationality),
          age: player.age,
          heightInches: clamp(
            player.heightInches,
            CUSTOM_ROSTER_BODY_ENVELOPE.minHeightInches,
            CUSTOM_ROSTER_BODY_ENVELOPE.maxHeightInches,
          ),
          weightPounds: clamp(
            player.weightPounds,
            CUSTOM_ROSTER_BODY_ENVELOPE.minWeightPounds,
            CUSTOM_ROSTER_BODY_ENVELOPE.maxWeightPounds,
          ),
          position: player.position,
          archetype: player.archetype,
          attributes: Object.fromEntries(
            Object.entries(player.attributes).map(([key, value]) => [
              key,
              asRating(value),
            ]),
          ),
          potential: { overall: potentialOverall(player.potential) },
          personality: Object.fromEntries(
            Object.entries(player.personality).map(([key, value]) => [
              key,
              asRating(value),
            ]),
          ),
          durability:
            typeof player.durability === "number"
              ? asRating(player.durability)
              : undefined,
        };
      }),
    ),
  },
};

const result = validateRosterPackage(pkg, {
  teamCount: pkg.payload.teams.length,
  schemaVersion: GAME_STATE_SCHEMA_VERSION,
});

console.log(`ok=${result.ok}`);
console.log(`errors=${result.errors.length}`);
console.log(`warnings=${result.warnings.length}`);
for (const entry of result.errors) {
  console.log(`ERROR ${entry.path}: ${entry.message}`);
}
const warningCounts = new Map<string, number>();
for (const entry of result.warnings) {
  warningCounts.set(entry.code, (warningCounts.get(entry.code) ?? 0) + 1);
}
for (const [code, count] of [...warningCounts.entries()].sort()) {
  console.log(`WARN ${code}: ${count}`);
}

if (!result.ok) {
  process.exitCode = 1;
} else {
  writeFileSync(OUTPUT, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`wrote ${OUTPUT}`);
}

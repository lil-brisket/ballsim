import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import {
  CUSTOM_CONTENT_FORMAT_VERSION,
  CUSTOM_ROSTER_BODY_ENVELOPE,
  validateRosterPackage,
} from "@/systems/custom-content";
import type { PlayerNationality } from "@/domain/entities/player";
import { isPlayerNationality } from "@/domain/entities/player-nationality";

/**
 * Converts a flat roster JSON (teams + players with `displayName`) into a
 * custom roster package for Owner Mode import, and validates it.
 *
 *   npx tsx scripts/convert-roster-json.ts --in roster.json [--out roster.package.json]
 *
 * Keep source rosters in a gitignored folder such as `local-content/`.
 */
function readFlag(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return undefined;
  }
  return process.argv[index + 1];
}

const inputArg = readFlag("--in");
if (!inputArg) {
  console.error(
    "Usage: npx tsx scripts/convert-roster-json.ts --in <roster.json> [--out <roster.package.json>]",
  );
  process.exit(1);
}
const SOURCE = resolve(inputArg);
const OUTPUT = resolve(
  readFlag("--out") ?? SOURCE.replace(/\.json$/i, "") + ".package.json",
);

const RATING_MIN = 1;
const RATING_MAX = 99;

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
  city?: string;
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

function splitDisplayName(displayName: string): {
  firstName: string;
  lastName: string;
} {
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
    title: source.metadata?.name ?? "Custom roster",
    version: "1.0.0",
    createdAt: now,
    updatedAt: now,
    author: "converted",
    description: `Converted from ${basename(SOURCE)} for Owner Mode custom roster import.`,
  },
  compatibility: {
    gameStateSchemaVersion: GAME_STATE_SCHEMA_VERSION,
    minSchemaVersion: GAME_STATE_SCHEMA_VERSION,
  },
  payload: {
    teams: source.teams.map((team) => ({
      sourceId: team.id,
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
    })),
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

/**
 * Golden old saves: genuine saves produced by the code that shipped each
 * schema version (see scripts/generate-golden-saves.ts), loaded through the
 * full migration chain + validateGameState.
 *
 * The digest snapshot pins the exact migrated output, so a refactor of the
 * mapper/validator that changes behavior fails here. Adding a new migration
 * legitimately changes every digest: review, then run with `-u`.
 *
 * Fixtures are freshly created leagues (no played games), so migrations of
 * game / box-score / finance-books data stay covered by the hand-built
 * migration-*.test.ts and game-state-mapper.test.ts suites.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";

const FIXTURE_DIR = join(__dirname, "..", "fixtures", "saves");

const fixtures = readdirSync(FIXTURE_DIR)
  .filter((name) => /^v\d+\.json\.gz$/.test(name))
  .sort();

function readFixture(name: string): string {
  return gunzipSync(readFileSync(join(FIXTURE_DIR, name))).toString("utf8");
}

describe("golden old saves", () => {
  it("has fixtures spanning the schema history", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(10);
    expect(fixtures[0]).toBe("v01.json.gz");
  });

  it.each(fixtures)(
    "%s migrates to the current schema and validates",
    (name) => {
      const json = readFixture(name);
      const sourceVersion = (
        JSON.parse(json) as { meta: { schemaVersion: number } }
      ).meta.schemaVersion;
      expect(`v${String(sourceVersion).padStart(2, "0")}.json.gz`).toBe(name);

      const state = deserializeGameState(json);
      expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);

      // Migrated output is stable: a second load of the re-serialized state
      // is a no-op migration and must round-trip byte-for-byte.
      const serialized = serializeGameState(state);
      expect(serializeGameState(deserializeGameState(serialized))).toBe(
        serialized,
      );

      const digest = createHash("sha256").update(serialized).digest("hex");
      expect(digest).toMatchSnapshot();
    },
  );
});

vi.mock("server-only", () => ({}));

import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { serializeGameState } from "@/persistence/mappers/game-state-mapper";
import { SaveVersionConflictError } from "@/persistence/save-version-conflict";
import { createPrismaSaveGameStore } from "@/persistence/save-game-repository";
import { createPlayer } from "../factories/player";
import { createTestGameState } from "../factories/game-state";
import { splitColdHistory, withSaveHistory } from "@/persistence/save-history";
import { leagueWithHistory } from "./save-history-fixture";
import type { GameState } from "@/state/game-state";
import type { Player } from "@/domain/entities/player";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const prismaCli = path.join(
  repoRoot,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
const migrateHookTimeoutMs = 60_000;
const tempDir = mkdtempSync(path.join(tmpdir(), "ballsim-save-proj-"));
const dbFile = path.join(tempDir, "test.db").replace(/\\/g, "/");
const databaseUrl = `file:${dbFile}`;

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaLibSql({ url: databaseUrl }),
  });
}

function withPlayers(base: GameState, ...players: Player[]): GameState {
  return {
    ...base,
    world: {
      ...base.world,
      players: Object.fromEntries(players.map((player) => [player.id, player])),
    },
  };
}

describe("PrismaSaveGameStore normalized projections", () => {
  let prisma: PrismaClient;
  let store: ReturnType<typeof createPrismaSaveGameStore>;

  beforeAll(() => {
    execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
    prisma = createClient();
    store = createPrismaSaveGameStore(prisma);
  }, migrateHookTimeoutMs);

  afterAll(async () => {
    await prisma.$disconnect();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // libsql may still hold the SQLite file on Windows.
    }
  });

  beforeEach(async () => {
    await prisma.savePlayer.deleteMany();
    await prisma.saveTeam.deleteMany();
    await prisma.saveGame.deleteMany();
  });

  it("writes team and player projections on create and load round-trip uses stateJson", async () => {
    const base = createTestGameState({ saveId: "save_norm_create" });
    const teamId = Object.keys(base.world.teams)[0]!;
    const player = createPlayer({
      id: "player_norm",
      teamId,
      firstName: "Nia",
      lastName: "North",
      contractId: null,
    });
    const state = withPlayers(base, player);

    const created = await store.create({
      id: "save_norm_create",
      name: "Normalized Create",
      state,
    });
    expect(created.state.world.players[player.id]?.firstName).toBe("Nia");

    const teams = await prisma.saveTeam.findMany({
      where: { saveGameId: "save_norm_create" },
      orderBy: { teamId: "asc" },
    });
    const players = await prisma.savePlayer.findMany({
      where: { saveGameId: "save_norm_create" },
    });
    expect(teams).toHaveLength(Object.keys(state.world.teams).length);
    expect(teams[0]?.name).toBe(state.world.teams[teams[0]!.teamId]?.name);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      playerId: player.id,
      teamId,
      firstName: "Nia",
      lastName: "North",
    });

    const loaded = await store.load("save_norm_create");
    expect(loaded?.state.world.players[player.id]?.lastName).toBe("North");
  });

  it("replaces projections on save when roster membership changes", async () => {
    const base = createTestGameState({ saveId: "save_norm_update" });
    const teamId = Object.keys(base.world.teams)[0]!;
    const first = createPlayer({
      id: "player_old",
      teamId,
      contractId: null,
    });
    await store.create({
      id: "save_norm_update",
      name: "Normalized Update",
      state: withPlayers(base, first),
    });

    const next = createPlayer({
      id: "player_new",
      teamId: null,
      firstName: "Faye",
      contractId: null,
    });
    await store.save({
      id: "save_norm_update",
      state: withPlayers(base, next),
    });

    const players = await prisma.savePlayer.findMany({
      where: { saveGameId: "save_norm_update" },
    });
    expect(players).toHaveLength(1);
    expect(players[0]?.playerId).toBe(next.id);
    expect(players[0]?.teamId).toBeNull();
  });

  it("backfills projections on load for blob-only legacy rows", async () => {
    const base = createTestGameState({ saveId: "save_norm_backfill" });
    const teamId = Object.keys(base.world.teams)[0]!;
    const player = createPlayer({
      id: "player_legacy",
      teamId,
      contractId: null,
    });
    const state = withPlayers(base, player);

    await prisma.saveGame.create({
      data: {
        id: "save_norm_backfill",
        name: "Legacy Blob",
        schemaVersion: state.meta.schemaVersion,
        stateJson: serializeGameState(state),
      },
    });
    expect(
      await prisma.saveTeam.count({
        where: { saveGameId: "save_norm_backfill" },
      }),
    ).toBe(0);

    const loaded = await store.load("save_norm_backfill");
    expect(loaded?.id).toBe("save_norm_backfill");
    expect(
      await prisma.saveTeam.count({
        where: { saveGameId: "save_norm_backfill" },
      }),
    ).toBe(Object.keys(state.world.teams).length);
    expect(
      await prisma.savePlayer.findMany({
        where: { saveGameId: "save_norm_backfill" },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: player.id, teamId }),
      ]),
    );
  });

  it("returns from save exactly what a fresh load reads back", async () => {
    const base = createTestGameState({ saveId: "save_norm_roundtrip" });
    const created = await store.create({
      id: "save_norm_roundtrip",
      name: "Round Trip",
      state: base,
    });
    const player = createPlayer({
      id: "player_roundtrip",
      teamId: null,
      firstName: "Ola",
      contractId: null,
    });
    const saved = await store.save({
      id: "save_norm_roundtrip",
      state: withPlayers(base, player),
      ifUpdatedAt: created.updatedAt,
    });
    const loaded = await store.load("save_norm_roundtrip");
    expect(loaded).not.toBeNull();
    expect(saved.updatedAt).toEqual(loaded!.updatedAt);
    expect(saved.name).toBe("Round Trip");
    expect(saved.state).toEqual(loaded!.state);
    expect(saved.state.world.players[player.id]?.firstName).toBe("Ola");
  });

  it("stores new saves compressed", async () => {
    const state = createTestGameState({ saveId: "save_gzip_new" });
    await store.create({ id: "save_gzip_new", name: "Gzip", state });
    const row = await prisma.saveGame.findUnique({
      where: { id: "save_gzip_new" },
    });
    expect(row?.stateJson).toBe("");
    expect(row?.stateGzip).not.toBeNull();
    const json = gunzipSync(row!.stateGzip!).toString("utf8");
    expect(JSON.parse(json).meta.saveId).toBe("save_gzip_new");
    expect(row!.stateGzip!.length).toBeLessThan(json.length);
  });

  it("loads a save written before compression and compresses it on the next save", async () => {
    const state = createTestGameState({ saveId: "save_gzip_legacy" });
    await prisma.saveGame.create({
      data: {
        id: "save_gzip_legacy",
        name: "Legacy",
        schemaVersion: state.meta.schemaVersion,
        stateJson: serializeGameState(state),
      },
    });
    const loaded = await store.load("save_gzip_legacy");
    expect(loaded?.state.meta.saveId).toBe("save_gzip_legacy");

    await store.save({ id: "save_gzip_legacy", state: loaded!.state });
    const row = await prisma.saveGame.findUnique({
      where: { id: "save_gzip_legacy" },
    });
    expect(row?.stateJson).toBe("");
    expect(row?.stateGzip).not.toBeNull();
    const reloaded = await store.load("save_gzip_legacy");
    expect(reloaded?.state).toEqual(loaded?.state);
  });

  it("keeps old seasons out of the snapshot and stores each history chunk once", async () => {
    const state = leagueWithHistory("save_history_prisma");
    const created = await store.create({
      id: "save_history_prisma",
      name: "History",
      state,
    });
    expect(Object.keys(created.state.business.gameArchive).sort()).toEqual([
      "g_current",
      "g_prev",
      "g_unknown",
    ]);
    const history = await store.loadHistory("save_history_prisma");
    expect(Object.keys(history.games).sort()).toEqual(["g_old_1", "g_old_2"]);
    expect(
      withSaveHistory(created.state, history).business.gameArchive,
    ).toEqual(state.business.gameArchive);

    // A league saved with its history merged back writes no chunk twice.
    await store.save({
      id: "save_history_prisma",
      state: withSaveHistory(created.state, history),
    });
    const chunkIds = (
      await prisma.saveHistoryChunk.findMany({
        where: { saveGameId: "save_history_prisma" },
        select: { chunkId: true },
      })
    ).map((row) => row.chunkId);
    expect(chunkIds.sort()).toEqual(
      splitColdHistory(state).chunks.map((chunk) => chunk.chunkId),
    );

    await store.delete("save_history_prisma");
    expect(
      await prisma.saveHistoryChunk.count({
        where: { saveGameId: "save_history_prisma" },
      }),
    ).toBe(0);
  });

  it("does not write projections when CAS save fails", async () => {
    const state = createTestGameState({ saveId: "save_norm_cas" });
    const created = await store.create({
      id: "save_norm_cas",
      name: "CAS",
      state,
    });
    const before = await prisma.savePlayer.count({
      where: { saveGameId: "save_norm_cas" },
    });

    await expect(
      store.save({
        id: "save_norm_cas",
        state: withPlayers(
          state,
          createPlayer({
            id: "player_cas",
            teamId: null,
            contractId: null,
          }),
        ),
        ifUpdatedAt: new Date(created.updatedAt.getTime() - 1_000),
      }),
    ).rejects.toBeInstanceOf(SaveVersionConflictError);

    expect(
      await prisma.savePlayer.count({ where: { saveGameId: "save_norm_cas" } }),
    ).toBe(before);
  });

  it("deletes projection rows with the save", async () => {
    const state = createTestGameState({ saveId: "save_norm_delete" });
    await store.create({
      id: "save_norm_delete",
      name: "Delete Me",
      state,
    });
    expect(await store.delete("save_norm_delete")).toBe(true);
    expect(
      await prisma.saveTeam.count({
        where: { saveGameId: "save_norm_delete" },
      }),
    ).toBe(0);
    expect(
      await prisma.saveGame.count({ where: { id: "save_norm_delete" } }),
    ).toBe(0);
  });

  it("lists saves by updatedAt descending", async () => {
    const older = createTestGameState({ saveId: "save_list_older" });
    const newer = createTestGameState({ saveId: "save_list_newer" });
    await store.create({
      id: "save_list_older",
      name: "Alpha Slot",
      state: older,
    });
    await store.create({
      id: "save_list_newer",
      name: "Beta Slot",
      state: newer,
    });

    const listed = await store.list();
    expect(listed.map((row) => row.id)).toEqual([
      "save_list_newer",
      "save_list_older",
    ]);
    expect(listed.map((row) => row.name)).toEqual(["Beta Slot", "Alpha Slot"]);
  });
});

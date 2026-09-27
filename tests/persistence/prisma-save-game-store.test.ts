vi.mock("server-only", () => ({}));

import { execSync } from "node:child_process";
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
import type { GameState } from "@/state/game-state";
import type { Player } from "@/domain/entities/player";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
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
    execSync("npx prisma migrate deploy", {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    });
    prisma = createClient();
    store = createPrismaSaveGameStore(prisma);
  });

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

/**
 * CLI: how a long save grows. Runs a headless league career and records,
 * per season, the size of the snapshot every action reads and writes (the
 * hot GameState after finished-season history is split off), the player
 * table, and the wall time per simulated day.
 *
 * Usage:
 *   npx tsx scripts/save-growth.ts --seasons=30 --seed=42 --out=save-growth.json
 */

import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { calendarDaysBetween } from "@/domain/calendar-date";
import { serializeGameState } from "@/persistence/mappers/game-state-mapper";
import { splitColdHistory } from "@/persistence/save-history";
import { runLeagueCareer } from "@/simulation/league-sanity/run-league-career";

type SeasonGrowth = {
  season: number;
  hotJsonBytes: number;
  hotGzipBytes: number;
  players: number;
  retiredPlayers: number;
  playerTableBytes: number;
  /** Largest hot-snapshot slices (world.*, business.*, ...) by JSON bytes. */
  largestSlices: Record<string, number>;
  daysSimulated: number;
  msPerDay: number;
};

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function largestSlices(state: object, top = 8): Record<string, number> {
  const sizes: Array<[string, number]> = [];
  for (const [area, slice] of Object.entries(state)) {
    if (slice === null || typeof slice !== "object" || Array.isArray(slice)) {
      continue;
    }
    for (const [key, value] of Object.entries(slice as object)) {
      sizes.push([
        `${area}.${key}`,
        Buffer.byteLength(JSON.stringify(value) ?? ""),
      ]);
    }
  }
  return Object.fromEntries(sizes.sort((a, b) => b[1] - a[1]).slice(0, top));
}

function main(): void {
  const seasons = Number(argValue("seasons") ?? "30");
  const seed = Number(argValue("seed") ?? "42");
  const out = argValue("out");
  if (!Number.isInteger(seasons) || seasons < 1 || !Number.isFinite(seed)) {
    throw new Error("--seasons must be a positive integer and --seed a number");
  }

  const rows: SeasonGrowth[] = [];
  let lastAt = performance.now();
  let lastDate: string | null = null;

  runLeagueCareer({
    seed,
    seasons,
    skipOwnerGameplay: true,
    onSeasonComplete: (state, seasonIndex) => {
      const now = performance.now();
      const date = state.world.calendar.currentDate;
      // The first season also pays for league bootstrap; it is still listed.
      const days =
        lastDate === null
          ? 1
          : Math.max(1, calendarDaysBetween(lastDate, date));
      const hot = splitColdHistory(state).hot;
      const hotJson = serializeGameState(hot);
      const players = Object.values(state.world.players);
      const row: SeasonGrowth = {
        season: seasonIndex + 1,
        hotJsonBytes: Buffer.byteLength(hotJson),
        hotGzipBytes: gzipSync(hotJson, { level: 1 }).length,
        players: players.length,
        retiredPlayers: players.filter((player) => player.retired).length,
        playerTableBytes: Buffer.byteLength(
          JSON.stringify(state.world.players),
        ),
        largestSlices: largestSlices(hot),
        daysSimulated: days,
        msPerDay: Math.round(((now - lastAt) / days) * 10) / 10,
      };
      rows.push(row);
      process.stderr.write(
        `season ${row.season}: hot ${(row.hotJsonBytes / 1e6).toFixed(1)} MB` +
          ` (gzip ${(row.hotGzipBytes / 1e6).toFixed(2)} MB),` +
          ` players ${row.players} (${row.retiredPlayers} retired),` +
          ` ${row.msPerDay} ms/day\n`,
      );
      lastDate = date;
      // Exclude the measuring itself from the next season's timing.
      lastAt = performance.now();
    },
  });

  const text = `${JSON.stringify({ seed, seasons, rows }, null, 2)}\n`;
  if (out) {
    writeFileSync(out, text, "utf8");
  }
  process.stdout.write(text);
}

main();

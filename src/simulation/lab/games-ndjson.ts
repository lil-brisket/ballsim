import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LabPlayerStatRow } from "@/simulation/lab/lab-game-harness";
import type { GameSnapshot } from "@/simulation/validation/types";
import {
  DEFAULT_LAB_RESULTS_ROOT,
  type ManifestHost,
} from "@/simulation/lab/manifest";

export const LAB_GAMES_NDJSON_FILENAME = "games.ndjson";

export type LabGameNdjsonRow = GameSnapshot & {
  gameIndex: number;
  gameSeed: number;
  playerStats?: LabPlayerStatRow[];
};

export function labGamesNdjsonPath(resultsRoot: string, runId: string): string {
  return join(resultsRoot, runId, LAB_GAMES_NDJSON_FILENAME);
}

export function appendGameNdjsonRow(input: {
  runId: string;
  resultsRoot?: string;
  row: LabGameNdjsonRow;
  host?: ManifestHost;
}): string {
  const resultsRoot = input.resultsRoot ?? DEFAULT_LAB_RESULTS_ROOT;
  const dir = join(resultsRoot, input.runId);
  const filePath = labGamesNdjsonPath(resultsRoot, input.runId);
  const mkdir =
    input.host?.mkdir ??
    ((target: string) => mkdirSync(target, { recursive: true }));
  const appendFile =
    input.host?.appendFile ??
    ((target: string, contents: string) => {
      appendFileSync(target, contents, "utf8");
    });
  mkdir(dir);
  appendFile(filePath, `${JSON.stringify(input.row)}\n`);
  return filePath;
}

export function parseGamesNdjson(text: string): LabGameNdjsonRow[] {
  const rows: LabGameNdjsonRow[] = [];
  const lines = text.split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    if (line.length === 0) {
      continue;
    }
    try {
      rows.push(JSON.parse(line) as LabGameNdjsonRow);
    } catch {
      const isLast =
        lineIndex === lines.length - 1 ||
        lines.slice(lineIndex + 1).every((rest) => rest.length === 0);
      if (isLast) {
        break;
      }
      throw new Error("games.ndjson contains a corrupt line.");
    }
  }
  return dedupeGamesNdjson(rows);
}

export function dedupeGamesNdjson(
  rows: readonly LabGameNdjsonRow[],
): LabGameNdjsonRow[] {
  const byIndex = new Map<number, LabGameNdjsonRow>();
  for (const row of rows) {
    byIndex.set(row.gameIndex, row);
  }
  return [...byIndex.values()].sort(
    (left, right) => left.gameIndex - right.gameIndex,
  );
}

export function readGamesNdjsonFile(
  filePath: string,
  host?: ManifestHost,
): LabGameNdjsonRow[] {
  const exists = host?.exists ?? ((target: string) => existsSync(target));
  if (!exists(filePath)) {
    return [];
  }
  const readFile =
    host?.readFile ?? ((target: string) => readFileSync(target, "utf8"));
  return parseGamesNdjson(readFile(filePath));
}

export function snapshotsFromNdjson(
  rows: readonly LabGameNdjsonRow[],
): GameSnapshot[] {
  return rows.map((row) => {
    const { gameIndex, gameSeed, playerStats, ...snapshot } = row;
    void gameIndex;
    void gameSeed;
    void playerStats;
    return snapshot;
  });
}

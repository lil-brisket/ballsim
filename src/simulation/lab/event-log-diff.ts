import { readFileSync } from "node:fs";
import type { GameEvent } from "@/domain/entities/game";

export type LabEventLogDiff = {
  index: number;
  stored: GameEvent | undefined;
  replayed: GameEvent | undefined;
};

export function parseEventNdjson(text: string): GameEvent[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line, index) => {
    const parsed: unknown = JSON.parse(line);
    if (parsed == null || typeof parsed !== "object") {
      throw new Error(`Invalid event NDJSON at line ${index + 1}.`);
    }
    return parsed as GameEvent;
  });
}

export function loadEventNdjson(filePath: string): GameEvent[] {
  return parseEventNdjson(readFileSync(filePath, "utf8"));
}

export function diffEventLogs(
  stored: readonly GameEvent[],
  replayed: readonly GameEvent[],
): LabEventLogDiff[] {
  const length = Math.max(stored.length, replayed.length);
  const diffs: LabEventLogDiff[] = [];
  for (let index = 0; index < length; index += 1) {
    const left = stored[index];
    const right = replayed[index];
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      diffs.push({ index, stored: left, replayed: right });
    }
  }
  return diffs;
}

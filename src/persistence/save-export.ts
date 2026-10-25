import type { GameState } from "@/state/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";

/**
 * Downloadable save file: a small header plus the full GameState (history
 * included), as the mapper writes it. Imports run the same migrations and
 * validation as loading a stored save.
 */
export const SAVE_EXPORT_FORMAT = "ballsim-save";
export const SAVE_EXPORT_VERSION = 1;

export type SaveExportHeader = {
  format: typeof SAVE_EXPORT_FORMAT;
  version: typeof SAVE_EXPORT_VERSION;
  name: string;
  exportedAt: string;
};

export function encodeSaveExport(
  name: string,
  state: GameState,
  exportedAt: string,
): string {
  const header: SaveExportHeader = {
    format: SAVE_EXPORT_FORMAT,
    version: SAVE_EXPORT_VERSION,
    name,
    exportedAt,
  };
  // Splice the serialized state in rather than re-parsing a large league.
  const headerJson = JSON.stringify(header);
  return `${headerJson.slice(0, -1)},"state":${serializeGameState(state)}}`;
}

export type DecodedSaveExport =
  { ok: true; name: string; state: GameState } | { ok: false; error: string };

export function decodeSaveExport(fileText: string): DecodedSaveExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return { ok: false, error: "The file is not a Ballsim save." };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== SAVE_EXPORT_FORMAT
  ) {
    return { ok: false, error: "The file is not a Ballsim save." };
  }
  const file = parsed as { version?: unknown; name?: unknown; state?: unknown };
  if (file.version !== SAVE_EXPORT_VERSION) {
    return {
      ok: false,
      error: "This save file was made by a different version of the game.",
    };
  }
  try {
    return {
      ok: true,
      name: typeof file.name === "string" ? file.name : "",
      state: deserializeGameState(JSON.stringify(file.state)),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `The save could not be read: ${error.message}`
          : "The save could not be read.",
    };
  }
}

/** A file name safe on every OS, from the save's display name. */
export function saveExportFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "save"}.ballsim.json`;
}

/**
 * Filesystem convention for optional raster portrait overlays.
 * Presentation cache only — not GameState, not SavePlayer.
 *
 * Path: portraits/{saveGameId}/{playerId}.v{n}.{contentHash}.webp
 * The portraits/ directory is gitignored except tests/fixtures/portraits/.
 */

export const PORTRAIT_OVERLAY_ROOT = "portraits";
export const PORTRAIT_OVERLAY_EXTENSION = "webp";

export function playerPortraitOverlayRelativePath(
  saveGameId: string,
  playerId: string,
  version: number,
  contentHash: string,
): string {
  if (saveGameId.length === 0) {
    throw new Error("saveGameId must be non-empty.");
  }
  if (playerId.length === 0) {
    throw new Error("playerId must be non-empty.");
  }
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("version must be an integer >= 1.");
  }
  if (contentHash.length === 0) {
    throw new Error("contentHash must be non-empty.");
  }
  return `${PORTRAIT_OVERLAY_ROOT}/${saveGameId}/${playerId}.v${version}.${contentHash}.${PORTRAIT_OVERLAY_EXTENSION}`;
}

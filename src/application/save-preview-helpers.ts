import type { GameMode } from "@/state/game-state";
import type { OwnerSavePreview } from "@/application/game-service";

export type ValidOwnerSavePreview = OwnerSavePreview & { ok: true };

/**
 * Most recently updated valid save for a persisted game mode.
 * Reuses the home-page “latest updatedAt among ok: true” rule with a mode filter.
 */
export function latestValidSaveForMode(
  previews: readonly OwnerSavePreview[],
  mode: GameMode,
): ValidOwnerSavePreview | null {
  const valid = previews.filter(
    (preview): preview is ValidOwnerSavePreview =>
      preview.ok && preview.mode === mode,
  );
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((latest, preview) =>
    preview.updatedAt > latest.updatedAt ? preview : latest,
  );
}

/**
 * Filter save list for a mode-scoped Load screen.
 * Valid previews must match the mode; invalid rows (no mode) are kept for delete.
 */
export function filterSavePreviewsForMode(
  previews: readonly OwnerSavePreview[],
  mode: GameMode,
): OwnerSavePreview[] {
  return previews.filter(
    (preview) => !preview.ok || preview.mode === mode,
  );
}

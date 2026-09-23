/**
 * Optimistic concurrency conflict when saving a GameState blob.
 * Thrown when ifUpdatedAt does not match the stored row's updatedAt.
 */

export class SaveVersionConflictError extends Error {
  readonly saveId: string;

  constructor(saveId: string, message?: string) {
    super(
      message ??
        `Save "${saveId}" was updated elsewhere. Refresh and try again.`,
    );
    this.name = "SaveVersionConflictError";
    this.saveId = saveId;
  }
}

export function isSaveVersionConflict(error: unknown): boolean {
  return error instanceof SaveVersionConflictError;
}

export const SAVE_VERSION_CONFLICT_USER_MESSAGE =
  "This save was updated elsewhere. Refresh and try again.";

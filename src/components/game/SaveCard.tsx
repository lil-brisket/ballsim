import { deleteSaveAction, openSaveAction } from "@/application/actions";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import type { OwnerSavePreview } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { StatusBadge } from "@/components/owner/StatusBadge";

function formatLastPlayed(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SaveCard(props: {
  preview: OwnerSavePreview;
  showDelete?: boolean;
}) {
  const { preview, showDelete = true } = props;

  if (!preview.ok) {
    return (
      <li className="flex flex-col gap-3 rounded-lg border border-rose-900/50 bg-rose-950/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-zinc-100">{preview.name}</p>
          <p className="mt-1 text-sm text-rose-300" role="status">
            {preview.error}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-500">
            Last updated {formatLastPlayed(preview.updatedAt)}
          </p>
        </div>
        {showDelete ? (
          <ConfirmDialog
            title="Delete save?"
            description={`Delete “${preview.name}”? This cannot be undone.`}
            confirmLabel="Delete"
          >
            <form action={deleteSaveAction}>
              <input type="hidden" name="saveId" value={preview.id} />
              <button
                type="submit"
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Confirm delete
              </button>
            </form>
          </ConfirmDialog>
        ) : null}
      </li>
    );
  }

  const modeDef = getGameModeDefinition(preview.mode);
  const teamLabel = `${preview.controlledTeam.city} ${preview.controlledTeam.name}`;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-zinc-100">{preview.name}</p>
          <StatusBadge label={modeDef.name} tone="info" />
        </div>
        <p className="text-sm text-zinc-300">{teamLabel}</p>
        <p className="font-mono text-xs text-zinc-500">
          Season {preview.seasonYear} · {preview.currentDate} ·{" "}
          {preview.seasonPhase}
        </p>
        <p className="text-xs text-zinc-600">
          Last played {formatLastPlayed(preview.updatedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <form action={openSaveAction}>
          <input type="hidden" name="saveId" value={preview.id} />
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Open
          </button>
        </form>
        {showDelete ? (
          <ConfirmDialog
            title="Delete save?"
            description={`Delete “${preview.name}”? This cannot be undone.`}
            confirmLabel="Delete"
          >
            <form action={deleteSaveAction}>
              <input type="hidden" name="saveId" value={preview.id} />
              <button
                type="submit"
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Confirm delete
              </button>
            </form>
          </ConfirmDialog>
        ) : null}
      </div>
    </li>
  );
}

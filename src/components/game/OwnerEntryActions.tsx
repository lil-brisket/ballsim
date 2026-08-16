import Link from "next/link";
import { openSaveAction } from "@/application/actions";
import type { ValidOwnerSavePreview } from "@/application/save-preview-helpers";
import { ErrorState } from "@/components/owner/EmptyState";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

const panelClass =
  "flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6";

export function OwnerEntryActions(props: {
  continueSave: ValidOwnerSavePreview | null;
  hasAnySaves: boolean;
  atSaveLimit: boolean;
  maxSaveSlots: number;
  newGameHref: string;
}) {
  const {
    continueSave,
    hasAnySaves,
    atSaveLimit,
    maxSaveSlots,
    newGameHref,
  } = props;

  return (
    <>
      {!continueSave ? (
        <section
          className={`${panelClass} border-amber-800/40 bg-amber-950/20`}
          aria-label="No Owner saves"
        >
          <h2 className="text-lg font-medium text-zinc-50">No Owner saves yet</h2>
          <p className="text-sm text-zinc-400">
            Start your first franchise to begin.
          </p>
          {atSaveLimit ? (
            <ErrorState
              message={`At most ${maxSaveSlots} saves are allowed. Delete a save to create another.`}
            />
          ) : (
            <Link
              href={newGameHref}
              className={`mt-2 inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 ${focusRing}`}
            >
              Start New Game →
            </Link>
          )}
        </section>
      ) : null}

      <section className="grid gap-4" aria-label="Owner entry actions">
        {continueSave ? (
          <form action={openSaveAction} className={panelClass}>
            <input type="hidden" name="saveId" value={continueSave.id} />
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
                Continue
              </p>
              <h2 className="text-xl font-semibold text-zinc-50">
                {continueSave.controlledTeam.city}{" "}
                {continueSave.controlledTeam.name}
              </h2>
              <p className="text-sm text-zinc-400">{continueSave.name}</p>
              <p className="font-mono text-xs text-zinc-500">
                Season {continueSave.seasonYear} · {continueSave.currentDate} ·{" "}
                {continueSave.seasonPhase}
              </p>
            </div>
            <button
              type="submit"
              className={`mt-auto inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-amber-600 px-5 py-2.5 text-sm font-medium text-zinc-950 hover:bg-amber-500 ${focusRing}`}
            >
              Continue →
            </button>
          </form>
        ) : null}

        <div className={panelClass}>
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
              Load Another Save
            </p>
            <h2 className="text-xl font-semibold text-zinc-50">
              Choose an existing Owner save
            </h2>
            <p className="text-sm text-zinc-400">
              {hasAnySaves
                ? "Open a different franchise or manage save slots."
                : "No Owner saves to load yet."}
            </p>
          </div>
          {hasAnySaves ? (
            <Link
              href="/saves?mode=owner"
              className={`mt-auto inline-flex min-h-11 w-fit items-center justify-center rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-100 hover:border-amber-600 hover:text-amber-400 ${focusRing}`}
            >
              Load Save →
            </Link>
          ) : (
            <p className="mt-auto text-sm text-zinc-600">No saves available.</p>
          )}
        </div>

        {continueSave ? (
          <div className={panelClass}>
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                Start New Game
              </p>
              <h2 className="text-xl font-semibold text-zinc-50">
                Create a new franchise
              </h2>
              <p className="text-sm text-zinc-400">
                Configure league rules and begin a new Owner Mode career.
              </p>
            </div>
            {atSaveLimit ? (
              <div className="mt-auto space-y-3">
                <ErrorState
                  message={`At most ${maxSaveSlots} saves are allowed. Delete a save to create another.`}
                />
                <Link
                  href="/saves?mode=owner"
                  className={`inline-flex min-h-11 w-fit items-center justify-center rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-100 hover:border-amber-600 hover:text-amber-400 ${focusRing}`}
                >
                  Manage Saves →
                </Link>
              </div>
            ) : (
              <Link
                href={newGameHref}
                className={`mt-auto inline-flex min-h-11 w-fit items-center justify-center rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-100 hover:border-amber-600 hover:text-amber-400 ${focusRing}`}
              >
                New Game →
              </Link>
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}

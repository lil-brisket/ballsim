import Link from "next/link";
import {
  deleteSaveAction,
  openSaveAction,
} from "@/application/actions";
import {
  listOwnerSaves,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const { error } = await searchParams;
  const saves = await listOwnerSaves();
  const atSaveLimit = saves.length >= MAX_OWNER_SAVE_SLOTS;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
          Owner Mode Foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
          Basketball
        </h1>
        <p className="max-w-xl text-zinc-400">
          Create or continue a fictional franchise save. New saves open game
          setup, then team selection, then the Owner Mode dashboard.
        </p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-medium text-zinc-100">New save</h2>
        {atSaveLimit ? (
          <ErrorState
            message={`Owner Mode allows at most ${MAX_OWNER_SAVE_SLOTS} saves. Delete a save to create another.`}
          />
        ) : (
          <Link
            href="/new/setup"
            className="inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Configure league and create
          </Link>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-100">
          Existing saves ({saves.length}/{MAX_OWNER_SAVE_SLOTS})
        </h2>
        {saves.length === 0 ? (
          <p className="text-sm text-zinc-500">No saves yet.</p>
        ) : (
          <ul className="space-y-2">
            {saves.map((save) => (
              <li
                key={save.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">{save.name}</p>
                  <p className="font-mono text-xs text-zinc-500">
                    schema v{save.schemaVersion} · {save.id}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <form action={openSaveAction}>
                    <input type="hidden" name="saveId" value={save.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600 hover:text-amber-400"
                    >
                      Open
                    </button>
                  </form>
                  <ConfirmDialog
                    title="Delete save?"
                    description={`Delete “${save.name}”? This cannot be undone.`}
                    confirmLabel="Delete"
                  >
                    <form action={deleteSaveAction}>
                      <input type="hidden" name="saveId" value={save.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-red-600"
                      >
                        Confirm delete
                      </button>
                    </form>
                  </ConfirmDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-zinc-600">
        See GAME_DESIGN.md and ARCHITECTURE.md in the repository root.
      </p>
    </main>
  );
}

import Link from "next/link";
import { openSaveAction } from "@/application/actions";
import {
  listOwnerSavePreviews,
  MAX_OWNER_SAVE_SLOTS,
  type OwnerSavePreview,
} from "@/application/game-service";
import { SaveCard } from "@/components/game/SaveCard";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

function mostRecentValidSave(
  previews: OwnerSavePreview[],
): OwnerSavePreview & { ok: true } | null {
  const valid = previews.filter(
    (preview): preview is OwnerSavePreview & { ok: true } => preview.ok,
  );
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((latest, preview) =>
    preview.updatedAt > latest.updatedAt ? preview : latest,
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { error } = await searchParams;
  const previews = await listOwnerSavePreviews();
  const atSaveLimit = previews.length >= MAX_OWNER_SAVE_SLOTS;
  const continueSave = mostRecentValidSave(previews);
  const recent = previews.filter((p) => p.ok).slice(0, 3);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
          Basketball
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
          Franchise Simulation
        </h1>
        <p className="max-w-xl text-zinc-400">
          Own a team, manage the franchise, and guide your organization through
          seasons of fictional basketball.
        </p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      <section
        className="grid gap-3 sm:grid-cols-2"
        aria-label="Primary actions"
      >
        {atSaveLimit ? (
          <div className="sm:col-span-2">
            <ErrorState
              message={`At most ${MAX_OWNER_SAVE_SLOTS} saves are allowed. Delete a save to create another.`}
            />
          </div>
        ) : (
          <Link
            href="/new/mode"
            className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-3 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            New Game
          </Link>
        )}

        {continueSave ? (
          <form action={openSaveAction} className="contents">
            <input type="hidden" name="saveId" value={continueSave.id} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-amber-600 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Continue
            </button>
          </form>
        ) : (
          <span
            className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-zinc-800 px-4 py-3 text-sm text-zinc-600"
            aria-disabled="true"
          >
            Continue
          </span>
        )}

        <Link
          href="/saves"
          className="inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-amber-600 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Load Game
        </Link>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-md border border-zinc-700 px-4 py-3 text-sm font-medium text-zinc-100 hover:border-amber-600 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Settings
        </Link>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-zinc-100">Recent saves</h2>
          <Link
            href="/saves"
            className="text-sm text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            View all ({previews.length}/{MAX_OWNER_SAVE_SLOTS})
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState message="No saves yet. Start a new game to create your first franchise." />
        ) : (
          <ul className="space-y-2">
            {recent.map((preview) => (
              <SaveCard key={preview.id} preview={preview} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

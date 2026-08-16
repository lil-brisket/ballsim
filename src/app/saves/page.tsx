import Link from "next/link";
import {
  listOwnerSavePreviews,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { filterSavePreviewsForMode } from "@/application/save-preview-helpers";
import { SaveCard } from "@/components/game/SaveCard";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import type { GameMode } from "@/state/game-state";

export const dynamic = "force-dynamic";

type SavesPageProps = {
  searchParams: Promise<{ error?: string; mode?: string }>;
};

function parseSaveModeFilter(mode: string | undefined): GameMode | null {
  if (mode === "owner") {
    return "owner";
  }
  return null;
}

export default async function SavesPage({ searchParams }: SavesPageProps) {
  const { error, mode: modeParam } = await searchParams;
  const modeFilter = parseSaveModeFilter(modeParam);
  const allPreviews = await listOwnerSavePreviews();
  const previews = modeFilter
    ? filterSavePreviewsForMode(allPreviews, modeFilter)
    : allPreviews;
  const backHref = modeFilter === "owner" ? "/owner" : "/home";
  const backLabel = modeFilter === "owner" ? "← Owner Mode" : "← Home";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <Link
          href={backHref}
          className="text-sm text-zinc-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {backLabel}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          {modeFilter === "owner" ? "Load Owner Save" : "Load Game"}
        </h1>
        <p className="text-zinc-400">
          Open an existing save or delete one to free a slot (
          {allPreviews.length}/{MAX_OWNER_SAVE_SLOTS}).
        </p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {previews.length === 0 ? (
        <EmptyState
          message={
            modeFilter === "owner"
              ? "No Owner saves found."
              : "No saves found."
          }
        />
      ) : (
        <ul className="space-y-2">
          {previews.map((preview) => (
            <SaveCard key={preview.id} preview={preview} />
          ))}
        </ul>
      )}
    </main>
  );
}

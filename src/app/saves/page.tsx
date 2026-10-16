import Link from "next/link";
import {
  listOwnerSavePreviews,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { filterSavePreviewsForMode } from "@/application/save-preview-helpers";
import { SaveCard } from "@/components/game/SaveCard";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
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
          className="inline-flex min-h-11 items-center text-sm text-zinc-300 hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
        >
          {backLabel}
        </Link>
        <SectionHeading
          as="h1"
          size="lg"
          eyebrow="Saves"
          title={modeFilter === "owner" ? "Load Owner Save" : "Load Game"}
        />
        <p className="text-zinc-300">
          Open an existing save or delete one to free a slot (
          {allPreviews.length}/{MAX_OWNER_SAVE_SLOTS}).
        </p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {previews.length === 0 ? (
        <EmptyState
          message={
            modeFilter === "owner" ? "No Owner saves found." : "No saves found."
          }
        />
      ) : (
        <ul className="space-y-3">
          {previews.map((preview) => (
            <SaveCard key={preview.id} preview={preview} />
          ))}
        </ul>
      )}
    </main>
  );
}

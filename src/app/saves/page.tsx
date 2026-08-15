import Link from "next/link";
import {
  listOwnerSavePreviews,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { SaveCard } from "@/components/game/SaveCard";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

type SavesPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SavesPage({ searchParams }: SavesPageProps) {
  const { error } = await searchParams;
  const previews = await listOwnerSavePreviews();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          ← Home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Load Game
        </h1>
        <p className="text-zinc-400">
          Open an existing save or delete one to free a slot (
          {previews.length}/{MAX_OWNER_SAVE_SLOTS}).
        </p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      {previews.length === 0 ? (
        <EmptyState message="No saves found." />
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

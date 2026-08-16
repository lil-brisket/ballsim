import Link from "next/link";
import { getGameModeDefinition } from "@/application/game-mode-catalog";
import {
  listOwnerSavePreviews,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { latestValidSaveForMode } from "@/application/save-preview-helpers";
import { OwnerEntryActions } from "@/components/game/OwnerEntryActions";
import { ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

type OwnerEntryPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

export default async function OwnerEntryPage({
  searchParams,
}: OwnerEntryPageProps) {
  const { error } = await searchParams;
  const modeDef = getGameModeDefinition("owner");
  const previews = await listOwnerSavePreviews();
  const continueSave = latestValidSaveForMode(previews, "owner");
  const atSaveLimit = previews.length >= MAX_OWNER_SAVE_SLOTS;
  const newGameHref = modeDef.href ?? "/new/setup?mode=owner";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12 sm:py-16">
      <div>
        <Link
          href="/home"
          className={`text-sm text-zinc-400 hover:text-amber-400 ${focusRing}`}
        >
          ← Choose mode
        </Link>
      </div>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          {modeDef.name}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          {modeDef.tagline}
        </h1>
        <p className="text-zinc-400">What would you like to do?</p>
      </header>

      {error ? <ErrorState message={error} /> : null}

      <OwnerEntryActions
        continueSave={continueSave}
        hasAnySaves={previews.length > 0}
        atSaveLimit={atSaveLimit}
        maxSaveSlots={MAX_OWNER_SAVE_SLOTS}
        newGameHref={newGameHref}
      />
    </main>
  );
}

import Link from "next/link";
import {
  listOwnerSaves,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { GameSetupForm } from "@/components/owner/GameSetupForm";
import { ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function GameSetupPage({ searchParams }: SetupPageProps) {
  const { error } = await searchParams;
  const saves = await listOwnerSaves();
  const atSaveLimit = saves.length >= MAX_OWNER_SAVE_SLOTS;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          New Game
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Game setup
        </h1>
        <p className="text-zinc-400">
          Configure league rules for this Owner Mode career. Settings are saved
          with the franchise and drive simulation.
        </p>
        <Link href="/" className="text-sm text-amber-400 hover:underline">
          Back to saves
        </Link>
      </header>

      {error ? <ErrorState message={error} /> : null}
      {atSaveLimit ? (
        <ErrorState
          message={`Owner Mode allows at most ${MAX_OWNER_SAVE_SLOTS} saves. Delete a save to create another.`}
        />
      ) : null}

      <GameSetupForm atSaveLimit={atSaveLimit} />
    </main>
  );
}

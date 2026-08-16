import { redirect } from "next/navigation";
import {
  listOwnerSaves,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { GameSetupForm } from "@/components/owner/GameSetupForm";
import { ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

type SetupPageProps = {
  searchParams: Promise<{ error?: string; mode?: string }>;
};

export default async function GameSetupPage({ searchParams }: SetupPageProps) {
  const { error, mode } = await searchParams;

  // Mode must be chosen explicitly; catalog-only modes never reach create.
  if (mode !== "owner") {
    redirect("/home");
  }

  const saves = await listOwnerSaves();
  const atSaveLimit = saves.length >= MAX_OWNER_SAVE_SLOTS;

  return (
    <OnboardingShell
      step="setup"
      title="Game setup"
      subtitle="Configure league rules for this Owner Mode career. Settings are saved with the franchise and drive simulation. A save is created only when you confirm below."
    >
      {error ? <ErrorState message={error} /> : null}
      {atSaveLimit ? (
        <ErrorState
          message={`At most ${MAX_OWNER_SAVE_SLOTS} saves are allowed. Delete a save to create another.`}
        />
      ) : null}

      <GameSetupForm atSaveLimit={atSaveLimit} />
    </OnboardingShell>
  );
}

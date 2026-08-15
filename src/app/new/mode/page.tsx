import { listGameModeDefinitions } from "@/application/game-mode-catalog";
import {
  listOwnerSaves,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { GameModeCard } from "@/components/game/GameModeCard";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { ErrorState } from "@/components/owner/EmptyState";

export const dynamic = "force-dynamic";

export default async function ModeSelectionPage() {
  const saves = await listOwnerSaves();
  const atSaveLimit = saves.length >= MAX_OWNER_SAVE_SLOTS;
  const modes = listGameModeDefinitions();

  return (
    <OnboardingShell
      step="mode"
      title="Choose game mode"
      subtitle="Select how you want to play. Owner Mode is fully available; other modes are listed for future releases."
    >
      {atSaveLimit ? (
        <ErrorState
          message={`At most ${MAX_OWNER_SAVE_SLOTS} saves are allowed. Delete a save before starting a new game.`}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modes.map((mode) => (
          <GameModeCard key={mode.id} mode={mode} />
        ))}
      </div>
    </OnboardingShell>
  );
}

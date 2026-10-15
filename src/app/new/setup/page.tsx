import { redirect } from "next/navigation";
import {
  listOwnerSaves,
  MAX_OWNER_SAVE_SLOTS,
} from "@/application/game-service";
import { getCurrentUser } from "@/application/auth/session";
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

  const user = await getCurrentUser();
  const saves = await listOwnerSaves();
  const atSaveLimit = saves.length >= MAX_OWNER_SAVE_SLOTS;

  return (
    <GameSetupForm
      atSaveLimit={atSaveLimit}
      signedInAs={user?.username ?? null}
      restoreDraft={Boolean(error)}
      notices={
        <>
          {error ? <ErrorState message={error} /> : null}
          {atSaveLimit ? (
            <ErrorState
              message={`At most ${MAX_OWNER_SAVE_SLOTS} saves are allowed. Delete a save to create another.`}
            />
          ) : null}
        </>
      }
    />
  );
}

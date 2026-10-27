import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { OwnerMultiTeamPick } from "@/components/owner/OwnerMultiTeamPick";
import { linkClass } from "@/components/ui/styles";
import { DEFAULT_OWNERSHIP_SETTINGS } from "@/domain/game-settings";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function AdditionalFranchisesPage({ params }: PageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const route = resolveOnboardingRoute(saveId, {
    citySelectionConfirmed: view.dashboard.citySelectionConfirmed,
    franchiseIdentityConfirmed: view.dashboard.franchiseIdentityConfirmed,
    fantasyDraftMode: view.dashboard.fantasyDraftMode,
    fantasyDraftStatus: view.dashboard.fantasyDraftStatus,
  });
  if (route.kind === "city") {
    redirect(route.path);
  }
  if (route.kind !== "franchises") {
    redirect(route.path);
  }

  if (view.dashboard.teamSelectionLocked) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <p className="text-soft">Team selection is locked for this save.</p>
        <Link href={`/dashboard/${saveId}`} className={linkClass}>
          Open dashboard
        </Link>
      </main>
    );
  }

  const controlledTeamCount =
    view.settings.ownership?.controlledTeamCount ??
    DEFAULT_OWNERSHIP_SETTINGS.controlledTeamCount;

  const participation = view.dashboard.participation;
  const participants = participation
    ? participation.participants.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isHost: p.isHost,
        plannedTeamCount: p.plannedTeamCount,
      }))
    : undefined;

  return (
    <OnboardingShell
      step="franchise"
      title="Controlled Franchises"
      subtitle={
        participants
          ? "Choose each player's franchises, then customize each team's identity."
          : "Select the franchises you want to control, then customize each team's identity."
      }
      className="max-w-3xl"
    >
      <OwnerMultiTeamPick
        saveId={saveId}
        anchorTeamId={view.dashboard.controlledTeam.id}
        controlledTeamCount={controlledTeamCount}
        teams={view.teams}
        divisionsEnabled={view.settings.league.divisionsEnabled}
        participants={participants}
      />
    </OnboardingShell>
  );
}

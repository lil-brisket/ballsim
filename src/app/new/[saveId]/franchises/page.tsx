import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { OwnerMultiTeamPick } from "@/components/owner/OwnerMultiTeamPick";

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
  });
  if (route.kind === "city") {
    redirect(route.path);
  }
  if (route.kind === "dashboard") {
    redirect(route.path);
  }

  if (view.dashboard.teamSelectionLocked) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <p className="text-zinc-300">Team selection is locked for this save.</p>
        <Link
          href={`/dashboard/${saveId}`}
          className="text-amber-400 hover:underline"
        >
          Open dashboard
        </Link>
      </main>
    );
  }

  return (
    <OnboardingShell
      step="franchise"
      title="Multi-team ownership"
      subtitle="Optionally take control of more franchises in this league."
      className="max-w-3xl"
    >
      <OwnerMultiTeamPick
        saveId={saveId}
        primaryTeamId={view.dashboard.controlledTeam.id}
        teams={view.teams}
      />
    </OnboardingShell>
  );
}

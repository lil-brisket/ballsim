import Link from "next/link";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { OwnerTeamPick } from "@/components/owner/OwnerTeamPick";

type TeamPickPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function TeamPickPage({ params }: TeamPickPageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  if (view.dashboard.teamSelectionLocked) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <p className="text-zinc-300">Team selection is locked for this save.</p>
        <Link
          href={`/dashboard/${saveId}`}
          className="text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Open dashboard
        </Link>
      </main>
    );
  }

  return (
    <OnboardingShell
      step="franchise"
      title="Pick your team"
      subtitle="Choose one franchise to control. You can change it until the first time advance. This does not create another save."
    >
      <OwnerTeamPick saveId={saveId} teams={view.teams} />
    </OnboardingShell>
  );
}

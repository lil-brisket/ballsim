import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { CityMapPicker } from "@/components/owner/CityMapPicker";
import { ErrorState } from "@/components/ui/EmptyState";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import { isLeagueArea } from "@/domain/game-settings";

type TeamPickPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TeamPickPage({
  params,
  searchParams,
}: TeamPickPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
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
  if (route.kind !== "city") {
    redirect(route.path);
  }

  if (view.dashboard.teamSelectionLocked) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <p className="text-soft">Team selection is locked for this save.</p>
        <Link
          href={`/dashboard/${saveId}`}
          className={cn(linkClass, focusRingClass)}
        >
          Open dashboard
        </Link>
      </main>
    );
  }

  const areaRaw = view.settings.league.area ?? "north_america";
  const area = isLeagueArea(areaRaw) ? areaRaw : "north_america";

  return (
    <OnboardingShell
      step="franchise"
      title="Choose your franchise location"
      subtitle="Pick a city on the map to found your franchise."
      className="max-w-6xl"
      fillViewport
    >
      {error ? (
        <div className="shrink-0">
          <ErrorState message={error} />
        </div>
      ) : null}
      <CityMapPicker saveId={saveId} area={area} cities={view.cities} />
    </OnboardingShell>
  );
}

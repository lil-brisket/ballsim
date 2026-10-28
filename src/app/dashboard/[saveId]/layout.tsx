import type { Metadata } from "next";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { loadOwnerSave } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { GameShell } from "@/components/game/GameShell";
import { DashboardMoments } from "@/components/moments/DashboardMoments";

type OwnerLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ saveId: string }>;
};

/** One save load per request, shared by generateMetadata and the layout. */
const loadSave = cache(loadOwnerSave);

export async function generateMetadata({
  params,
}: Pick<OwnerLayoutProps, "params">): Promise<Metadata> {
  const { saveId } = await params;
  const loaded = await loadSave(saveId);
  if (!loaded) {
    return {};
  }
  const team = loaded.dashboard.controlledTeam;
  const teamName = `${team.city} ${team.name}`;
  return { title: { default: teamName, template: `%s · ${teamName}` } };
}

export default async function OwnerLayout({
  children,
  params,
}: OwnerLayoutProps) {
  const { saveId } = await params;
  const loaded = await loadSave(saveId);
  if (!loaded) {
    notFound();
  }

  const route = resolveOnboardingRoute(saveId, {
    citySelectionConfirmed: loaded.dashboard.citySelectionConfirmed,
    franchiseIdentityConfirmed: loaded.dashboard.franchiseIdentityConfirmed,
    fantasyDraftMode: loaded.dashboard.fantasyDraftMode,
    fantasyDraftStatus: loaded.dashboard.fantasyDraftStatus,
  });
  if (route.kind !== "dashboard") {
    redirect(route.path);
  }

  const { save, dashboard, navGroups } = loaded;

  return (
    <GameShell
      saveId={saveId}
      saveName={save.name}
      dashboard={dashboard}
      navGroups={navGroups}
      ticker={loaded.ticker ?? null}
    >
      {children}
      <DashboardMoments saveId={saveId} moments={loaded.moments} />
    </GameShell>
  );
}

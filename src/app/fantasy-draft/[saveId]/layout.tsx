import { notFound, redirect } from "next/navigation";
import { loadFantasyDraftView } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { loadOwnerSave } from "@/application/game-service";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ saveId: string }>;
};

export default async function FantasyDraftLayout({
  children,
  params,
}: LayoutProps) {
  const { saveId } = await params;
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    notFound();
  }

  const route = resolveOnboardingRoute(saveId, {
    citySelectionConfirmed: loaded.dashboard.citySelectionConfirmed,
    franchiseIdentityConfirmed: loaded.dashboard.franchiseIdentityConfirmed,
    fantasyDraftMode: loaded.dashboard.fantasyDraftMode,
    fantasyDraftStatus: loaded.dashboard.fantasyDraftStatus,
  });

  if (route.kind === "city" || route.kind === "franchises") {
    redirect(route.path);
  }

  if (
    loaded.dashboard.fantasyDraftMode &&
    (loaded.dashboard.fantasyDraftStatus === null ||
      loaded.dashboard.fantasyDraftStatus === "setup")
  ) {
    redirect(`/new/${saveId}/fantasy-draft/setup`);
  }

  // Ensure view exists when draft is active/complete
  const draftView = await loadFantasyDraftView(saveId);
  if (!draftView && loaded.dashboard.fantasyDraftMode) {
    redirect(`/new/${saveId}/fantasy-draft/setup`);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">{children}</div>
  );
}

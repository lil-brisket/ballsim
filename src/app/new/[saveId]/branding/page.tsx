import { notFound, redirect } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";

type BrandingPageProps = {
  params: Promise<{ saveId: string }>;
};

/**
 * Compatibility stub: branding was merged into controlled-franchises setup.
 */
export default async function BrandingPage({ params }: BrandingPageProps) {
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
  redirect(route.path);
}

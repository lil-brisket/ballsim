import { notFound, redirect } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { TeamIdentityBuilder } from "@/components/owner/TeamIdentityBuilder";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";
import { resolvePaletteIdFromBranding } from "@/domain/entities/team-branding";

type BrandingPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function BrandingPage({ params }: BrandingPageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const route = resolveOnboardingRoute(saveId, {
    citySelectionConfirmed: view.dashboard.citySelectionConfirmed,
    franchiseIdentityConfirmed: view.dashboard.franchiseIdentityConfirmed,
  });
  if (route.kind !== "branding") {
    redirect(route.path);
  }

  if (view.dashboard.teamSelectionLocked) {
    redirect(`/dashboard/${saveId}`);
  }

  const team = view.dashboard.controlledTeam;
  const brandingForResolve = {
    ...team.branding,
    logoId: team.branding.logoId as TeamLogoId,
  };
  const paletteId =
    resolvePaletteIdFromBranding(brandingForResolve) ?? "midnight_navy";
  const logoId = brandingForResolve.logoId;

  const existingTeams = view.teams.map((entry) => ({
    id: entry.id,
    city: entry.city,
    name: entry.name,
  }));

  return (
    <OnboardingShell
      step="franchise"
      title="Build your team identity"
      subtitle="Customize your team's name, colours, and logo before entering the league."
      className="max-w-5xl"
      fillViewport
    >
      <TeamIdentityBuilder
        saveId={saveId}
        city={team.city}
        initialNickname={team.name}
        initialPaletteId={paletteId}
        initialLogoId={logoId}
        teamId={team.id}
        existingTeams={existingTeams}
      />
    </OnboardingShell>
  );
}

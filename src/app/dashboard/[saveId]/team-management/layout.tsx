import { loadOwnerSave } from "@/application/game-service";
import { OwnerTeamSwitcher } from "@/components/game/OwnerTeamSwitcher";
import { TeamLabel } from "@/components/ui/TeamLabel";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ saveId: string }>;
};

export default async function TeamManagementLayout({
  children,
  params,
}: LayoutProps) {
  const { saveId } = await params;
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    notFound();
  }

  const team = loaded.dashboard.controlledTeam;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <TeamLabel
          city={team.city}
          name={team.name}
          abbreviation={team.abbreviation}
          branding={team.branding}
        />
        <Suspense fallback={null}>
          <OwnerTeamSwitcher
            saveId={saveId}
            ownedTeams={loaded.dashboard.ownedTeams}
            activeParticipantId={
              loaded.dashboard.participation?.activeParticipantId
            }
          />
        </Suspense>
      </div>
      {children}
    </div>
  );
}

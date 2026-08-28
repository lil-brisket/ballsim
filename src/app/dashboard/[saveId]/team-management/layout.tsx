import { loadOwnerSave } from "@/application/game-service";
import { TeamManagementNav } from "@/components/team-management/TeamManagementNav";
import { OwnerTeamSwitcher } from "@/components/game/OwnerTeamSwitcher";
import { TeamBadge } from "@/components/owner/TeamBadge";
import { notFound } from "next/navigation";

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
        <TeamBadge
          city={team.city}
          name={team.name}
          abbreviation={team.abbreviation}
          branding={team.branding}
        />
        <OwnerTeamSwitcher
          saveId={saveId}
          ownedTeams={loaded.dashboard.ownedTeams}
        />
      </div>
      <TeamManagementNav saveId={saveId} />
      {children}
    </div>
  );
}

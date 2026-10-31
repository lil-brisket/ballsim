import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadTeamRosterView } from "@/application/game-service";
import { TeamRosterPage } from "@/components/league/TeamRosterPage";

export const metadata: Metadata = { title: "Team roster" };

type PageProps = {
  params: Promise<{ saveId: string; teamId: string }>;
};

export default async function TeamRosterRoutePage({ params }: PageProps) {
  const { saveId, teamId } = await params;
  const view = await loadTeamRosterView(saveId, teamId);
  if (!view) {
    notFound();
  }
  if (view.isUserTeam) {
    redirect(`/dashboard/${saveId}/roster`);
  }

  return <TeamRosterPage saveId={saveId} view={view} />;
}

import { notFound } from "next/navigation";
import { loadTeamManagementView } from "@/application/game-service";
import { CoachingPageView } from "@/components/staff-coaching/CoachingPageView";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffCoachingCoachingPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadTeamManagementView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/staff-coaching/coaching`;

  return (
    <CoachingPageView
      saveId={saveId}
      coaching={view.coaching}
      returnPath={returnPath}
      error={error}
    />
  );
}

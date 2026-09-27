import { notFound } from "next/navigation";
import { loadStaffHubView } from "@/application/game-service";
import { StaffPageView } from "@/components/staff-coaching/StaffPageView";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffCoachingStaffPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadStaffHubView(saveId);
  if (!view) {
    notFound();
  }
  return <StaffPageView view={view} error={error} />;
}

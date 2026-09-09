import { notFound } from "next/navigation";
import { loadStaffHubView } from "@/application/game-service";
import { StaffPageView } from "@/components/staff-coaching/StaffPageView";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; role?: string; sort?: string }>;
};

export default async function StaffCoachingStaffPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error, role, sort } = await searchParams;
  const view = await loadStaffHubView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/staff-coaching/staff`;

  return (
    <StaffPageView
      view={view}
      returnPath={returnPath}
      filterBasePath={returnPath}
      error={error}
      role={role}
      sort={sort}
    />
  );
}

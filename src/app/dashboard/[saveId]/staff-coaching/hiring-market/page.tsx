import { notFound } from "next/navigation";
import { loadStaffHiringMarketView } from "@/application/game-service";
import { HiringMarketPageView } from "@/components/staff-coaching/HiringMarketPageView";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; role?: string; sort?: string }>;
};

export default async function StaffCoachingHiringMarketPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error, role, sort } = await searchParams;
  const view = await loadStaffHiringMarketView(saveId);
  if (!view) {
    notFound();
  }
  const query = new URLSearchParams();
  if (role) query.set("role", role);
  if (sort) query.set("sort", sort);
  const suffix = query.toString();
  const returnPath = `/dashboard/${saveId}/staff-coaching/hiring-market${
    suffix ? `?${suffix}` : ""
  }`;

  return (
    <HiringMarketPageView
      view={view}
      returnPath={returnPath}
      error={error}
      role={role}
      sort={sort}
    />
  );
}

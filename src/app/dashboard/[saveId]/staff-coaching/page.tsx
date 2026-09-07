import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function StaffCoachingIndexPage({ params }: PageProps) {
  const { saveId } = await params;
  redirect(`/dashboard/${saveId}/staff-coaching/staff`);
}
